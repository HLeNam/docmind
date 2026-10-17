import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrismaSystemService } from '../prisma/prisma-system.service.js';
import type { AccessTokenPayload } from '../auth/auth.service.js';
import {
  ConflictAppException,
  InternalAppException,
  NotFoundAppException,
  UnprocessableAppException,
  ValidationAppException,
} from '../common/exceptions/app.exception.js';
import { ErrorCode } from '../common/exceptions/error-codes.js';
import {
  SlackApiClient,
  type SlackOAuthAccessResponse,
} from './slack-api.client.js';
import { SlackCryptoService } from './slack-crypto.service.js';
import { signSlackState, verifySlackState } from './slack-state.util.js';

// Scope phải KHỚP với scope đã khai trong Slack App (OAuth & Permissions) — thiếu/thừa thì Slack từ chối
// hoặc cấp không đủ quyền. `commands` cho /ask, `chat:write` để bot đăng trả lời.
const BOT_SCOPES = ['commands', 'chat:write'];

interface SlackConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);

  constructor(
    private readonly prisma: PrismaService,
    // BYPASSRLS — chỉ để kiểm tra slackTeamId đã nối với tenant KHÁC chưa (RLS che mất hàng của tenant khác).
    private readonly system: PrismaSystemService,
    private readonly crypto: SlackCryptoService,
    private readonly api: SlackApiClient,
    private readonly config: ConfigService,
  ) {}

  /** Bước 1: tạo URL cài đặt. tenantId lấy từ JWT của người gọi, nhét vào state đã ký. */
  buildInstallUrl(caller: AccessTokenPayload): { url: string } {
    const cfg = this.slackConfig();
    const url = new URL('https://slack.com/oauth/v2/authorize');
    url.searchParams.set('client_id', cfg.clientId);
    url.searchParams.set('scope', BOT_SCOPES.join(','));
    url.searchParams.set('redirect_uri', cfg.redirectUri);
    url.searchParams.set(
      'state',
      signSlackState(caller.tenantId, cfg.clientSecret),
    );
    return { url: url.toString() };
  }

  /**
   * Bước 2: Slack redirect về callback (từ trình duyệt, KHÔNG có JWT). Tenant được xác định hoàn toàn từ
   * `state` đã ký — không tin bất kỳ tham số nào khác.
   */
  async completeInstall(
    code: string,
    state: string,
  ): Promise<{ slackTeamId: string; slackTeamName?: string }> {
    const cfg = this.slackConfig();

    const payload = verifySlackState(state, cfg.clientSecret);
    if (!payload) {
      throw new ValidationAppException(
        'Install link is invalid or has expired, please start again from DocMind',
        undefined,
        ErrorCode.SLACK_STATE_INVALID,
      );
    }

    let oauth: SlackOAuthAccessResponse;
    try {
      oauth = await this.api.exchangeCode({ ...cfg, code });
    } catch (err) {
      this.logger.error('Slack oauth.v2.access request failed', err);
      throw new UnprocessableAppException(
        'Could not reach Slack',
        undefined,
        ErrorCode.SLACK_OAUTH_FAILED,
      );
    }
    if (!oauth.ok || !oauth.access_token || !oauth.team?.id) {
      throw new UnprocessableAppException(
        `Slack rejected the installation: ${oauth.error ?? 'unknown_error'}`,
        undefined,
        ErrorCode.SLACK_OAUTH_FAILED,
      );
    }
    const teamId = oauth.team.id;

    // Mỗi workspace Slack chỉ nối được với 1 tenant (slackTeamId unique) — nếu không chặn sớm ở đây,
    // unique violation sẽ ra lỗi 500 khó hiểu.
    const takenBy = await this.system.slackIntegration.findUnique({
      where: { slackTeamId: teamId },
      select: { tenantId: true },
    });
    if (takenBy && takenBy.tenantId !== payload.tenantId) {
      throw new ConflictAppException(
        'This Slack workspace is already connected to another organization',
        undefined,
        ErrorCode.SLACK_WORKSPACE_TAKEN,
      );
    }

    const encryptedToken = this.crypto.encrypt(oauth.access_token);

    await this.prisma.runInTenantContext(payload.tenantId, async (tx) => {
      const existing = await tx.slackIntegration.findUnique({
        where: { tenantId: payload.tenantId },
      });
      if (!existing) {
        await tx.slackIntegration.create({
          data: {
            tenantId: payload.tenantId,
            slackTeamId: teamId,
            accessToken: encryptedToken,
          },
        });
        return;
      }
      // Cài lại sang workspace KHÁC: các mapping channel cũ trỏ vào channel của workspace cũ, vô nghĩa
      // với workspace mới -> xoá. Cài lại cùng workspace (cấp quyền lại/đổi token): giữ nguyên mapping.
      if (existing.slackTeamId !== teamId) {
        await tx.slackChannelMapping.deleteMany({
          where: { slackIntegrationId: existing.id },
        });
      }
      await tx.slackIntegration.update({
        where: { id: existing.id },
        data: { slackTeamId: teamId, accessToken: encryptedToken },
      });
    });

    return { slackTeamId: teamId, slackTeamName: oauth.team.name };
  }

  /** Trạng thái kết nối của tenant — KHÔNG bao giờ trả accessToken. */
  async getIntegration(caller: AccessTokenPayload) {
    const integration = await this.prisma.runInTenantContext(
      caller.tenantId,
      (tx) =>
        tx.slackIntegration.findUnique({
          where: { tenantId: caller.tenantId },
          select: { slackTeamId: true, createdAt: true },
        }),
    );
    if (!integration) return { connected: false as const };
    return {
      connected: true as const,
      slackTeamId: integration.slackTeamId,
      connectedAt: integration.createdAt.toISOString(),
    };
  }

  /** Gỡ kết nối: xoá khỏi DB (cascade xoá mapping), rồi cố thu hồi token phía Slack (best-effort). */
  async disconnect(caller: AccessTokenPayload): Promise<{ connected: false }> {
    const removed = await this.prisma.runInTenantContext(
      caller.tenantId,
      async (tx) => {
        const existing = await tx.slackIntegration.findUnique({
          where: { tenantId: caller.tenantId },
        });
        if (!existing) {
          throw new NotFoundAppException(
            'Slack is not connected',
            ErrorCode.SLACK_NOT_CONNECTED,
          );
        }
        await tx.slackIntegration.delete({ where: { id: existing.id } });
        return existing;
      },
    );

    // Lỗi thu hồi KHÔNG làm fail request: DB đã xoá xong, người dùng đã gỡ thành công từ phía DocMind.
    // Token còn sống phía Slack thì admin Slack có thể tự gỡ app ở workspace.
    try {
      await this.api.revokeToken(this.crypto.decrypt(removed.accessToken));
    } catch (err) {
      this.logger.warn(
        `Could not revoke Slack token for team ${removed.slackTeamId}: ${String(err)}`,
      );
    }
    return { connected: false };
  }

  private slackConfig(): SlackConfig {
    const clientId = this.config.get<string>('SLACK_CLIENT_ID', {
      infer: true,
    });
    const clientSecret = this.config.get<string>('SLACK_CLIENT_SECRET', {
      infer: true,
    });
    const redirectUri = this.config.get<string>('SLACK_REDIRECT_URI', {
      infer: true,
    });
    if (!clientId || !clientSecret || !redirectUri) {
      throw new InternalAppException(
        'Slack integration is not configured on this server',
        ErrorCode.SLACK_NOT_CONFIGURED,
      );
    }
    return { clientId, clientSecret, redirectUri };
  }
}
