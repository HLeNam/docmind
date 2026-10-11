import { z } from 'zod';

export const SendMessageSchema = z.object({
  // Không truyền -> tạo Conversation mới ngay (không có endpoint POST /chat/conversations riêng —
  // đơn giản hoá MVP: gửi tin nhắn đầu tiên tự khởi tạo hội thoại, giống ChatGPT/Claude.ai).
  // Truyền -> PHẢI thuộc về caller (xem ChatService.resolveConversation, không tin input mù quáng).
  conversationId: z
    .string()
    .uuid('conversationId must be a valid UUID')
    .optional(),
  content: z
    .string()
    .min(1, 'content must not be empty')
    .max(4000, 'content is too long (maximum 4000 characters)'),
  // 2 field dưới forward thẳng vào RetrievalService.search() — cùng giới hạn như RetrievalSearchSchema.
  collectionId: z
    .string()
    .uuid('collectionId must be a valid UUID')
    .optional(),
  topK: z.coerce.number().int().min(1).max(20).default(5),
});
