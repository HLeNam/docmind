import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ApiZodResponse } from '../common/swagger/api-zod-response.decorator.js';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator.js';
import type { AccessTokenPayload } from '../auth/auth.service.js';
import { SlackChannelsService } from './slack-channels.service.js';
import {
  ChannelMappingResponseSchema,
  MapChannelSchema,
} from './schemas/slack-channel.schema.js';
import type { MapChannelDto } from './dtos/slack-channel.dto.js';

@ApiTags('slack')
@ApiBearerAuth('access-token')
@Roles('OWNER', 'ADMIN')
@Controller('slack/channels')
export class SlackChannelsController {
  constructor(private readonly channelsService: SlackChannelsService) {}

  @Get()
  @ApiOperation({
    summary: 'List Slack channels mapped to DocMind collections',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'List of channel mappings',
    schema: z.array(ChannelMappingResponseSchema),
  })
  @ApiErrorResponse(
    HttpStatus.FORBIDDEN,
    'Forbidden: Requires OWNER or ADMIN role',
  )
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.channelsService.list(user);
  }

  // PUT (idempotent): gọi lại với collection khác = đổi mapping của channel đó.
  // channelId lấy trong Slack: chuột phải channel -> View channel details -> kéo xuống cuối, "Channel ID".
  @Put(':channelId')
  @ApiOperation({
    summary:
      'Map a Slack channel to a DocMind collection (channel can only query within this collection)',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Updated channel mapping',
    schema: ChannelMappingResponseSchema,
  })
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'Invalid Slack channel ID')
  @ApiErrorResponse(
    HttpStatus.FORBIDDEN,
    'Forbidden: Requires OWNER or ADMIN role',
  )
  @ApiErrorResponse(
    HttpStatus.NOT_FOUND,
    'Slack not connected or collection not found',
  )
  upsert(
    @CurrentUser() user: AccessTokenPayload,
    @Param('channelId') channelId: string,
    @Body({ schema: MapChannelSchema }) dto: MapChannelDto,
  ) {
    return this.channelsService.upsert(user, channelId, dto.collectionId);
  }

  @Delete(':channelId')
  @ApiOperation({
    summary:
      'Unmap a Slack channel from its collection (/ask will be disabled for this channel)',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Successfully unmapped',
    schema: z.object({ channelId: z.string(), mapped: z.literal(false) }),
  })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'Channel is not mapped')
  remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('channelId') channelId: string,
  ) {
    return this.channelsService.remove(user, channelId);
  }
}
