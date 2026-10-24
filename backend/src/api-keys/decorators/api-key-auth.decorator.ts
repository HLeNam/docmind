import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { ApiKeyGuard, type ApiKeyRequest } from '../api-key.guard.js';
import type { ApiKeyPrincipal } from '../api-key-principal.js';

/**
 * Đánh dấu route/controller xác thực bằng API key thay cho JWT.
 *
 * Gộp 3 việc phải đi cùng nhau, để không ai quên 1 trong 3:
 *  - @Public(): bỏ qua JwtAuthGuard global (nếu thiếu, mọi request bằng API key bị JwtAuthGuard chặn 401).
 *  - @UseGuards(ApiKeyGuard): xác thực key.
 *  - @ApiBearerAuth('api-key'): hiện nút Authorize trong Swagger (cần đăng ký scheme 'api-key', xem notes).
 */
export const ApiKeyAuth = () =>
  applyDecorators(Public(), UseGuards(ApiKeyGuard), ApiBearerAuth('api-key'));

/** Lấy thông tin key đang gọi (tenantId, collectionId scope...) — chỉ dùng được sau @ApiKeyAuth(). */
export const CurrentApiKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ApiKeyPrincipal => {
    return ctx.switchToHttp().getRequest<ApiKeyRequest>().apiKey!;
  },
);
