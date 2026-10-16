// Endpoint công khai xác thực bằng API key (prefix /v1).
//  - POST /v1/query         : trả JSON 1 lần (envelope {success, data, meta} như mọi route JSON).
//  - POST /v1/query/stream  : trả SSE streaming. Dùng @Res() thủ công nên KHÔNG có envelope JSON — cùng
//                             lý do và cùng định dạng với ChatController (xem chat.controller.ts).
// Tách 2 route thay vì 1 route + cờ `stream` trong body: @Res() tắt việc Nest tự bọc response, không thể
// vừa trả JSON có envelope vừa tự ghi SSE trong cùng 1 handler một cách an toàn.
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  ApiKeyAuth,
  CurrentApiKey,
} from '../api-keys/decorators/api-key-auth.decorator.js';
import { ApiKeyRateLimitGuard } from '../api-keys/api-key-rate-limit.guard.js';
import type { ApiKeyPrincipal } from '../api-keys/api-key-principal.js';
import { ApiZodResponse } from '../common/swagger/api-zod-response.decorator.js';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator.js';
import { PublicQueryService } from './public-query.service.js';
import {
  PublicQueryResponseSchema,
  PublicQuerySchema,
  type PublicQueryDto,
} from './schemas/public-query.schema.js';

const ApiKeyInfoResponseSchema = z.object({
  apiKeyId: z.string().describe('Unique API key identifier'),
  keyPrefix: z.string().describe('API key prefix for identification'),
  tenantId: z.string().describe('Tenant ID that owns this key'),
  collectionId: z
    .string()
    .nullable()
    .describe('Scoped collection ID, or null if tenant-wide'),
});

@ApiTags('public-api')
@ApiKeyAuth()
@Controller('v1')
export class PublicApiController {
  constructor(private readonly publicQueryService: PublicQueryService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Verify API key: returns tenant and collection scope info',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Current API key information',
    schema: ApiKeyInfoResponseSchema,
  })
  @ApiErrorResponse(
    HttpStatus.UNAUTHORIZED,
    'Missing, invalid, or revoked API key',
  )
  me(@CurrentApiKey() key: ApiKeyPrincipal) {
    return {
      apiKeyId: key.apiKeyId,
      keyPrefix: key.keyPrefix,
      tenantId: key.tenantId,
      collectionId: key.collectionId,
    };
  }

  // Rate limit chỉ áp cho 2 route /query* (tốn tiền gọi embedding + LLM), /me nhẹ nên không giới hạn.
  // Cả 2 route dùng chung 1 instance guard nên cùng 1 bộ đếm theo key.
  @Post('query')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyRateLimitGuard)
  @ApiOperation({
    summary:
      'Query documents with RAG (stateless) — returns single JSON response with citations',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Generated answer and source citations',
    schema: PublicQueryResponseSchema,
  })
  @ApiErrorResponse(
    HttpStatus.UNAUTHORIZED,
    'Missing, invalid, or revoked API key',
  )
  @ApiErrorResponse(
    HttpStatus.FORBIDDEN,
    'API key is not allowed to query this collection',
  )
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'Collection not found in tenant')
  @ApiErrorResponse(
    HttpStatus.TOO_MANY_REQUESTS,
    'Rate limit exceeded (30 requests/minute per key)',
  )
  query(
    @CurrentApiKey() key: ApiKeyPrincipal,
    @Body({ schema: PublicQuerySchema }) dto: PublicQueryDto,
  ) {
    return this.publicQueryService.query(key, dto);
  }

  @Post('query/stream')
  @UseGuards(ApiKeyRateLimitGuard)
  @ApiOperation({
    summary:
      'Query documents with RAG (stateless) via SSE streaming. Events: start {citations} -> delta (text) ... -> done {}, or error {message}. Not wrapped in JSON envelope.',
  })
  @ApiErrorResponse(
    HttpStatus.UNAUTHORIZED,
    'Missing, invalid, or revoked API key',
  )
  @ApiErrorResponse(
    HttpStatus.FORBIDDEN,
    'API key is not allowed to query this collection',
  )
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'Collection not found in tenant')
  @ApiErrorResponse(
    HttpStatus.TOO_MANY_REQUESTS,
    'Rate limit exceeded (30 requests/minute per key)',
  )
  async queryStream(
    @CurrentApiKey() key: ApiKeyPrincipal,
    @Body({ schema: PublicQuerySchema }) dto: PublicQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    // Chạy TRƯỚC khi set header SSE — throw ở đây (403/404...) vẫn ra JSON error chuẩn qua
    // GlobalExceptionFilter như mọi route khác.
    const prepared = await this.publicQueryService.prepare(key, dto);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // tắt buffer của nginx (không ảnh hưởng khi chạy local)
    res.flushHeaders();

    // Client ngắt kết nối giữa chừng (đóng terminal, abort request...) -> dừng đọc LLM, đỡ tốn quota.
    let clientClosed = false;
    res.on('close', () => {
      clientClosed = true;
    });

    const writeEvent = (event: string, data: unknown): void => {
      res.write(`event: ${event}\n`);
      res.write(
        `data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`,
      );
    };

    // Citations gửi NGAY đầu (retrieval đã xong từ prepare) — client hiển thị nguồn trong lúc chờ chữ.
    writeEvent('start', { citations: prepared.citations });

    try {
      for await (const delta of this.publicQueryService.streamAnswer(
        prepared,
      )) {
        if (clientClosed) return;
        writeEvent('delta', delta);
      }
    } catch (err) {
      // Header 200 đã gửi — chỉ còn cách báo lỗi qua chính luồng SSE.
      const message =
        err instanceof Error ? err.message : 'Unknown error during LLM generation';
      writeEvent('error', { message });
      res.end();
      return;
    }

    writeEvent('done', {});
    res.end();
  }
}
