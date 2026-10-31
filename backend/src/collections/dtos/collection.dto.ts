import { z } from 'zod';
import {
  CreateCollectionSchema,
  UpdateCollectionSchema,
} from '../schemas/collection.schema.js';

export type CreateCollectionDto = z.infer<typeof CreateCollectionSchema>;
export type UpdateCollectionDto = z.infer<typeof UpdateCollectionSchema>;
