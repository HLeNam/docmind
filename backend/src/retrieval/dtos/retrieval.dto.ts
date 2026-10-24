import { z } from 'zod';
import { RetrievalSearchSchema } from '../schemas/retrieval.schema.js';

export type RetrievalSearchDto = z.infer<typeof RetrievalSearchSchema>;
