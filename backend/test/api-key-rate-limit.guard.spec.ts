import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import {
  ApiKeyRateLimitGuard,
  RATE_LIMIT_PER_WINDOW,
  RATE_LIMIT_WINDOW_MS,
} from '../src/api-keys/api-key-rate-limit.guard.js';
import { RateLimitService } from '../src/common/rate-limit/rate-limit.service.js';
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

async function errorOf(fn: () => Promise<unknown>): Promise<any> {
  try {
    await fn();
  } catch (e) {
    return e;
  }
  return undefined;
}

describe('ApiKeyRateLimitGuard', () => {
  let guard: ApiKeyRateLimitGuard;

  beforeEach(() => {
    vi.useFakeTimers();
    // No Redis client passed -> uses in-memory counter (appropriate for tests).
    guard = new ApiKeyRateLimitGuard(new RateLimitService(null));
  });
  afterEach(() => vi.useRealTimers());

  it('allows up to RATE_LIMIT_PER_WINDOW requests and sets remaining headers correctly', async () => {
    let last: ReturnType<typeof contextFor> | undefined;
    for (let i = 0; i < RATE_LIMIT_PER_WINDOW; i++) {
      last = contextFor('k1');
      expect(await guard.canActivate(last.context)).toBe(true);
    }
    expect(last!.headers['X-RateLimit-Limit']).toBe(
      String(RATE_LIMIT_PER_WINDOW),
    );
    expect(last!.headers['X-RateLimit-Remaining']).toBe('0');
  });

  it('request exceeding limit -> 429 RATE_LIMITED with Retry-After header', async () => {
    for (let i = 0; i < RATE_LIMIT_PER_WINDOW; i++)
      await guard.canActivate(contextFor('k1').context);

    const { context, headers } = contextFor('k1');
    const error = await errorOf(() => guard.canActivate(context));
    expect(error.code).toBe(ErrorCode.RATE_LIMITED);
    expect(error.getStatus()).toBe(429);
    expect(Number(headers['Retry-After'])).toBeGreaterThan(0);
  });

  it('keys are tracked independently: other keys are unaffected', async () => {
    for (let i = 0; i < RATE_LIMIT_PER_WINDOW + 1; i++) {
      await errorOf(() => guard.canActivate(contextFor('k1').context));
    }
    expect(await guard.canActivate(contextFor('k2').context)).toBe(true);
  });

  it('resets counter after window expiration', async () => {
    for (let i = 0; i < RATE_LIMIT_PER_WINDOW; i++)
      await guard.canActivate(contextFor('k1').context);
    vi.advanceTimersByTime(RATE_LIMIT_WINDOW_MS + 1);
    expect(await guard.canActivate(contextFor('k1').context)).toBe(true);
  });

  it('missing principal (ApiKeyGuard has not run) -> rejects request', async () => {
    expect(
      await errorOf(() => guard.canActivate(contextFor(undefined).context)),
    ).toBeDefined();
  });
});
