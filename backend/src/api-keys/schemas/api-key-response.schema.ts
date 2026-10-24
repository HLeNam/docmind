import { z } from 'zod';

// Dùng cho GET /api-keys và DELETE /api-keys/:id — KHÔNG bao giờ có keyHash hay key gốc.
export const ApiKeyResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
  collectionId: z.string().nullable(),
  createdAt: z.string(),
  revokedAt: z.string().nullable(),
});

export const ApiKeyListResponseSchema = z.array(ApiKeyResponseSchema);

// Chỉ POST /api-keys trả thêm `key` — đây là LẦN DUY NHẤT user thấy key gốc.
export const ApiKeyCreatedResponseSchema = ApiKeyResponseSchema.extend({
  key: z
    .string()
    .describe(
      'Raw API key, displayed only once upon creation — cannot be retrieved later',
    ),
});
