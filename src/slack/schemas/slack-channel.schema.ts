import { z } from 'zod';

export const MapChannelSchema = z.object({
  collectionId: z.string().uuid('collectionId must be a valid UUID'),
});

export const ChannelMappingResponseSchema = z.object({
  channelId: z.string().describe('Slack channel ID (e.g. C0123ABCDEF)'),
  collectionId: z.string().uuid().describe('Mapped DocMind collection ID'),
  collectionName: z.string().describe('Mapped DocMind collection name'),
});
