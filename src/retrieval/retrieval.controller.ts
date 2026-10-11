// src/retrieval/retrieval.controller.ts
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AccessTokenPayload } from '../auth/auth.service.js';
import { RetrievalService } from './retrieval.service.js';
import {
  RetrievalSearchSchema,
  RetrievedChunksResponseSchema,
} from './schemas/retrieval.schema.js';
import { type RetrievalSearchDto } from './dtos/retrieval.dto.js';
import { ApiZodResponse } from '../common/swagger/api-zod-response.decorator.js';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator.js';

@ApiTags('retrieval')
@ApiBearerAuth('access-token')
@Controller('retrieval')
export class RetrievalController {
  constructor(private readonly retrievalService: RetrievalService) {}

  // POST thay vì GET: query text có thể dài (tới 2000 ký tự, xem retrieval.schema.ts), nhét vào
  // query string vừa xấu vừa dễ chạm giới hạn độ dài URL của một số proxy/browser.
  // KHÔNG @Public() — mặc định đã bị JwtAuthGuard chặn, đúng chuẩn mọi route nghiệp vụ khác.
  @Post('search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Hybrid search (vector + full-text, combined via RRF) across collections caller can access',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'List of matching document chunks ranked by RRF score',
    schema: RetrievedChunksResponseSchema,
  })
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Invalid search parameters or query length exceeded.',
  )
  search(
    @CurrentUser() user: AccessTokenPayload,
    @Body({ schema: RetrievalSearchSchema }) dto: RetrievalSearchDto,
  ) {
    return this.retrievalService.search(user, dto);
  }
}
