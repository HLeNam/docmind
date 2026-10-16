// Rate limit THEO API KEY (không theo IP): mỗi key tối đa RATE_LIMIT_PER_WINDOW request / cửa sổ 60 giây.
// PHẢI chạy SAU ApiKeyGuard (cần request.apiKey) — gắn ở method: @UseGuards(ApiKeyRateLimitGuard), Nest
// luôn chạy guard cấp controller (ApiKeyGuard từ @ApiKeyAuth()) trước guard cấp method.
//
// Fixed window trong bộ nhớ process — đủ cho 1 instance (demo/self-host nhỏ). Hạn chế đã biết:
//  - chạy nhiều instance thì mỗi instance đếm riêng (limit thực tế = limit × số instance);
//  - restart process là mất bộ đếm.
// Khi cần chính xác nhiều instance: đổi `windows` sang Redis (INCR + EXPIRE) — Redis đã có sẵn cho BullMQ,
// chỉ phải đổi trong file này, controller không đổi.
import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppException } from '../common/exceptions/app.exception.js';
import { ErrorCode } from '../common/exceptions/error-codes.js';
import type { ApiKeyRequest } from './api-key.guard.js';

export const RATE_LIMIT_PER_WINDOW = 30;
export const RATE_LIMIT_WINDOW_MS = 60_000;
const PURGE_THRESHOLD = 1000;

class TooManyRequestsAppException extends AppException {
  constructor(retryAfterSeconds: number) {
    super(
      ErrorCode.RATE_LIMITED,
      `Rate limit exceeded, retry in ${retryAfterSeconds}s`,
      HttpStatus.TOO_MANY_REQUESTS,
      { retryAfterSeconds },
    );
  }
}

interface Window {
  count: number;
  resetAt: number;
}

@Injectable()
export class ApiKeyRateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, Window>();

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<ApiKeyRequest>();
    const response = http.getResponse<Response>();

    const apiKeyId = request.apiKey?.apiKeyId;
    // Không có principal = ApiKeyGuard chưa chạy (cấu hình sai thứ tự) — fail closed, không bỏ qua limit.
    if (!apiKeyId) {
      throw new TooManyRequestsAppException(RATE_LIMIT_WINDOW_MS / 1000);
    }

    const now = Date.now();
    this.purgeExpired(now);

    let window = this.windows.get(apiKeyId);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
      this.windows.set(apiKeyId, window);
    }
    window.count += 1;

    const remaining = Math.max(0, RATE_LIMIT_PER_WINDOW - window.count);
    const resetSeconds = Math.ceil((window.resetAt - now) / 1000);
    response.setHeader('X-RateLimit-Limit', String(RATE_LIMIT_PER_WINDOW));
    response.setHeader('X-RateLimit-Remaining', String(remaining));
    response.setHeader('X-RateLimit-Reset', String(resetSeconds));

    if (window.count > RATE_LIMIT_PER_WINDOW) {
      response.setHeader('Retry-After', String(resetSeconds));
      throw new TooManyRequestsAppException(resetSeconds);
    }
    return true;
  }

  // Dọn lười (lazy): chỉ quét khi Map phình to, tránh rò rỉ bộ nhớ khi có nhiều key khác nhau.
  private purgeExpired(now: number): void {
    if (this.windows.size < PURGE_THRESHOLD) return;
    for (const [id, w] of this.windows) {
      if (w.resetAt <= now) this.windows.delete(id);
    }
  }
}
