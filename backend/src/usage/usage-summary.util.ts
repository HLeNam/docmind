// Hàm thuần (không DB) cho GET /usage/summary: xác định khoảng ngày và gộp các dòng đã group theo (ngày, loại)
// thành response. Tách riêng để test không cần Prisma.
import { ValidationAppException } from '../common/exceptions/app.exception.js';
import {
  UsageSummary,
  UsageSummaryQueryDto,
} from './dtos/usage-summary.dto.js';

export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 366;
const DAY_MS = 86_400_000;

export interface UsageRange {
  /** YYYY-MM-DD, gồm cả ngày này */
  from: string;
  to: string;
  /** created_at >= start */
  start: Date;
  /** created_at < endExclusive (0h UTC ngày sau `to`) */
  endExclusive: Date;
}

/** Một dòng đã GROUP BY (ngày UTC, loại) từ DB. */
export interface UsageDailyRow {
  date: string;
  type: 'GENERATION' | 'EMBEDDING';
  records: number;
  tokens: number;
  costUsd: number;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utcMidnight = (s: string) => new Date(`${s}T00:00:00.000Z`);
const round4 = (n: number) => Number(n.toFixed(4));

export function resolveRange(
  query: UsageSummaryQueryDto,
  now: Date = new Date(),
): UsageRange {
  const to = query.to ?? iso(now);
  const from =
    query.from ??
    iso(
      new Date(utcMidnight(to).getTime() - (DEFAULT_RANGE_DAYS - 1) * DAY_MS),
    );

  const start = utcMidnight(from);
  const endExclusive = new Date(utcMidnight(to).getTime() + DAY_MS);
  const days = Math.round((endExclusive.getTime() - start.getTime()) / DAY_MS);

  if (days < 1)
    throw new ValidationAppException('`from` must be before or equal to `to`', {
      from: [from],
      to: [to],
    });
  if (days > MAX_RANGE_DAYS) {
    throw new ValidationAppException(
      `Date range cannot exceed ${MAX_RANGE_DAYS} days`,
      { from: [from], to: [to] },
    );
  }
  return { from, to, start, endExclusive };
}

export function buildSummary(
  rows: UsageDailyRow[],
  range: UsageRange,
): UsageSummary {
  const empty = () => ({ records: 0, tokens: 0, costUsd: 0 });
  const byType = { GENERATION: empty(), EMBEDDING: empty() };

  // Điền đủ MỌI ngày trong khoảng (ngày không có usage = 0) để FE vẽ biểu đồ không bị đứt quãng.
  const daily = new Map<
    string,
    {
      generationTokens: number;
      embeddingTokens: number;
      tokens: number;
      costUsd: number;
    }
  >();
  for (
    let t = range.start.getTime();
    t < range.endExclusive.getTime();
    t += DAY_MS
  ) {
    daily.set(iso(new Date(t)), {
      generationTokens: 0,
      embeddingTokens: 0,
      tokens: 0,
      costUsd: 0,
    });
  }

  for (const r of rows) {
    const bucket = byType[r.type];
    bucket.records += r.records;
    bucket.tokens += r.tokens;
    bucket.costUsd += r.costUsd;

    const day = daily.get(r.date);
    if (!day) continue; // lệch múi giờ/biên: bỏ qua thay vì làm hỏng response
    if (r.type === 'GENERATION') day.generationTokens += r.tokens;
    else day.embeddingTokens += r.tokens;
    day.tokens += r.tokens;
    day.costUsd += r.costUsd;
  }

  return {
    from: range.from,
    to: range.to,
    totals: {
      records: byType.GENERATION.records + byType.EMBEDDING.records,
      tokens: byType.GENERATION.tokens + byType.EMBEDDING.tokens,
      costUsd: round4(byType.GENERATION.costUsd + byType.EMBEDDING.costUsd),
      byType: {
        GENERATION: {
          ...byType.GENERATION,
          costUsd: round4(byType.GENERATION.costUsd),
        },
        EMBEDDING: {
          ...byType.EMBEDDING,
          costUsd: round4(byType.EMBEDDING.costUsd),
        },
      },
    },
    daily: [...daily.entries()].map(([date, d]) => ({
      date,
      ...d,
      costUsd: round4(d.costUsd),
    })),
  };
}
