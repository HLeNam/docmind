import { describe, expect, it, vi } from 'vitest';
import { UsageService } from '../src/usage/usage.service.js';

function build(env: Record<string, string> = {}) {
  const create = vi.fn(async (_args: unknown) => ({}));
  const prisma = {
    runInTenantContext: vi.fn(
      async (_tenantId: string, fn: (tx: unknown) => unknown) =>
        fn({ usageLog: { create } }),
    ),
  };
  const config = { get: (k: string) => env[k] };
  return {
    service: new UsageService(prisma as any, config as any),
    prisma,
    create,
  };
}

describe('UsageService', () => {
  it('records GENERATION usage with input and output tokens in tenant context', async () => {
    const { service, prisma, create } = build();
    await service.recordNow({
      tenantId: 't1',
      type: 'GENERATION',
      inputTokens: 1000,
      outputTokens: 200,
    });

    expect(prisma.runInTenantContext).toHaveBeenCalledWith(
      't1',
      expect.any(Function),
    );
    expect(create).toHaveBeenCalledWith({
      data: { tenantId: 't1', type: 'GENERATION', tokens: 1200, costUsd: 0 },
    });
  });

  it('calculates cost based on token counts and configured rates per 1M tokens', async () => {
    const { service, create } = build({
      USAGE_PRICE_INPUT_PER_1M_USD: '0.30',
      USAGE_PRICE_OUTPUT_PER_1M_USD: '2.50',
    });
    await service.recordNow({
      tenantId: 't1',
      type: 'GENERATION',
      inputTokens: 1_000_000,
      outputTokens: 100_000,
    });

    // 1M × 0.30 + 0.1M × 2.50 = 0.30 + 0.25 = 0.55
    expect((create.mock.calls[0]![0] as any).data.costUsd).toBe(0.55);
  });

  it('calculates EMBEDDING cost using embedding rate and ignores output tokens', async () => {
    const { service, create } = build({
      USAGE_PRICE_EMBEDDING_PER_1M_USD: '0.15',
    });
    await service.recordNow({
      tenantId: 't1',
      type: 'EMBEDDING',
      inputTokens: 2_000_000,
    });
    expect((create.mock.calls[0]![0] as any).data).toEqual({
      tenantId: 't1',
      type: 'EMBEDDING',
      tokens: 2_000_000,
      costUsd: 0.3,
    });
  });

  it('defaults invalid rates (non-numeric, negative) to 0 without throwing', async () => {
    const { service, create } = build({
      USAGE_PRICE_INPUT_PER_1M_USD: 'abc',
      USAGE_PRICE_OUTPUT_PER_1M_USD: '-5',
    });
    await service.recordNow({
      tenantId: 't1',
      type: 'GENERATION',
      inputTokens: 1000,
      outputTokens: 1000,
    });
    expect((create.mock.calls[0]![0] as any).data.costUsd).toBe(0);
  });

  it('does not record when token count is 0', async () => {
    const { service, prisma } = build();
    await service.recordNow({
      tenantId: 't1',
      type: 'GENERATION',
      inputTokens: 0,
      outputTokens: 0,
    });
    expect(prisma.runInTenantContext).not.toHaveBeenCalled();
  });

  it('does not throw when database fails during recordNow', async () => {
    const { service, prisma } = build();
    prisma.runInTenantContext.mockRejectedValue(new Error('db down'));
    await expect(
      service.recordNow({
        tenantId: 't1',
        type: 'GENERATION',
        inputTokens: 10,
      }),
    ).resolves.toBeUndefined();
  });

  it('executes record as fire-and-forget without throwing', () => {
    const { service, prisma } = build();
    prisma.runInTenantContext.mockRejectedValue(new Error('db down'));
    expect(() =>
      service.record({ tenantId: 't1', type: 'GENERATION', inputTokens: 10 }),
    ).not.toThrow();
  });
});
