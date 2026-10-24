import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { collectionsApi } from "../api/collections-api";
import type {
  CollectionResponse,
  CreateCollectionFormData,
} from "../schemas/collection-schemas";

export const COLLECTIONS_QUERY_KEY = ["collections"] as const;

export function useCollections() {
  return useQuery<CollectionResponse[], Error>({
    queryKey: COLLECTIONS_QUERY_KEY,
    queryFn: () => collectionsApi.list(),
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation<CollectionResponse, Error, CreateCollectionFormData>({
    mutationFn: (dto) => collectionsApi.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY });
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id) => collectionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COLLECTIONS_QUERY_KEY });
    },
  });
}
