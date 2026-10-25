import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { conversationsApi } from "../api/conversations-api";
import type {
  ConversationListResponse,
  DeleteConversationResponse,
  RenameConversationPayload,
} from "../schemas/conversation-schemas";

export const CONVERSATIONS_QUERY_KEY = ["conversations"] as const;

export function useConversations(cursor?: string, limit = 50) {
  return useQuery<ConversationListResponse, Error>({
    queryKey: [...CONVERSATIONS_QUERY_KEY, { cursor, limit }],
    queryFn: () => conversationsApi.list(cursor, limit),
  });
}

export function useRenameConversation() {
  const queryClient = useQueryClient();

  return useMutation<{ id: string; title: string }, Error, { id: string; dto: RenameConversationPayload }>({
    mutationFn: ({ id, dto }) => conversationsApi.rename(id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation<DeleteConversationResponse, Error, string>({
    mutationFn: (id) => conversationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_QUERY_KEY });
    },
  });
}
