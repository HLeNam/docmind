// Xử lý lệnh /ask. Luồng (Slack bắt phải phản hồi HTTP trong 3 giây, còn RAG mất vài giây tới chục giây):
//   1. Controller ack NGAY bằng 200 rỗng, rồi giao request cho handle() chạy nền.
//   2. handle(): kiểm tra -> đăng câu hỏi vào channel (message gốc) -> chạy RAG -> trả lời TRONG THREAD
//      của message đó, kèm Block Kit nguồn trích dẫn.
//   3. Mọi thông báo lỗi/hướng dẫn gửi dạng ephemeral (chỉ người gõ lệnh thấy) qua response_url, không
//      làm rác channel.
//
// Quyền: người dùng Slack không phải user DocMind. Quyền truy cập dữ liệu hoàn toàn do mapping channel
// -> collection (admin gán ở 4.5a) quyết định: chưa gán thì từ chối, đã gán thì CHỈ tìm trong collection đó.
import { Injectable, Logger } from '@nestjs/common';
import { PrismaSystemService } from '../prisma/prisma-system.service.js';
import { PublicQueryService } from '../public-api/public-query.service.js';
import { SlackApiClient } from './slack-api.client.js';
import { SlackCryptoService } from './slack-crypto.service.js';
import { FixedWindowRateLimiter } from './slack-rate-limiter.js';
import { buildAnswerBlocks, escapeSlackText } from './slack-mrkdwn.util.js';

export interface SlackCommandPayload {
  team_id: string;
  channel_id: string;
  user_id: string;
  text: string;
  response_url: string;
}

// Giới hạn theo workspace: mỗi /ask tốn 1 lần embedding + 1 lần LLM (quota Gemini). Hằng số ghi cứng, chưa ra env.
export const SLACK_ASK_LIMIT_PER_MINUTE = 15;
const MAX_QUESTION_CHARS = 2000; // khớp giới hạn của PublicQuerySchema.query
const QUESTION_TOP_K = 5;

const MSG_USAGE =
  'Cách dùng: `/ask <câu hỏi của bạn>` — ví dụ: `/ask Quy trình xin nghỉ phép là gì?`';
const MSG_TOO_LONG = `Câu hỏi quá dài (tối đa ${MAX_QUESTION_CHARS} ký tự).`;
const MSG_NOT_CONNECTED =
  'Workspace này chưa được kết nối với DocMind. Nhờ admin DocMind cài đặt tích hợp Slack.';
const MSG_BOT_NOT_IN_CHANNEL =
  'DocMind chưa vào được channel này. Với channel riêng tư, hãy mời bot: `/invite @DocMind` rồi thử lại.';
const MSG_GENERIC_ERROR =
  'DocMind gặp lỗi khi xử lý yêu cầu. Vui lòng thử lại sau.';
const MSG_ANSWER_ERROR =
  'Xin lỗi, DocMind gặp lỗi khi tìm câu trả lời. Vui lòng thử lại sau.';

@Injectable()
export class SlackCommandsService {
  private readonly logger = new Logger(SlackCommandsService.name);
  private readonly limiter = new FixedWindowRateLimiter(
    SLACK_ASK_LIMIT_PER_MINUTE,
    60_000,
  );

  constructor(
    // BYPASSRLS: request Slack không có JWT/tenant. Tra theo team_id của request ĐÃ XÁC THỰC chữ ký
    // (SlackSignatureGuard) để biết tenant; sau đó mọi truy vấn dữ liệu đi qua PublicQueryService với tenant đó.
    private readonly system: PrismaSystemService,
    private readonly crypto: SlackCryptoService,
    private readonly api: SlackApiClient,
    private readonly publicQuery: PublicQueryService,
  ) {}

  /** Không bao giờ throw — chạy nền sau khi đã ack, throw ở đây chỉ thành unhandled rejection. */
  async handle(cmd: SlackCommandPayload): Promise<void> {
    try {
      await this.process(cmd);
    } catch (err) {
      this.logger.error(
        `Unhandled error handling /ask (team ${cmd.team_id}, channel ${cmd.channel_id})`,
        err,
      );
      await this.tryEphemeral(cmd, MSG_GENERIC_ERROR);
    }
  }

  private async process(cmd: SlackCommandPayload): Promise<void> {
    const question = cmd.text.trim();
    if (!question) return this.ephemeral(cmd, MSG_USAGE);
    if (question.length > MAX_QUESTION_CHARS)
      return this.ephemeral(cmd, MSG_TOO_LONG);

    const limit = this.limiter.check(`team:${cmd.team_id}`);
    if (!limit.allowed) {
      return this.ephemeral(
        cmd,
        `Có quá nhiều câu hỏi trong thời gian ngắn. Thử lại sau khoảng ${limit.retryAfterSeconds} giây.`,
      );
    }

    const integration = await this.system.slackIntegration.findUnique({
      where: { slackTeamId: cmd.team_id },
    });
    if (!integration) return this.ephemeral(cmd, MSG_NOT_CONNECTED);

    const mapping = await this.system.slackChannelMapping.findUnique({
      where: {
        slackIntegrationId_slackChannelId: {
          slackIntegrationId: integration.id,
          slackChannelId: cmd.channel_id,
        },
      },
    });
    if (!mapping) {
      return this.ephemeral(
        cmd,
        `Channel này chưa được gán collection tài liệu nên chưa dùng được \`/ask\`. ` +
          `Nhờ admin DocMind gán qua \`PUT /slack/channels/${cmd.channel_id}\`.`,
      );
    }

    const token = this.crypto.decrypt(integration.accessToken);

    // Đăng câu hỏi làm message gốc: slash command không tự hiện trong channel, nên mọi người mới biết ai hỏi
    // gì; đồng thời cho ta `ts` để trả lời trong thread.
    const quoted = question
      .split('\n')
      .map((line) => `> ${escapeSlackText(line)}`)
      .join('\n');
    const posted = await this.api.postMessage(token, {
      channel: cmd.channel_id,
      text: `*<@${cmd.user_id}> hỏi:*\n${quoted}`,
    });
    if (!posted.ok || !posted.ts) {
      if (
        posted.error === 'not_in_channel' ||
        posted.error === 'channel_not_found'
      ) {
        return this.ephemeral(cmd, MSG_BOT_NOT_IN_CHANNEL);
      }
      this.logger.error(
        `chat.postMessage failed: ${posted.error ?? 'unknown'} (team ${cmd.team_id})`,
      );
      return this.ephemeral(cmd, MSG_GENERIC_ERROR);
    }

    let result;
    try {
      result = await this.publicQuery.query(
        { tenantId: integration.tenantId, collectionId: mapping.collectionId },
        { query: question, topK: QUESTION_TOP_K },
      );
    } catch (err) {
      this.logger.error(`RAG failed for /ask (team ${cmd.team_id})`, err);
      await this.api.postMessage(token, {
        channel: cmd.channel_id,
        thread_ts: posted.ts,
        text: MSG_ANSWER_ERROR,
      });
      return;
    }

    const { text, blocks } = buildAnswerBlocks(result.answer, result.citations);
    const reply = await this.api.postMessage(token, {
      channel: cmd.channel_id,
      thread_ts: posted.ts,
      text,
      blocks,
    });
    if (!reply.ok) {
      this.logger.error(
        `Posting answer failed: ${reply.error ?? 'unknown'} (team ${cmd.team_id})`,
      );
    }
  }

  private ephemeral(cmd: SlackCommandPayload, text: string): Promise<void> {
    return this.api.respondEphemeral(cmd.response_url, text);
  }

  /** Dùng ở nhánh lỗi cuối cùng: nếu cả việc báo lỗi cũng thất bại thì chỉ log, không ném tiếp. */
  private async tryEphemeral(
    cmd: SlackCommandPayload,
    text: string,
  ): Promise<void> {
    try {
      await this.ephemeral(cmd, text);
    } catch (err) {
      this.logger.warn(
        `Could not send ephemeral error message: ${String(err)}`,
      );
    }
  }
}
