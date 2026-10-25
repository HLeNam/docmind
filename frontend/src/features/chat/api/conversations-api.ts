import { apiClient } from "@/lib/api-client";
import type {
  ConversationListResponse,
  DeleteConversationResponse,
  MessageListResponse,
  RenameConversationPayload,
} from "../schemas/conversation-schemas";

export const conversationsApi = {
  async list(cursor?: string, limit = 20): Promise<ConversationListResponse> {
    const params: Record<string, string | number> = { limit };
    if (cursor) params.cursor = cursor;
    return apiClient<ConversationListResponse>("/chat/conversations", {
      params,
    });
  },

  async rename(
    id: string,
    dto: RenameConversationPayload
  ): Promise<{ id: string; title: string }> {
    return apiClient<{ id: string; title: string }>(
      `/chat/conversations/${id}`,
      {
        method: "PATCH",
        body: dto,
      }
    );
  },

  async delete(id: string): Promise<DeleteConversationResponse> {
    return apiClient<DeleteConversationResponse>(`/chat/conversations/${id}`, {
      method: "DELETE",
    });
  },

  async listMessages(
    id: string,
    before?: string,
    limit = 50
  ): Promise<MessageListResponse> {
    const params: Record<string, string | number> = { limit };
    if (before) params.before = before;
    return apiClient<MessageListResponse>(
      `/chat/conversations/${id}/messages`,
      {
        params,
      }
    );
  },
};
