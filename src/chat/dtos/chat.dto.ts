import { z } from 'zod';
import { SendMessageSchema } from '../schemas/chat.schema.js';

export type SendMessageDto = z.infer<typeof SendMessageSchema>;
