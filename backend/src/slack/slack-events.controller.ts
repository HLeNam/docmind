// POST /slack/events — Slack Events API. Khai trong Slack App: Event Subscriptions -> Request URL =
// <PUBLIC_URL>/slack/events, subscribe bot event `app_mention`.
//
// Hai loại request:
//   - url_verification: Slack kiểm tra URL khi bạn lưu cấu hình -> phải trả lại đúng `challenge`.
//   - event_callback:   sự kiện thật -> ack 200 rỗng NGAY (Slack chỉ chờ 3 giây), xử lý nền.
// Cả hai đều được ký như slash command nên dùng chung SlackSignatureGuard. Dùng @Res() để bỏ qua
// envelope {success, data, meta} (Slack cần đúng `{challenge}` / body rỗng).
import {
  Body,
  Controller,
  Headers,
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
import { SlackEventsService } from './slack-events.service.js';
import { SlackEnvelopeSchema } from './schemas/slack-event.schema.js';
import type { SlackEnvelopeDto } from './dtos/slack-event.dto.js';

@ApiTags('slack')
@Controller('slack')
export class SlackEventsController {
  constructor(private readonly eventsService: SlackEventsService) {}

  @Public()
  @UseGuards(SlackSignatureGuard)
  @Post('events')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Slack Events API webhook endpoint (requires valid Slack signature)',
  })
  events(
    @Body({ schema: SlackEnvelopeSchema }) body: SlackEnvelopeDto,
    @Headers('x-slack-retry-num') retryNum: string | undefined,
    @Res() res: Response,
  ): void {
    if (body.type === 'url_verification' && body.challenge) {
      res.status(HttpStatus.OK).json({ challenge: body.challenge });
      return;
    }

    res.status(HttpStatus.OK).end();
    // Slack chỉ retry khi lần trước không nhận được ack kịp. Ta ack ngay và đã xử lý lần đầu rồi, nên bỏ
    // qua các lần retry (claimOnce theo event_id trong SlackEventsService là lớp bảo vệ thứ hai).
    if (retryNum) return;
    void this.eventsService.handle(body);
  }
}
