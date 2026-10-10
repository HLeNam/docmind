import { z } from 'zod';

export const CreateCollectionSchema = z.object({
  name: z.string().min(1, 'Collection name must not be empty').max(200),
  description: z.string().max(2000).optional(),
});

export const CollectionResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.date(),
});
