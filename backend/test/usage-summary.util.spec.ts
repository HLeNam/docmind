import { describe, expect, it } from 'vitest';
import { buildSummary, resolveRange } from '../src/usage/usage-summary.util.js';
import { UsageSummaryQuerySchema } from '../src/usage/schemas/usage-summary.schema.js';

const NOW = new Date('2026-10-18T13:00:00.000Z');

describe('resolveRange', () => {
  it('defaults to 30 days ending today in UTC', () => {
    const r = resolveRange({}, NOW);
    expect(r.to).toBe('2026-10-18');
    expect(r.from).toBe('2026-09-19');
    expect(r.start.toISOString()).toBe('2026-09-19T00:00:00.000Z');
    expect(r.endExclusive.toISOString()).toBe('2026-10-19T00:00:00.000Z');
  });

  it('calculates from as to minus 29 days when only to is provided', () => {
    expect(resolveRange({ to: '2026-03-31' }, NOW).from).toBe('2026-03-02');
  });

  it('resolves exactly 1 day when from equals to', () => {
    const r = resolveRange({ from: '2026-10-01', to: '2026-10-01' }, NOW);
    expect(r.endExclusive.getTime() - r.start.getTime()).toBe(86_400_000);
  });

  it('throws validation error when from is after to', () => {
    expect(() =>
      resolveRange({ from: '2026-10-10', to: '2026-10-01' }, NOW),
    ).toThrow();
  });

  it('throws error when only from is provided and it is in the future', () => {
    expect(() => resolveRange({ from: '2026-12-01' }, NOW)).toThrow();
  });

  it('throws when range exceeds 366 days and succeeds for exactly 366 days', () => {
    expect(() =>
      resolveRange({ from: '2025-01-01', to: '2026-10-18' }, NOW),
    ).toThrow();
    expect(() =>
      resolveRange({ from: '2025-10-18', to: '2026-10-18' }, NOW),
    ).not.toThrow(); // 366 days
  });
});

describe('UsageSummaryQuerySchema', () => {
  it('accepts empty query and valid dates', () => {
    expect(UsageSummaryQuerySchema.safeParse({}).success).toBe(true);
    expect(
      UsageSummaryQuerySchema.safeParse({
        from: '2026-10-01',
        to: '2026-10-18',
      }).success,
    ).toBe(true);
  });

  it('rejects invalid date format and non-existent calendar dates', () => {
    expect(
      UsageSummaryQuerySchema.safeParse({ from: '18/10/2026' }).success,
    ).toBe(false);
    expect(
      UsageSummaryQuerySchema.safeParse({ to: '2026-02-30' }).success,
    ).toBe(false);
    expect(
      UsageSummaryQuerySchema.safeParse({ to: '2026-13-01' }).success,
    ).toBe(false);
  });
});

describe('buildSummary', () => {
  const range = resolveRange({ from: '2026-10-16', to: '2026-10-18' }, NOW);

  it('returns zero totals and empty daily entries for all dates when rows are empty', () => {
    const s = buildSummary([], range);
    expect(s.daily.map((d) => d.date)).toEqual([
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
    ]);
    expect(s.totals).toEqual({
      records: 0,
      tokens: 0,
      costUsd: 0,
      byType: {
        GENERATION: { records: 0, tokens: 0, costUsd: 0 },
        EMBEDDING: { records: 0, tokens: 0, costUsd: 0 },
      },
    });
  });

  it('aggregates by type and date and fills zero for empty dates', () => {
    const s = buildSummary(
      [
        {
          date: '2026-10-16',
          type: 'GENERATION',
          records: 2,
          tokens: 1000,
          costUsd: 0.0123,
        },
        {
          date: '2026-10-16',
          type: 'EMBEDDING',
          records: 5,
          tokens: 400,
          costUsd: 0.0001,
        },
        {
          date: '2026-10-18',
          type: 'GENERATION',
          records: 1,
          tokens: 500,
          costUsd: 0.0061,
        },
      ],
      range,
    );

    expect(s.totals.records).toBe(8);
    expect(s.totals.tokens).toBe(1900);
    expect(s.totals.costUsd).toBe(0.0185);
    expect(s.totals.byType.GENERATION).toEqual({
      records: 3,
      tokens: 1500,
      costUsd: 0.0184,
    });
    expect(s.totals.byType.EMBEDDING).toEqual({
      records: 5,
      tokens: 400,
      costUsd: 0.0001,
    });

    expect(s.daily).toEqual([
      {
        date: '2026-10-16',
        generationTokens: 1000,
        embeddingTokens: 400,
        tokens: 1400,
        costUsd: 0.0124,
      },
      {
        date: '2026-10-17',
        generationTokens: 0,
        embeddingTokens: 0,
        tokens: 0,
        costUsd: 0,
      },
      {
        date: '2026-10-18',
        generationTokens: 500,
        embeddingTokens: 0,
        tokens: 500,
        costUsd: 0.0061,
      },
    ]);
  });

  it('ignores rows outside date range in daily without corrupting response', () => {
    const s = buildSummary(
      [
        {
          date: '2026-10-30',
          type: 'GENERATION',
          records: 1,
          tokens: 10,
          costUsd: 0,
        },
      ],
      range,
    );
    expect(s.daily.every((d) => d.tokens === 0)).toBe(true);
  });
});
