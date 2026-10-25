import { z } from "zod";

export const createApiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Tên khóa API không được để trống")
    .max(100, "Tên khóa API tối đa 100 ký tự"),
  collectionId: z.string().uuid("Collection ID không hợp lệ").optional().or(z.literal("")),
});

export type CreateApiKeyFormData = z.infer<typeof createApiKeySchema>;

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  collectionId: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface ApiKeyCreatedResponse extends ApiKeyItem {
  key: string;
}