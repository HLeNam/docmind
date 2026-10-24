import { z } from 'zod';
import { SlackCommandSchema } from '../schemas/slack-command.schema.js';

export type SlackCommandDto = z.infer<typeof SlackCommandSchema>;
