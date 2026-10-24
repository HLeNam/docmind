import { describe, expect, it } from 'vitest';
import { FixedWindowRateLimiter } from '../src/slack/slack-rate-limiter.js';

describe('FixedWindowRateLimiter', () => {
  it('allows up to limit calls, subsequent call is blocked with retryAfter', () => {
    let now = 1_000_000;
    const limiter = new FixedWindowRateLimiter(3, 60_000, () => now);
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(true);

    now += 10_000;
    const blocked = limiter.check('a');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(50);
  });

  it('counts separately per key', () => {
    const limiter = new FixedWindowRateLimiter(1, 60_000);
    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(false);
    expect(limiter.check('b').allowed).toBe(true);
  });

  it('resets counter when window expires', () => {
    let now = 0;
    const limiter = new FixedWindowRateLimiter(1, 60_000, () => now);
    limiter.check('a');
    expect(limiter.check('a').allowed).toBe(false);
    now += 60_001;
    expect(limiter.check('a').allowed).toBe(true);
  });
});
