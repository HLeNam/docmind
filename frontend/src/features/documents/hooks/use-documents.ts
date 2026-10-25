import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentsApi } from "../api/documents-api";
import type {
  DocumentProgressEvent,
  DocumentResponse,
} from "../schemas/document-schemas";
import { getRealtimeSocket } from "@/lib/socket";

export function getDocumentsQueryKey(collectionId?: string) {
  return ["documents", { collectionId }] as const;
}

export function useDocuments(collectionId?: string) {
  return useQuery<DocumentResponse[], Error>({
    queryKey: getDocumentsQueryKey(collectionId),
    queryFn: () => documentsApi.list(collectionId),
    enabled: !!collectionId,
  });
}

export function useUploadDocument(collectionId: string) {
  const queryClient = useQueryClient();

  return useMutation<DocumentResponse, Error, File>({
    mutationFn: (file: File) => documentsApi.upload(collectionId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getDocumentsQueryKey(collectionId),
      });
    },
  });
}

export function useDeleteDocument(collectionId?: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getDocumentsQueryKey(collectionId),
      });
    },
  });
}

export function useReindexDocument(collectionId?: string) {
  const queryClient = useQueryClient();

  return useMutation<{ id: string; status: string }, Error, string>({
    mutationFn: (id: string) => documentsApi.reindex(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: getDocumentsQueryKey(collectionId),
      });
    },
  });
}

export function useDocumentRealtimeProgress(collectionId?: string) {
  const queryClient = useQueryClient();
  const [progressMap, setProgressMap] = useState<
    Record<string, DocumentProgressEvent>
  >({});

  const handleProgressEvent = useCallback(
    (event: DocumentProgressEvent) => {
      setProgressMap((prev) => ({
        ...prev,
        [event.documentId]: event,
      }));

      // When document processing completes or fails, invalidate queries so table shows new status
      if (event.phase === "completed" || event.phase === "failed") {
        queryClient.invalidateQueries({
          queryKey: getDocumentsQueryKey(collectionId),
        });
      }
    },
    [collectionId, queryClient]
  );

  useEffect(() => {
    const socket = getRealtimeSocket();

    socket.on("document.progress", handleProgressEvent);

    return () => {
      socket.off("document.progress", handleProgressEvent);
    };
  }, [handleProgressEvent]);

  const clearProgress = useCallback((documentId: string) => {
    setProgressMap((prev) => {
      const next = { ...prev };
      delete next[documentId];
      return next;
    });
  }, []);

  return {
    progressMap,
    clearProgress,
  };
}

export function useDocumentFile(documentId?: string | null) {
  return useQuery({
    queryKey: ["documents", "file", documentId],
    queryFn: () => documentsApi.getFile(documentId!),
    enabled: !!documentId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDocumentChunks(documentId?: string | null) {
  return useQuery({
    queryKey: ["documents", "chunks", documentId],
    queryFn: () => documentsApi.getChunks(documentId!),
    enabled: !!documentId,
    staleTime: 5 * 60 * 1000,
  });
}
