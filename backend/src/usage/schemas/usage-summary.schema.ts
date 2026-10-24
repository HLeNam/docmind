import { z } from 'zod';

// Ngày dạng YYYY-MM-DD (UTC). Kiểm tra cả "ngày có thật" (2026-02-30 -> sai), không chỉ regex.
const DateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00.000Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'Invalid date');

// Cả hai đều tuỳ chọn. Ràng buộc chéo (from <= to, tối đa 366 ngày) nằm ở resolveRange() vì còn phụ thuộc
// giá trị mặc định (to = hôm nay, from = to - 29 ngày).
export const UsageSummaryQuerySchema = z.object({
  from: DateOnly.optional().describe(
    'Start date (UTC, inclusive). Defaults to 29 days before `to`.',
  ),
  to: DateOnly.optional().describe(
    'End date (UTC, inclusive). Defaults to current date.',
  ),
});

const TypeTotals = z.object({
  records: z
    .number()
    .describe(
      'Number of UsageLog records (1 LLM turn = 1 record; 1 embedding batch = 1 record)',
    ),
  tokens: z.number(),
  costUsd: z.number(),
});

export const UsageSummaryResponseSchema = z.object({
  from: z.string(),
  to: z.string(),
  totals: z.object({
    records: z.number(),
    tokens: z.number(),
    costUsd: z.number(),
    byType: z.object({ GENERATION: TypeTotals, EMBEDDING: TypeTotals }),
  }),
  daily: z.array(
    z.object({
      date: z.string(),
      generationTokens: z.number(),
      embeddingTokens: z.number(),
      tokens: z.number(),
      costUsd: z.number(),
    }),
  ),
});
