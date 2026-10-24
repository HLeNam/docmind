import { Body, Controller, Delete, Get, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ApiZodResponse } from '../common/swagger/api-zod-response.decorator.js';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator.js';
import type { AccessTokenPayload } from '../auth/auth.service.js';
import { ApiKeysService } from './api-keys.service.js';
import {
  ApiKeyCreatedResponseSchema,
  ApiKeyListResponseSchema,
  ApiKeyResponseSchema,
} from './schemas/api-key-response.schema.js';
import { CreateApiKeySchema } from './schemas/api-key.schema.js';
import type { CreateApiKeyDto } from './dtos/api-key.dto.js';

// Quản lý key đi qua JWT của user (đăng nhập bình thường) và chỉ OWNER/ADMIN — KHÔNG phải qua chính
// API key. Mặc định đã bị JwtAuthGuard global chặn (không cần @UseGuards), RolesGuard global đọc @Roles().
@ApiTags('api-keys')
@ApiBearerAuth('access-token')
@Roles('OWNER', 'ADMIN')
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @ApiOperation({
    summary:
      'Create API key — raw key is only returned once in this response',
  })
  @ApiZodResponse({
    status: HttpStatus.CREATED,
    description: 'Newly created API key, including raw key',
    schema: ApiKeyCreatedResponseSchema,
  })
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'Forbidden: Requires OWNER or ADMIN role')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'Collection not found in tenant')
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body({ schema: CreateApiKeySchema }) dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(user, dto);
  }

  @Get()
  @ApiOperation({
    summary:
      'List tenant API keys (displays only keyPrefix, never raw key)',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'List of API keys, newest first',
    schema: ApiKeyListResponseSchema,
  })
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'Forbidden: Requires OWNER or ADMIN role')
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.apiKeysService.list(user);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Revoke API key — immediately disables the key',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Revoked API key',
    schema: ApiKeyResponseSchema,
  })
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'Forbidden: Requires OWNER or ADMIN role')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'API key not found')
  @ApiErrorResponse(HttpStatus.UNPROCESSABLE_ENTITY, 'API key has already been revoked')
  revoke(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.apiKeysService.revoke(user, id);
  }
}
