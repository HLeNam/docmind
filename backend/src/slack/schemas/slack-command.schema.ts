import { z } from 'zod';

export const SlackCommandSchema = z.object({
  team_id: z.string().min(1).describe('Slack team / workspace ID'),
  channel_id: z.string().min(1).describe('Slack channel ID where command was invoked'),
  user_id: z.string().min(1).describe('Slack user ID who invoked the command'),
  text: z.string().default('').describe('Command arguments / question text'),
  response_url: z.string().url().describe('Slack ephemeral response webhook URL'),
});
