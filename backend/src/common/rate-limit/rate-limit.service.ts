// Rate limit fixed-window dùng chung cho mọi nơi (API key, chat, Slack...).
//  - Có Redis: đếm bằng 1 script Lua nguyên tử (INCR + PEXPIRE) -> đúng khi chạy NHIỀU instance và
//    không mất bộ đếm khi restart.
//  - Không có Redis (dev/test) hoặc Redis đang lỗi: rơi về bộ đếm in-memory của process. Cố ý "degrade" thay vì
//    mở toang (fail-open) hay chặn hết (fail-closed): vẫn giới hạn được, chỉ kém chính xác khi nhiều instance.
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { Response } from 'express';
import type { Redis } from 'ioredis';
import { TooManyRequestsAppException } from './too-many-requests.exception.js';
import { REDIS_CLIENT } from './redis.module.js';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Số giây tới khi cửa sổ reset (luôn ≥ 1). */
  retryAfterSeconds: number;
}

// KEYS[1]=khoá, ARGV[1]=độ dài cửa sổ (ms). Trả {count, ttl_ms}. Tự sửa khoá "mồ côi" không có TTL.
const WINDOW_SCRIPT = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
return {c, ttl}
`;

const PURGE_THRESHOLD = 5000;

interface MemoryWindow {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly memory = new Map<string, MemoryWindow>();
  private readonly claims = new Map<string, number>(); // key -> thời điểm hết hạn
  private lastFallbackLogAt = 0;

  constructor(
    @Optional()
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis | null = null,
  ) {}

  /** Tính 1 lượt vào `key`. Không throw; kết quả cho biết có được phép không. */
  async consume(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    const fullKey = `rl:${key}`;
    if (this.redis) {
      try {
        const [count, ttlMs] = (await this.redis.eval(
          WINDOW_SCRIPT,
          1,
          fullKey,
          windowMs,
        )) as [number, number];
        return this.toResult(Number(count), Number(ttlMs), limit);
      } catch (err) {
        this.logFallback(err);
      }
    }
    return this.consumeInMemory(fullKey, limit, windowMs);
  }

  /**
   * "Giành quyền" xử lý 1 việc đúng MỘT lần trong `ttlMs` (khử trùng, vd Slack gửi lại cùng event_id).
   * true = bạn là người đầu tiên (hãy xử lý); false = đã có người giành rồi (bỏ qua).
   * Redis: SET NX PX (nguyên tử, đúng khi nhiều instance). Redis lỗi -> khử trùng trong process.
   */
  async claimOnce(key: string, ttlMs: number): Promise<boolean> {
    const fullKey = `once:${key}`;
    if (this.redis) {
      try {
        return (await this.redis.set(fullKey, '1', 'PX', ttlMs, 'NX')) === 'OK';
      } catch (err) {
        this.logFallback(err);
      }
    }
    const now = Date.now();
    const expiresAt = this.claims.get(fullKey);
    if (expiresAt !== undefined && expiresAt > now) return false;
    this.claims.set(fullKey, now + ttlMs);
    if (this.claims.size > PURGE_THRESHOLD) {
      for (const [k, exp] of this.claims) if (exp <= now) this.claims.delete(k);
    }
    return true;
  }

  /**
   * Tiện cho HTTP: tính lượt, set header X-RateLimit-*, và ném 429 (kèm Retry-After) nếu vượt giới hạn.
   * Gọi TRƯỚC phần việc tốn kém (embedding, LLM).
   */
  async enforce(
    key: string,
    limit: number,
    windowMs: number,
    response?: Response,
  ): Promise<RateLimitResult> {
    const result = await this.consume(key, limit, windowMs);
    if (response) {
      response.setHeader('X-RateLimit-Limit', String(result.limit));
      response.setHeader('X-RateLimit-Remaining', String(result.remaining));
      response.setHeader('X-RateLimit-Reset', String(result.retryAfterSeconds));
    }
    if (!result.allowed) {
      response?.setHeader('Retry-After', String(result.retryAfterSeconds));
      throw new TooManyRequestsAppException(result.retryAfterSeconds);
    }
    return result;
  }

  private toResult(
    count: number,
    ttlMs: number,
    limit: number,
  ): RateLimitResult {
    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000)),
    };
  }

  private consumeInMemory(
    key: string,
    limit: number,
    windowMs: number,
  ): RateLimitResult {
    const now = Date.now();
    this.purgeExpired(now);

    let window = this.memory.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + windowMs };
      this.memory.set(key, window);
    }
    window.count += 1;
    return this.toResult(window.count, window.resetAt - now, limit);
  }

  private purgeExpired(now: number): void {
    if (this.memory.size < PURGE_THRESHOLD) return;
    for (const [k, w] of this.memory) {
      if (w.resetAt <= now) this.memory.delete(k);
    }
  }

  private logFallback(err: unknown): void {
    const now = Date.now();
    if (now - this.lastFallbackLogAt > 30_000) {
      this.lastFallbackLogAt = now;
      this.logger.warn(
        `Redis rate limit failed, falling back to in-memory counters: ${String(err)}`,
      );
    }
  }
}
