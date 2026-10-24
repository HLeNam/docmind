import { z } from 'zod';

export const SlackEnvelopeSchema = z
  .object({
    type: z
      .string()
      .describe(
        'Slack event envelope type (e.g. url_verification, event_callback)',
      ),
    challenge: z
      .string()
      .optional()
      .describe('Challenge token for url_verification'),
  })
  .passthrough();
