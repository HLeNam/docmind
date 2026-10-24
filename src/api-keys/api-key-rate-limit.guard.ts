// Rate limit THEO API KEY (không theo IP): mỗi key tối đa RATE_LIMIT_PER_WINDOW request / cửa sổ 60 giây.
// PHẢI chạy SAU ApiKeyGuard (cần request.apiKey) — gắn ở method: @UseGuards(ApiKeyRateLimitGuard), Nest
// luôn chạy guard cấp controller (ApiKeyGuard từ @ApiKeyAuth()) trước guard cấp method.
//
// Bộ đếm nằm ở RateLimitService (Redis, tự rơi về in-memory khi Redis lỗi/không cấu hình) nên đúng khi chạy
// nhiều instance. /v1/query và /v1/query/stream dùng chung khoá `apikey:<id>` => chung 1 hạn mức.
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { RateLimitService } from '../common/rate-limit/rate-limit.service.js';
import { TooManyRequestsAppException } from '../common/rate-limit/too-many-requests.exception.js';
import type { ApiKeyRequest } from './api-key.guard.js';

export const RATE_LIMIT_PER_WINDOW = 30;
export const RATE_LIMIT_WINDOW_MS = 60_000;

@Injectable()
export class ApiKeyRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimit: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<ApiKeyRequest>();
    const response = http.getResponse<Response>();

    const apiKeyId = request.apiKey?.apiKeyId;
    // Không có principal = ApiKeyGuard chưa chạy (cấu hình sai thứ tự) — fail closed, không bỏ qua limit.
    if (!apiKeyId) {
      throw new TooManyRequestsAppException(RATE_LIMIT_WINDOW_MS / 1000);
    }

    await this.rateLimit.enforce(
      `apikey:${apiKeyId}`,
      RATE_LIMIT_PER_WINDOW,
      RATE_LIMIT_WINDOW_MS,
      response,
    );
    return true;
  }
}
