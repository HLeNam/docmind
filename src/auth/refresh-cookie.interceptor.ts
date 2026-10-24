// Gắn vào CONTROLLER/route trả cặp token ({accessToken, refreshToken}): đưa refreshToken vào cookie HttpOnly và BỎ nó khỏi
// body JSON. Phải bỏ khỏi body: nếu còn, script độc hại trong trang tự gọi /auth/refresh rồi đọc token từ response, làm
// HttpOnly mất tác dụng.
//
// Dùng ở cấp controller/route (@UseInterceptors) chứ không đăng ký global: cần chạy BÊN TRONG ResponseInterceptor (nhận kết
// quả thô của handler trước khi bọc {success, data, meta}); interceptor cấp route luôn nằm trong interceptor global.
import { Injectable } from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { map } from 'rxjs';
import type { Observable } from 'rxjs';
import {
  REFRESH_COOKIE_NAME,
  isTokenPair,
  refreshCookieOptions,
  resolveRefreshCookieSettings,
} from './refresh-cookie.util.js';

@Injectable()
export class RefreshCookieInterceptor implements NestInterceptor {
  constructor(private readonly config: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const res = context.switchToHttp().getResponse<Response>();
    const settings = resolveRefreshCookieSettings(this.env());

    return next.handle().pipe(
      map((data: unknown) => {
        if (!isTokenPair(data)) return data; // vd requiresTenantSelection (chưa phát token) -> giữ nguyên
        res.cookie(
          REFRESH_COOKIE_NAME,
          data.refreshToken,
          refreshCookieOptions(settings),
        );
        if (settings.inBody) return data;
        const { refreshToken: _omitted, ...rest } = data;
        return rest;
      }),
    );
  }

  // ConfigService trước (đã qua Zod), rồi process.env: tránh mất biến chưa khai trong schema.
  private env(): Record<string, string | undefined> {
    const keys = [
      'NODE_ENV',
      'AUTH_COOKIE_SAMESITE',
      'AUTH_COOKIE_SECURE',
      'AUTH_COOKIE_PATH',
      'AUTH_REFRESH_COOKIE_MAX_AGE_DAYS',
      'AUTH_REFRESH_TOKEN_IN_BODY',
    ];
    return Object.fromEntries(
      keys.map((k) => [k, this.config.get<string>(k) ?? process.env[k]]),
    );
  }
}
