import { describe, expect, it, vi } from 'vitest';
import { UsageSummaryService } from '../src/usage/usage-summary.service.js';

const NOW = new Date('2026-10-18T13:00:00.000Z');

function makeService(rows: any[]) {
  const queryRaw = vi.fn(async (..._a: any[]) => rows);
  const prisma = {
    runInTenantContext: vi.fn(
      async (_tenantId: string, fn: (tx: any) => Promise<any>) =>
        fn({ $queryRaw: queryRaw }),
    ),
  };
  return { svc: new UsageSummaryService(prisma as any), prisma, queryRaw };
}

describe('UsageSummaryService', () => {
  it('executes in caller tenant context and queries date range [start, endExclusive)', async () => {
    const { svc, prisma, queryRaw } = makeService([]);
    await svc.summary(
      { tenantId: 't1' },
      { from: '2026-10-16', to: '2026-10-18' },
      NOW,
    );

    expect(prisma.runInTenantContext).toHaveBeenCalledWith(
      't1',
      expect.any(Function),
    );
    // tagged template: (strings, ...values) -> values are [start, endExclusive]
    const values = queryRaw.mock.calls[0]!.slice(1) as Date[];
    expect(values[0]!.toISOString()).toBe('2026-10-16T00:00:00.000Z');
    expect(values[1]!.toISOString()).toBe('2026-10-19T00:00:00.000Z');
  });

  it('returns aggregated summary response from database rows', async () => {
    const { svc } = makeService([
      {
        date: '2026-10-17',
        type: 'GENERATION',
        records: 4,
        tokens: 2000,
        costUsd: 0.01,
      },
      {
        date: '2026-10-17',
        type: 'EMBEDDING',
        records: 2,
        tokens: 300,
        costUsd: 0,
      },
    ]);
    const s = await svc.summary(
      { tenantId: 't1' },
      { from: '2026-10-17', to: '2026-10-17' },
      NOW,
    );

    expect(s.daily).toEqual([
      {
        date: '2026-10-17',
        generationTokens: 2000,
        embeddingTokens: 300,
        tokens: 2300,
        costUsd: 0.01,
      },
    ]);
    expect(s.totals.tokens).toBe(2300);
  });

  it('throws validation error without querying database when date range is invalid', async () => {
    const { svc, prisma } = makeService([]);
    await expect(
      svc.summary(
        { tenantId: 't1' },
        { from: '2026-10-10', to: '2026-10-01' },
        NOW,
      ),
    ).rejects.toThrow();
    expect(prisma.runInTenantContext).not.toHaveBeenCalled();
  });
});
