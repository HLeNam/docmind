import type { ChatCitation } from "./chat-schemas";

export interface ConversationItem {
  id: string;
  title: string | null;
  createdAt: string;
  lastMessageAt: string | null;
  messageCount: number;
  preview: string | null;
}

export interface ConversationListResponse {
  items: ConversationItem[];
  nextCursor: string | null;
}

export interface MessageItem {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  citations: ChatCitation[] | null;
  createdAt: string;
}

export interface MessageListResponse {
  items: MessageItem[];
  nextBefore: string | null;
}

export interface RenameConversationPayload {
  title: string;
}

export interface DeleteConversationResponse {
  id: string;
  deleted: true;
}
