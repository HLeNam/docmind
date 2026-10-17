// Map channel Slack <-> collection DocMind (bảng SlackChannelMapping). Đây là RÀO CHẮN QUYỀN của /ask:
// người dùng Slack không phải user DocMind (không có JWT/membership), nên chỉ channel nào admin đã gán
// collection mới được hỏi, và chỉ trong collection đó. Channel chưa gán thì /ask từ chối.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AccessTokenPayload } from '../auth/auth.service.js';
import {
  NotFoundAppException,
  ValidationAppException,
} from '../common/exceptions/app.exception.js';
import { ErrorCode } from '../common/exceptions/error-codes.js';

// ID channel Slack: C... (public) hoặc G... (private/group), chữ hoa + số. DM (D...) không hỗ trợ.
const CHANNEL_ID_RE = /^[CG][A-Z0-9]{6,20}$/;

export interface ChannelMappingView {
  channelId: string;
  collectionId: string;
  collectionName: string;
}

@Injectable()
export class SlackChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(caller: AccessTokenPayload): Promise<ChannelMappingView[]> {
    return this.prisma.runInTenantContext(caller.tenantId, async (tx) => {
      const integration = await tx.slackIntegration.findUnique({
        where: { tenantId: caller.tenantId },
      });
      if (!integration) return []; // chưa kết nối Slack thì chưa có mapping nào, không phải lỗi
      const rows = await tx.slackChannelMapping.findMany({
        where: { slackIntegrationId: integration.id },
        include: { collection: { select: { name: true } } },
        orderBy: { slackChannelId: 'asc' },
      });
      return rows.map((r) => ({
        channelId: r.slackChannelId,
        collectionId: r.collectionId,
        collectionName: r.collection.name,
      }));
    });
  }

  /** Gán (hoặc đổi) collection cho 1 channel. Gọi lại với collection khác = đổi mapping. */
  async upsert(
    caller: AccessTokenPayload,
    channelId: string,
    collectionId: string,
  ): Promise<ChannelMappingView> {
    this.assertChannelId(channelId);

    return this.prisma.runInTenantContext(caller.tenantId, async (tx) => {
      const integration = await tx.slackIntegration.findUnique({
        where: { tenantId: caller.tenantId },
      });
      if (!integration) {
        throw new NotFoundAppException(
          'Slack is not connected',
          ErrorCode.SLACK_NOT_CONNECTED,
        );
      }

      // RLS của collections: collection thuộc tenant khác sẽ trả null, không cần tự so tenantId.
      const collection = await tx.collection.findUnique({
        where: { id: collectionId },
        select: { id: true, name: true },
      });
      if (!collection) {
        throw new NotFoundAppException(
          'Collection not found',
          ErrorCode.COLLECTION_NOT_FOUND,
        );
      }

      await tx.slackChannelMapping.upsert({
        where: {
          slackIntegrationId_slackChannelId: {
            slackIntegrationId: integration.id,
            slackChannelId: channelId,
          },
        },
        create: {
          slackIntegrationId: integration.id,
          slackChannelId: channelId,
          collectionId,
        },
        update: { collectionId },
      });
      return { channelId, collectionId, collectionName: collection.name };
    });
  }

  async remove(
    caller: AccessTokenPayload,
    channelId: string,
  ): Promise<{ channelId: string; mapped: false }> {
    this.assertChannelId(channelId);

    await this.prisma.runInTenantContext(caller.tenantId, async (tx) => {
      const integration = await tx.slackIntegration.findUnique({
        where: { tenantId: caller.tenantId },
      });
      const mapping = integration
        ? await tx.slackChannelMapping.findUnique({
            where: {
              slackIntegrationId_slackChannelId: {
                slackIntegrationId: integration.id,
                slackChannelId: channelId,
              },
            },
          })
        : null;
      if (!mapping) {
        throw new NotFoundAppException(
          'Channel is not mapped',
          ErrorCode.SLACK_CHANNEL_NOT_MAPPED,
        );
      }
      await tx.slackChannelMapping.delete({ where: { id: mapping.id } });
    });
    return { channelId, mapped: false };
  }

  private assertChannelId(channelId: string): void {
    if (!CHANNEL_ID_RE.test(channelId)) {
      throw new ValidationAppException(
        'Invalid Slack channel id (expected something like C0123ABCDEF)',
        undefined,
        ErrorCode.SLACK_CHANNEL_ID_INVALID,
      );
    }
  }
}
