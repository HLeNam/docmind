import { z } from 'zod';
import { SlackEnvelopeSchema } from '../schemas/slack-event.schema.js';

export type SlackEnvelopeDto = z.infer<typeof SlackEnvelopeSchema>;
