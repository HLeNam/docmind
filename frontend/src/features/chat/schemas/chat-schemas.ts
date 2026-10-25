import { z } from "zod";

export interface ChatCitation {
  index: number;
  documentId: string;
  filename: string;
  chunkIndex: number;
  pageNumber: number | null;
  headingContext: string | null;
  score: number;
}

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  content: z.string().min(1, "Nội dung câu hỏi không được để trống").max(4000),
  collectionId: z.string().uuid().optional(),
  topK: z.number().int().min(1).max(20).optional(),
});

export type SendMessagePayload = z.infer<typeof sendMessageSchema>;

export interface StreamStartPayload {
  conversationId: string;
  citations: ChatCitation[];
  rewrittenQuery: string | null;
}

export interface StreamDonePayload {
  messageId: string;
}

export interface StreamErrorPayload {
  message: string;
}

export type SseChatEvent =
  | { type: "start"; data: StreamStartPayload }
  | { type: "delta"; data: string }
  | { type: "done"; data: StreamDonePayload }
  | { type: "error"; data: StreamErrorPayload };
