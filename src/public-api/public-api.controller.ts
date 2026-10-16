// Endpoint công khai xác thực bằng API key (prefix /v1).
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  ApiKeyAuth,
  CurrentApiKey,
} from '../api-keys/decorators/api-key-auth.decorator.js';
import type { ApiKeyPrincipal } from '../api-keys/api-key-principal.js';
import { ApiZodResponse } from '../common/swagger/api-zod-response.decorator.js';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator.js';
import {
  PublicQueryResponseSchema,
  PublicQuerySchema,
} from './schemas/public-query.schema.js';
import type { PublicQueryDto } from './dtos/public-query.dto.js';
import { ApiKeyRateLimitGuard } from '../api-keys/api-key-rate-limit.guard.js';
import { PublicQueryService } from './public-query.service.js';

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

  // Rate limit chỉ áp cho /query (endpoint tốn tiền gọi embedding + LLM), /me nhẹ nên không giới hạn.
  @Post('query')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyRateLimitGuard)
  @ApiOperation({
    summary:
      'Query documents with RAG (stateless) — returns answer with citations',
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
}
