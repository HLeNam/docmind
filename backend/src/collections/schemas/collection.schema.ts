import { z } from 'zod';

export const CreateCollectionSchema = z.object({
  name: z.string().min(1, 'Collection name must not be empty').max(200),
  description: z.string().max(2000).optional(),
  instructions: z.string().max(5000).optional(),
});

export const UpdateCollectionSchema = z.object({
  name: z.string().min(1, 'Collection name must not be empty').max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  instructions: z.string().max(5000).nullable().optional(),
});

export const CollectionResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  instructions: z.string().nullable().optional(),
  createdAt: z.date(),
  _count: z
    .object({
      documents: z.number(),
      conversations: z.number().optional(),
    })
    .optional(),
});
