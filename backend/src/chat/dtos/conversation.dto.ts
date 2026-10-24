import { z } from 'zod';
import {
  ListConversationsQuerySchema,
  ListMessagesQuerySchema,
  RenameConversationSchema,
} from '../schemas/conversation.schema.js';

export type ListConversationsQueryDto = z.infer<
  typeof ListConversationsQuerySchema
>;

export type RenameConversationDto = z.infer<typeof RenameConversationSchema>;

export type ListMessagesQueryDto = z.infer<typeof ListMessagesQuerySchema>;
