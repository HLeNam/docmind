// Lịch sử hội thoại cho sidebar chat. Mọi member đã đăng nhập đều dùng được cho hội thoại CỦA MÌNH (không @Roles).
// Tách khỏi ChatController (SSE, dùng @Res()) vì các route này là JSON thường, đi qua envelope {success, data, meta}.
import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ApiZodResponse } from '../common/swagger/api-zod-response.decorator.js';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator.js';
import type { AccessTokenPayload } from '../auth/auth.service.js';
import { ConversationsService } from './conversations.service.js';
import {
  ConversationIdSchema,
  ConversationListResponseSchema,
  ListConversationsQuerySchema,
  ListMessagesQuerySchema,
  MessageListResponseSchema,
  RenameConversationResponseSchema,
  RenameConversationSchema,
} from './schemas/conversation.schema.js';
import {
  type ListConversationsQueryDto,
  type ListMessagesQueryDto,
  type RenameConversationDto,
} from './dtos/conversation.dto.js';

@ApiTags('chat')
@ApiBearerAuth('access-token')
@Controller('chat/conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List my conversations (newest first), paginated by cursor',
  })
  @ApiZodResponse({
    status: 200,
    description: 'A page of conversation items',
    schema: ConversationListResponseSchema,
  })
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query({ schema: ListConversationsQuerySchema })
    query: ListConversationsQueryDto,
  ) {
    return this.conversations.list(user, query);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename conversation' })
  @ApiZodResponse({
    status: 200,
    description: 'Updated conversation title',
    schema: RenameConversationResponseSchema,
  })
  @ApiErrorResponse(404, 'Conversation not found or access denied')
  rename(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', { schema: ConversationIdSchema }) id: string,
    @Body({ schema: RenameConversationSchema }) dto: RenameConversationDto,
  ) {
    return this.conversations.rename(user, id, dto);
  }

  @Get(':id/messages')
  @ApiOperation({
    summary:
      'Messages of a conversation: latest page first, scroll upwards using `before`',
  })
  @ApiZodResponse({
    status: 200,
    description:
      'A page of messages ordered chronologically (oldest to newest)',
    schema: MessageListResponseSchema,
  })
  @ApiErrorResponse(404, 'Conversation not found or access denied')
  messages(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', { schema: ConversationIdSchema }) id: string,
    @Query({ schema: ListMessagesQuerySchema }) query: ListMessagesQueryDto,
  ) {
    return this.conversations.listMessages(user, id, query);
  }
}
