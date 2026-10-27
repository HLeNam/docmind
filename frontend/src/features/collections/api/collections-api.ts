import { apiClient } from "@/lib/api-client";
import type {
  CollectionResponse,
  CreateCollectionFormData,
  UpdateCollectionFormData,
} from "../schemas/collection-schemas";

export const collectionsApi = {
  async list(): Promise<CollectionResponse[]> {
    return apiClient<CollectionResponse[]>("/collections");
  },

  async getById(id: string): Promise<CollectionResponse> {
    return apiClient<CollectionResponse>(`/collections/${id}`);
  },

  async create(dto: CreateCollectionFormData): Promise<CollectionResponse> {
    return apiClient<CollectionResponse>("/collections", {
      method: "POST",
      body: dto,
    });
  },

  async update(id: string, dto: UpdateCollectionFormData): Promise<CollectionResponse> {
    return apiClient<CollectionResponse>(`/collections/${id}`, {
      method: "PATCH",
      body: dto,
    });
  },

  async delete(id: string): Promise<void> {
    return apiClient<void>(`/collections/${id}`, {
      method: "DELETE",
    });
  },
};
