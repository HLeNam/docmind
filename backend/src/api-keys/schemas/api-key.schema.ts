import { z } from 'zod';

export const CreateApiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'API key name must not be empty')
    .max(100, 'API key name must be at most 100 characters'),
  // Bỏ trống = key có scope TOÀN BỘ tenant (khớp ApiKey.collectionId nullable trong schema.prisma).
  collectionId: z.string().uuid('collectionId must be a valid UUID').optional(),
});
