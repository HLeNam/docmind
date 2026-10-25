import { apiClient } from "@/lib/api-client";
import type {
  ApiKeyCreatedResponse,
  ApiKeyItem,
  CreateApiKeyFormData,
} from "../schemas/api-key-schemas";

export const apiKeysApi = {
  async list(): Promise<ApiKeyItem[]> {
    return apiClient<ApiKeyItem[]>("/api-keys");
  },

  async create(dto: CreateApiKeyFormData): Promise<ApiKeyCreatedResponse> {
    const payload = {
      name: dto.name.trim(),
      ...(dto.collectionId ? { collectionId: dto.collectionId } : {}),
    };
    return apiClient<ApiKeyCreatedResponse>("/api-keys", {
      method: "POST",
      body: payload,
    });
  },

  async revoke(id: string): Promise<ApiKeyItem> {
    return apiClient<ApiKeyItem>(`/api-keys/${id}`, {
      method: "DELETE",
    });
  },
};