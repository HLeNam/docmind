// POST /slack/commands — nơi Slack gửi slash command (/ask). Khai trong Slack App: Slash Commands ->
// Request URL = <PUBLIC_URL>/slack/commands.
//
// Dùng @Res() để ack bằng 200 với body RỖNG: Slack hiểu "đã nhận, tôi sẽ trả lời sau". Nếu để Nest tự trả,
// global interceptor sẽ bọc thành envelope JSON {success, data, meta} — Slack coi đó là "response" của lệnh
// và có thể hiện nội dung lạ cho người dùng.
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { SlackSignatureGuard } from './slack-signature.guard.js';
import { SlackCommandsService } from './slack-commands.service.js';
import { SlackCommandSchema } from './schemas/slack-command.schema.js';
import type { SlackCommandDto } from './dtos/slack-command.dto.js';

@ApiTags('slack')
@Controller('slack')
export class SlackCommandsController {
  constructor(private readonly commandsService: SlackCommandsService) {}

  // @Public(): Slack không có JWT. Bảo vệ bằng chữ ký (SlackSignatureGuard) — guard chạy TRƯỚC khi body
  // được validate, nên request giả mạo bị chặn ngay ở đây.
  @Public()
  @UseGuards(SlackSignatureGuard)
  @Post('commands')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Slack webhook endpoint for /ask slash command (requires valid Slack signature)',
  })
  command(
    @Body({ schema: SlackCommandSchema }) body: SlackCommandDto,
    @Res() res: Response,
  ): void {
    // Ack trước, xử lý sau: handle() không bao giờ throw nên `void` là an toàn.
    res.status(HttpStatus.OK).end();
    void this.commandsService.handle(body);
  }
}
