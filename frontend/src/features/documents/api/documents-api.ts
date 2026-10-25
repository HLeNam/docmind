import { apiClient, apiFetchBlob, type BlobResult } from "@/lib/api-client";
import type {
  DocumentChunk,
  DocumentResponse,
  DocumentStatusResponse,
} from "../schemas/document-schemas";

export const documentsApi = {
  async list(collectionId?: string): Promise<DocumentResponse[]> {
    const endpoint = collectionId
      ? `/documents?collectionId=${encodeURIComponent(collectionId)}`
      : "/documents";
    return apiClient<DocumentResponse[]>(endpoint);
  },

  async upload(collectionId: string, file: File): Promise<DocumentResponse> {
    const formData = new FormData();
    formData.append("file", file);

    return apiClient<DocumentResponse>(
      `/documents?collectionId=${encodeURIComponent(collectionId)}`,
      {
        method: "POST",
        body: formData,
      }
    );
  },

  async getStatus(id: string): Promise<DocumentStatusResponse> {
    return apiClient<DocumentStatusResponse>(`/documents/${id}/status`);
  },

  async getFile(id: string): Promise<BlobResult> {
    return apiFetchBlob(`/documents/${id}/file`);
  },

  async getChunks(id: string): Promise<DocumentChunk[]> {
    return apiClient<DocumentChunk[]>(`/documents/${id}/chunks`);
  },

  async reindex(id: string): Promise<{ id: string; status: string }> {
    return apiClient<{ id: string; status: string }>(`/documents/${id}/reindex`, {
      method: "POST",
    });
  },

  async delete(id: string): Promise<void> {
    return apiClient<void>(`/documents/${id}`, {
      method: "DELETE",
    });
  },
};
