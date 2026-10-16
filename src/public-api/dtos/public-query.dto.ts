import { z } from 'zod';
import { PublicQuerySchema } from '../schemas/public-query.schema.js';

export type PublicQueryDto = z.infer<typeof PublicQuerySchema>;
