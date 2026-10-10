import { z } from 'zod';

export const CreateCollectionSchema = z.object({
  name: z.string().min(1, 'Collection name must not be empty').max(200),
  description: z.string().max(2000).optional(),
});
