import { z } from 'zod';
import { MapChannelSchema } from '../schemas/slack-channel.schema.js';

export type MapChannelDto = z.infer<typeof MapChannelSchema>;
