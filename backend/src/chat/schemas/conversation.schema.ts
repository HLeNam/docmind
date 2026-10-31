import { z } from 'zod';

export const ConversationIdSchema = z
  .string()
  .uuid('Invalid UUID format for id');

export const ListConversationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  // `nextCursor` của trang trước (id của hội thoại cuối cùng).
  cursor: z.string().uuid('Invalid UUID format for cursor').optional(),
  collectionId: z.string().uuid('Invalid UUID format for collectionId').optional(),
});

export const RenameConversationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title cannot be empty')
    .max(100, 'Title cannot exceed 100 characters'),
});

export const ListMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  // `nextBefore` của lần trước: lấy các tin CŨ HƠN tin có id này (cuộn ngược lên).
  before: z.string().uuid('Invalid UUID format for before').optional(),
});

// ── Response (dùng cho Swagger) ──
export const ConversationItemSchema = z.object({
  id: z.string(),
  collectionId: z.string().nullable().optional(),
  title: z
    .string()
    .nullable()
    .describe(
      'Null for legacy conversations created before automatic titling -> FE should use `preview`',
    ),
  createdAt: z.string(),
  lastMessageAt: z.string().nullable(),
  messageCount: z.number(),
  preview: z.string().nullable().describe('Snippet of the last message content'),
});
export const ConversationListResponseSchema = z.object({
  items: z.array(ConversationItemSchema),
  nextCursor: z.string().nullable().describe('Null when no more items exist'),
});

export const RenameConversationResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
});

export const DeleteConversationResponseSchema = z.object({
  id: z.string(),
  deleted: z.literal(true),
});

export const MessageItemSchema = z.object({
  id: z.string(),
  role: z.enum(['USER', 'ASSISTANT']),
  content: z.string(),
  citations: z
    .unknown()
    .nullable()
    .describe(
      'Only present on ASSISTANT messages: same shape as citations from SSE `start` event',
    ),
  createdAt: z.string(),
});
export const MessageListResponseSchema = z.object({
  items: z
    .array(MessageItemSchema)
    .describe('Chronological ascending order (oldest to newest)'),
  nextBefore: z
    .string()
    .nullable()
    .describe('Pass to `before` to fetch older messages; null when exhausted'),
});
