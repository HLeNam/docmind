// src/chat/chat.controller.ts
//
// Dùng @Res() thủ công (KHÔNG @Sse() built-in của Nest) — lý do: @Sse() bọc mỗi event qua RxJS
// Observable<MessageEvent> với 1 loại "event" cố định, trong khi ở đây cần tự kiểm soát 3 loại event
// khác nhau (start/delta/error/done) VÀ phải validate xong (ném lỗi JSON chuẩn qua
// GlobalExceptionFilter) TRƯỚC khi chuyển sang chế độ streaming — @Res() cho toàn quyền kiểm soát
// thời điểm set header, điều @Sse() không cho phép tách rời rõ ràng như vậy.
//
// ⚠️ Dùng @Res() nghĩa là Nest KHÔNG tự bọc response qua interceptor chung của app (cái bọc
// {success, data, meta} thấy ở mọi response JSON khác, vd response RetrievalController) — đây là
// HÀNH VI CHỦ Ý, SSE không thể/không nên bọc JSON envelope như vậy.
import { Body, Controller, HttpStatus, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AccessTokenPayload } from '../auth/auth.service.js';
import { ChatService } from './chat.service.js';
import { SendMessageSchema } from './schemas/chat.schema.js';
import { type SendMessageDto } from './dtos/chat.dto.js';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator.js';

@ApiTags('chat')
@ApiBearerAuth('access-token')
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('messages')
  @ApiProduces('text/event-stream')
  @ApiOperation({
    summary:
      'Send chat message and stream response via SSE (RAG via RetrievalService). Response does not follow standard JSON envelope.',
  })
  @ApiErrorResponse(
    HttpStatus.NOT_FOUND,
    'Conversation not found or access denied.',
  )
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Invalid message payload or collection ID.',
  )
  async sendMessage(
    @CurrentUser() user: AccessTokenPayload,
    @Body({ schema: SendMessageSchema }) dto: SendMessageDto,
    @Res() res: Response,
  ): Promise<void> {
    // Chạy TRƯỚC khi set header SSE — nếu throw (vd conversationId không thuộc về caller),
    // GlobalExceptionFilter xử lý bình thường như mọi route khác, trả đúng status code + JSON error.
    const prepared = await this.chatService.prepare(user, dto);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Một số proxy (nginx) mặc định buffer response — header này tắt buffering phía nginx cho đúng
    // route này, không ảnh hưởng gì nếu không chạy sau nginx (vd dev local).
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const writeEvent = (event: string, data: unknown): void => {
      res.write(`event: ${event}\n`);
      res.write(
        `data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`,
      );
    };

    // Gửi citations NGAY khi bắt đầu (trước khi có text nào) — FE có thể hiển thị "đang tham khảo
    // N nguồn" trong lúc chờ LLM sinh chữ, không cần đợi tới event 'done' mới biết có citation hay không.
    writeEvent('start', {
      conversationId: prepared.conversationId,
      citations: prepared.citations,
    });

    let fullAnswer = '';
    try {
      for await (const delta of this.chatService.streamAnswer(prepared)) {
        fullAnswer += delta;
        writeEvent('delta', delta);
      }
    } catch (err) {
      // Header "200 OK" đã gửi từ trước — KHÔNG thể đổi status code ở đây nữa, chỉ có thể báo lỗi
      // qua chính luồng SSE bằng 1 event riêng để FE tự xử lý (hiện thông báo lỗi, cho thử lại...).
      const message =
        err instanceof Error
          ? err.message
          : 'Unknown error during LLM generation';
      writeEvent('error', { message });
      res.end();
      return;
    }

    // Chỉ lưu Message của assistant SAU KHI stream xong TRỌN VẸN — nếu lỗi giữa chừng (nhánh catch ở
    // trên), KHÔNG lưu câu trả lời dang dở vào lịch sử hội thoại.
    const saved = await this.chatService.saveAssistantMessage(
      user,
      prepared,
      fullAnswer,
    );
    writeEvent('done', { messageId: saved.id });
    res.end();
  }
}
