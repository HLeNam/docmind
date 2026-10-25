import { useQuery } from "@tanstack/react-query";
import { conversationsApi } from "../api/conversations-api";
import type { MessageListResponse } from "../schemas/conversation-schemas";

export function getMessagesQueryKey(conversationId: string | null) {
  return ["chat", "messages", conversationId] as const;
}

export function useChatMessages(conversationId: string | null, before?: string) {
  return useQuery<MessageListResponse, Error>({
    queryKey: [...getMessagesQueryKey(conversationId), { before }],
    queryFn: () => {
      if (!conversationId) {
        return Promise.resolve({ items: [], nextBefore: null });
      }
      return conversationsApi.listMessages(conversationId, before);
    },
    enabled: !!conversationId,
  });
}
