import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import {
  ApiKeyRateLimitGuard,
  RATE_LIMIT_PER_WINDOW,
  RATE_LIMIT_WINDOW_MS,
} from '../src/api-keys/api-key-rate-limit.guard.js';
import { ErrorCode } from '../src/common/exceptions/error-codes.js';

function contextFor(apiKeyId: string | undefined) {
  const headers: Record<string, string> = {};
  const response = { setHeader: (k: string, v: string) => (headers[k] = v) };
  const request = { apiKey: apiKeyId ? { apiKeyId } : undefined };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
  return { context, headers };
}

describe('ApiKeyRateLimitGuard', () => {
  let guard: ApiKeyRateLimitGuard;

  beforeEach(() => {
    vi.useFakeTimers();
    guard = new ApiKeyRateLimitGuard();
  });
  afterEach(() => vi.useRealTimers());

  it('cho qua đúng LIMIT request đầu, set header còn lại bao nhiêu', () => {
    let last: ReturnType<typeof contextFor> | undefined;
    for (let i = 0; i < RATE_LIMIT_PER_WINDOW; i++) {
      last = contextFor('k1');
      expect(guard.canActivate(last.context)).toBe(true);
    }
    expect(last!.headers['X-RateLimit-Limit']).toBe(
      String(RATE_LIMIT_PER_WINDOW),
    );
    expect(last!.headers['X-RateLimit-Remaining']).toBe('0');
  });

  it('request thứ LIMIT+1 -> 429 RATE_LIMITED kèm Retry-After', () => {
    for (let i = 0; i < RATE_LIMIT_PER_WINDOW; i++)
      guard.canActivate(contextFor('k1').context);

    const { context, headers } = contextFor('k1');
    let error: any;
    try {
      guard.canActivate(context);
    } catch (e) {
      error = e;
    }
    expect(error.code).toBe(ErrorCode.RATE_LIMITED);
    expect(error.getStatus()).toBe(429);
    expect(Number(headers['Retry-After'])).toBeGreaterThan(0);
  });

  it('mỗi key đếm riêng: key khác không bị ảnh hưởng', () => {
    for (let i = 0; i < RATE_LIMIT_PER_WINDOW + 1; i++) {
      try {
        guard.canActivate(contextFor('k1').context);
      } catch {
        /* k1 vượt limit là đúng */
      }
    }
    expect(guard.canActivate(contextFor('k2').context)).toBe(true);
  });

  it('hết cửa sổ thì đếm lại từ đầu', () => {
    for (let i = 0; i < RATE_LIMIT_PER_WINDOW; i++)
      guard.canActivate(contextFor('k1').context);
    vi.advanceTimersByTime(RATE_LIMIT_WINDOW_MS + 1);
    expect(guard.canActivate(contextFor('k1').context)).toBe(true);
  });

  it('thiếu principal (ApiKeyGuard chưa chạy) -> chặn, không cho qua', () => {
    expect(() => guard.canActivate(contextFor(undefined).context)).toThrow();
  });
});
