import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiKeysApi } from "../api/api-keys-api";
import type {
  ApiKeyCreatedResponse,
  ApiKeyItem,
  CreateApiKeyFormData,
} from "../schemas/api-key-schemas";

export const API_KEYS_QUERY_KEY = ["settings", "api-keys"];

export function useApiKeys() {
  return useQuery<ApiKeyItem[], Error>({
    queryKey: API_KEYS_QUERY_KEY,
    queryFn: () => apiKeysApi.list(),
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation<ApiKeyCreatedResponse, Error, CreateApiKeyFormData>({
    mutationFn: (dto) => apiKeysApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();

  return useMutation<ApiKeyItem, Error, string>({
    mutationFn: (id) => apiKeysApi.revoke(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: API_KEYS_QUERY_KEY });
    },
  });
}