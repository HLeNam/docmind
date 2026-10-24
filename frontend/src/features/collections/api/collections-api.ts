import { apiClient } from "@/lib/api-client";
import type {
  CollectionResponse,
  CreateCollectionFormData,
} from "../schemas/collection-schemas";

export const collectionsApi = {
  async list(): Promise<CollectionResponse[]> {
    return apiClient<CollectionResponse[]>("/collections");
  },

  async create(dto: CreateCollectionFormData): Promise<CollectionResponse> {
    return apiClient<CollectionResponse>("/collections", {
      method: "POST",
      body: dto,
    });
  },

  async delete(id: string): Promise<void> {
    return apiClient<void>(`/collections/${id}`, {
      method: "DELETE",
    });
  },
};
