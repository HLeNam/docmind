import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RateLimitService } from '../src/common/rate-limit/rate-limit.service.js';
import { ErrorCode } from '../src/common/exceptions/error-codes.js';

function fakeResponse() {
  const headers: Record<string, string> = {};
  return {
    headers,
    res: { setHeader: (k: string, v: string) => (headers[k] = v) } as any,
  };
}

describe('RateLimitService — in-memory (no Redis)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('allows up to limit, then blocks subsequent requests with retryAfter', async () => {
    const svc = new RateLimitService(null);
    for (let i = 0; i < 3; i++)
      expect((await svc.consume('a', 3, 60_000)).allowed).toBe(true);

    vi.advanceTimersByTime(10_000);
    const blocked = await svc.consume('a', 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBe(50);
  });

  it('tracks keys independently and resets counter after window expiration', async () => {
    const svc = new RateLimitService(null);
    await svc.consume('a', 1, 1000);
    expect((await svc.consume('a', 1, 1000)).allowed).toBe(false);
    expect((await svc.consume('b', 1, 1000)).allowed).toBe(true);

    vi.advanceTimersByTime(1001);
    expect((await svc.consume('a', 1, 1000)).allowed).toBe(true);
  });

  it('enforce: sets headers, throws 429 RATE_LIMITED with Retry-After when exceeding limit', async () => {
    const svc = new RateLimitService(null);
    const ok = fakeResponse();
    await svc.enforce('k', 1, 60_000, ok.res);
    expect(ok.headers['X-RateLimit-Limit']).toBe('1');
    expect(ok.headers['X-RateLimit-Remaining']).toBe('0');

    const over = fakeResponse();
    const error = await svc.enforce('k', 1, 60_000, over.res).catch((e) => e);
    expect(error.code).toBe(ErrorCode.RATE_LIMITED);
    expect(error.getStatus()).toBe(429);
    expect(Number(over.headers['Retry-After'])).toBeGreaterThan(0);
  });
});

describe('RateLimitService — Redis', () => {
  it('uses Lua script results: count, ttl -> allowed/remaining/retryAfter', async () => {
    const redis = { eval: vi.fn(async () => [2, 45_000]) };
    const svc = new RateLimitService(redis as any);

    const r = await svc.consume('chat:m1', 5, 60_000);

    expect(r).toEqual({
      allowed: true,
      limit: 5,
      remaining: 3,
      retryAfterSeconds: 45,
    });
    const args = redis.eval.mock.calls[0] as unknown[];
    expect(args[1]).toBe(1); // 1 key
    expect(args[2]).toBe('rl:chat:m1'); // prefixed, avoids colliding with other Redis keys
    expect(args[3]).toBe(60_000);
  });

  it('count exceeds limit -> allowed: false', async () => {
    const redis = { eval: vi.fn(async () => [6, 1500]) };
    const r = await new RateLimitService(redis as any).consume('k', 5, 60_000);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.retryAfterSeconds).toBe(2);
  });

  it('Redis error -> falls back to in-memory counter gracefully without error', async () => {
    const redis = {
      eval: vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    };
    const svc = new RateLimitService(redis as any);

    expect((await svc.consume('k', 2, 60_000)).allowed).toBe(true);
    expect((await svc.consume('k', 2, 60_000)).allowed).toBe(true);
    expect((await svc.consume('k', 2, 60_000)).allowed).toBe(false);
  });
});

describe('RateLimitService.claimOnce (deduplication)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('in-memory: returns true on first call, false on duplicates, true after expiration', async () => {
    const svc = new RateLimitService(null);
    expect(await svc.claimOnce('e1', 1000)).toBe(true);
    expect(await svc.claimOnce('e1', 1000)).toBe(false);
    expect(await svc.claimOnce('e2', 1000)).toBe(true);

    vi.advanceTimersByTime(1001);
    expect(await svc.claimOnce('e1', 1000)).toBe(true);
  });

  it('Redis: uses SET NX PX; "OK" = claimed, null = already claimed', async () => {
    const redis = { set: vi.fn<(...a: any[]) => Promise<string | null>>() };
    const svc = new RateLimitService(redis as any);

    redis.set.mockResolvedValueOnce('OK');
    expect(await svc.claimOnce('slack:event:Ev1', 600_000)).toBe(true);
    expect(redis.set).toHaveBeenCalledWith(
      'once:slack:event:Ev1',
      '1',
      'PX',
      600_000,
      'NX',
    );

    redis.set.mockResolvedValueOnce(null);
    expect(await svc.claimOnce('slack:event:Ev1', 600_000)).toBe(false);
  });

  it('Redis error -> falls back to process-level deduplication without throwing', async () => {
    const redis = {
      set: vi.fn(async () => {
        throw new Error('down');
      }),
    };
    const svc = new RateLimitService(redis as any);

    expect(await svc.claimOnce('e1', 1000)).toBe(true);
    expect(await svc.claimOnce('e1', 1000)).toBe(false);
  });
});
