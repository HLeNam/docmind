// Đọc UsageLog của MỘT tenant và gộp theo ngày/loại. Chạy trong runInTenantContext nên RLS tự giới hạn đúng
// tenant của người gọi (bảng usage_logs có RLS) — không cần tự thêm WHERE tenant_id.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AccessTokenPayload } from '../auth/auth.service.js';
import {
  buildSummary,
  resolveRange,
  type UsageDailyRow,
} from './usage-summary.util.js';
import {
  UsageSummary,
  UsageSummaryQueryDto,
} from './dtos/usage-summary.dto.js';

@Injectable()
export class UsageSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(
    caller: Pick<AccessTokenPayload, 'tenantId'>,
    query: UsageSummaryQueryDto,
    now = new Date(),
  ): Promise<UsageSummary> {
    const range = resolveRange(query, now);

    // Ngày tính theo UTC (đồng nhất với from/to). ::float8 để Prisma trả number thường (SUM(int) là bigint,
    // SUM(numeric) là Decimal -> sẽ thành BigInt/Decimal khó serialize).
    const rows = await this.prisma.runInTenantContext(
      caller.tenantId,
      (tx) =>
        tx.$queryRaw<UsageDailyRow[]>`
        SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS "date",
               type::text                                          AS "type",
               COUNT(*)::int                                       AS "records",
               COALESCE(SUM(tokens), 0)::float8                    AS "tokens",
               COALESCE(SUM(cost_usd), 0)::float8                  AS "costUsd"
        FROM usage_logs
        WHERE created_at >= ${range.start} AND created_at < ${range.endExclusive}
        GROUP BY 1, 2
        ORDER BY 1`,
    );

    return buildSummary(rows, range);
  }
}
