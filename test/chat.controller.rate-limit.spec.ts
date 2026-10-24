import { describe, expect, it, vi } from 'vitest';
import {
  CHAT_RATE_LIMIT_PER_WINDOW,
  CHAT_RATE_LIMIT_WINDOW_MS,
  ChatController,
} from '../src/chat/chat.controller.js';
import { RateLimitService } from '../src/common/rate-limit/rate-limit.service.js';
import { ErrorCode } from '../src/common/exceptions/error-codes.js';

const USER = {
  identityId: 'i1',
  tenantId: 't1',
  membershipId: 'm1',
  role: 'MEMBER',
};

function fakeRes() {
  const headers: Record<string, string> = {};
  return {
    headers,
    res: {
      setHeader: (k: string, v: string) => (headers[k] = v),
      flushHeaders: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
    } as any,
  };
}

describe('ChatController — rate limit', () => {
  function build() {
    const chatService = {
      prepare: vi.fn(async () => ({ conversationId: 'c1', citations: [] })),
      streamAnswer: vi.fn(async function* () {
        yield 'xin chào';
      }),
      saveAssistantMessage: vi.fn(async () => ({ id: 'msg1' })),
    };
    const controller = new ChatController(
      chatService as any,
      new RateLimitService(null),
    );
    return { controller, chatService };
  }

  it('within limit: proceeds normally and sets X-RateLimit-* headers', async () => {
    const { controller, chatService } = build();
    const { res, headers } = fakeRes();

    await controller.sendMessage(USER, { content: 'hi' } as any, res);

    expect(chatService.prepare).toHaveBeenCalledTimes(1);
    expect(headers['X-RateLimit-Limit']).toBe(
      String(CHAT_RATE_LIMIT_PER_WINDOW),
    );
  });

  it('exceeding limit: returns 429 RATE_LIMITED without invoking embedding/LLM (prepare is not called)', async () => {
    const { controller, chatService } = build();

    for (let i = 0; i < CHAT_RATE_LIMIT_PER_WINDOW; i++) {
      await controller.sendMessage(
        USER,
        { content: 'hi' } as any,
        fakeRes().res,
      );
    }
    chatService.prepare.mockClear();

    const { res, headers } = fakeRes();
    const error: any = await controller
      .sendMessage(USER, { content: 'hi' } as any, res)
      .catch((e) => e);

    expect(error.code).toBe(ErrorCode.RATE_LIMITED);
    expect(error.getStatus()).toBe(429);
    expect(chatService.prepare).not.toHaveBeenCalled();
    expect(Number(headers['Retry-After'])).toBeGreaterThan(0);
    expect(res.flushHeaders).not.toHaveBeenCalled();
  });

  it('limits are per-member: other members in the same tenant are unaffected', async () => {
    const { controller } = build();
    for (let i = 0; i < CHAT_RATE_LIMIT_PER_WINDOW + 1; i++) {
      await controller
        .sendMessage(USER, { content: 'hi' } as any, fakeRes().res)
        .catch(() => undefined);
    }
    const other = { ...USER, membershipId: 'm2' };
    await expect(
      controller.sendMessage(other, { content: 'hi' } as any, fakeRes().res),
    ).resolves.toBeUndefined();
  });

  it('window duration is 60 seconds', () => {
    expect(CHAT_RATE_LIMIT_WINDOW_MS).toBe(60_000);
  });
});
