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
  instructions: z
    .string()
    .max(5000, "Hướng dẫn không vượt quá 5000 ký tự")
    .optional(),
});

export const updateCollectionSchema = z.object({
  name: z
    .string()
    .min(1, "Tên bộ sưu tập không được để trống")
    .max(200, "Tên bộ sưu tập không vượt quá 200 ký tự")
    .optional(),
  description: z
    .string()
    .max(2000, "Mô tả không vượt quá 2000 ký tự")
    .optional(),
  instructions: z
    .string()
    .max(5000, "Hướng dẫn không vượt quá 5000 ký tự")
    .optional(),
});

export type CreateCollectionFormData = z.infer<typeof createCollectionSchema>;
export type UpdateCollectionFormData = z.infer<typeof updateCollectionSchema>;

export interface CollectionResponse {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  instructions?: string | null;
  createdAt: string;
  updatedAt?: string;
  _count?: {
    documents: number;
    conversations?: number;
  };
}
