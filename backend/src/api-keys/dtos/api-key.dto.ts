import { z } from 'zod';
import { CreateApiKeySchema } from '../schemas/api-key.schema.js';

export type CreateApiKeyDto = z.infer<typeof CreateApiKeySchema>;
