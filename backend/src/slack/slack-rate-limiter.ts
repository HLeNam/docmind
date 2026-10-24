// Rate limit cửa sổ cố định, trong bộ nhớ process — cùng hạn chế đã nêu ở ApiKeyRateLimitGuard (nhiều
// instance thì mỗi instance đếm riêng, restart thì mất). Tách thành class thuần (không phụ thuộc Nest/HTTP)
// vì /ask xử lý bất đồng bộ sau khi đã ack, không có "request" để gắn guard.
// TODO khi có thời gian: gộp với ApiKeyRateLimitGuard thành 1 util chung / chuyển sang Redis.
export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface Window {
  count: number;
  resetAt: number;
}

const PURGE_THRESHOLD = 1000;

export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): RateLimitResult {
    const now = this.now();
    this.purgeExpired(now);

    let window = this.windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, window);
    }
    window.count += 1;

    return {
      allowed: window.count <= this.limit,
      retryAfterSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
    };
  }

  private purgeExpired(now: number): void {
    if (this.windows.size < PURGE_THRESHOLD) return;
    for (const [key, w] of this.windows) {
      if (w.resetAt <= now) this.windows.delete(key);
    }
  }
}
