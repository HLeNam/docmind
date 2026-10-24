import z from 'zod';

import { CreateCollectionSchema } from '../schemas/collection.schema.js';

export type CreateCollectionDto = z.infer<typeof CreateCollectionSchema>;
