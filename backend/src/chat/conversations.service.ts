// Quản lý lịch sử hội thoại cho sidebar chat: liệt kê, đổi tên, đọc tin nhắn.
// Hội thoại là RIÊNG TƯ của từng thành viên (xem ChatService.resolveConversation): chỉ chủ sở hữu (membershipId)
// thấy/sửa được, kể cả OWNER/ADMIN. Không phải của mình HOẶC không tồn tại đều trả 404 giống nhau — không lộ
// việc id đó có thật hay không.
import { Injectable } from '@nestjs/common';
import { NotFoundAppException } from '../common/exceptions/app.exception.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AccessTokenPayload } from '../auth/auth.service.js';
import type {
  ListConversationsQueryDto,
  ListMessagesQueryDto,
  RenameConversationDto,
} from './dtos/conversation.dto.js';

export const PREVIEW_MAX_CHARS = 120;

function ensureOwned<T extends { membershipId: string }>(
  conversation: T | null,
  caller: Pick<AccessTokenPayload, 'membershipId'>,
): T {
  if (!conversation || conversation.membershipId !== caller.membershipId) {
    throw new NotFoundAppException('Conversation not found');
  }
  return conversation;
}

function preview(content: string): string {
  const flat = content.replace(/\s+/g, ' ').trim();
  const chars = Array.from(flat);
  return chars.length <= PREVIEW_MAX_CHARS
    ? flat
    : `${chars
        .slice(0, PREVIEW_MAX_CHARS - 1)
        .join('')
        .trimEnd()}…`;
}

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mới tạo nhất trước. Phân trang bằng cursor (id) nên không bị lệch khi có hội thoại mới chen vào. */
  async list(caller: AccessTokenPayload, query: ListConversationsQueryDto) {
    const rows = await this.prisma.runInTenantContext(caller.tenantId, (tx) =>
      tx.conversation.findMany({
        where: { membershipId: caller.membershipId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1, // lấy dư 1 dòng để biết còn trang sau hay không
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { content: true, createdAt: true },
          },
          _count: { select: { messages: true } },
        },
      }),
    );

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: page.map((c) => {
        const last = c.messages[0];
        return {
          id: c.id,
          title: c.title,
          createdAt: c.createdAt.toISOString(),
          lastMessageAt: last ? last.createdAt.toISOString() : null,
          messageCount: c._count.messages,
          preview: last ? preview(last.content) : null,
        };
      }),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    };
  }

  async rename(
    caller: AccessTokenPayload,
    id: string,
    dto: RenameConversationDto,
  ) {
    return this.prisma.runInTenantContext(caller.tenantId, async (tx) => {
      ensureOwned(await tx.conversation.findUnique({ where: { id } }), caller);
      const updated = await tx.conversation.update({
        where: { id },
        data: { title: dto.title },
      });
      return { id: updated.id, title: dto.title };
    });
  }

  /**
   * Xoá hẳn hội thoại của chính mình. Tin nhắn và feedback đi kèm bị xoá theo (onDelete: Cascade trong schema).
   * Một câu `deleteMany` lọc theo cả id lẫn membershipId: kiểm tra quyền sở hữu và xoá là MỘT thao tác nguyên tử, nên
   * không có khoảng hở giữa "kiểm tra" và "xoá" (2 request xoá cùng lúc: một cái 200, cái kia 404, không có 500).
   * Không phải của mình HOẶC không tồn tại -> 404 giống nhau.
   */
  async remove(caller: AccessTokenPayload, id: string) {
    const { count } = await this.prisma.runInTenantContext(
      caller.tenantId,
      (tx) =>
        tx.conversation.deleteMany({
          where: { id, membershipId: caller.membershipId },
        }),
    );
    if (count === 0) throw new NotFoundAppException('Conversation not found');
    return { id, deleted: true };
  }

  /** Trả `limit` tin MỚI NHẤT (hoặc cũ hơn `before`), sắp theo thời gian TĂNG dần để FE hiển thị luôn. */
  async listMessages(
    caller: AccessTokenPayload,
    id: string,
    query: ListMessagesQueryDto,
  ) {
    const rows = await this.prisma.runInTenantContext(
      caller.tenantId,
      async (tx) => {
        ensureOwned(
          await tx.conversation.findUnique({ where: { id } }),
          caller,
        );
        return tx.message.findMany({
          where: { conversationId: id },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: query.limit + 1,
          ...(query.before ? { cursor: { id: query.before }, skip: 1 } : {}),
        });
      },
    );

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: page
        .map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          citations: m.citations ?? null,
          createdAt: m.createdAt.toISOString(),
        }))
        .reverse(),
      nextBefore: hasMore ? page[page.length - 1]!.id : null,
    };
  }
}
