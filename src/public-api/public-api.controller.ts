import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  ApiKeyAuth,
  CurrentApiKey,
} from '../api-keys/decorators/api-key-auth.decorator.js';
import type { ApiKeyPrincipal } from '../api-keys/api-key-principal.js';
import { ApiZodResponse } from '../common/swagger/api-zod-response.decorator.js';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator.js';

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
}
