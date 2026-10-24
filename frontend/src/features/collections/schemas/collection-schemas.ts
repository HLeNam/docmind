import { z } from "zod";

export const createCollectionSchema = z.object({
  name: z
    .string()
    .min(1, "Tên bộ sưu tập không được để trống")
    .max(200, "Tên bộ sưu tập không vượt quá 200 ký tự"),
  description: z
    .string()
    .max(2000, "Mô tả không vượt quá 2000 ký tự")
    .optional(),
});

export type CreateCollectionFormData = z.infer<typeof createCollectionSchema>;

export interface CollectionResponse {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  createdAt: string;
}
