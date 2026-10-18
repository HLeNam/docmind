// Ghi UsageLog (số token + chi phí ước tính) cho từng tenant — nền cho analytics/billing ở Giai đoạn 5.
//
// Nguyên tắc: GHI NHẬT KÝ KHÔNG BAO GIỜ ĐƯỢC LÀM HỎNG REQUEST CỦA NGƯỜI DÙNG.
//  - record() là fire-and-forget: không await, mọi lỗi (DB chậm/lỗi) chỉ log cảnh báo.
//  - recordNow() là bản await được (dùng trong test); cũng không bao giờ throw.
//
// Chi phí: `costUsd` = token × đơn giá. Đơn giá cấu hình qua env (USD / 1 triệu token), MẶC ĐỊNH 0 vì đang dùng
// free tier Gemini -> costUsd = 0 nhưng `tokens` vẫn đầy đủ. Khi chuyển sang gói trả phí, chỉ cần đặt env, không
// sửa code. Cột costUsd là Decimal(10,4) nên mỗi dòng làm tròn 4 chữ số thập phân (lệch tối đa 0.00005 USD/dòng);
// `tokens` luôn chính xác nên có thể tính lại chi phí chuẩn từ tokens khi cần đối soát.
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';

export type UsageKind = 'GENERATION' | 'EMBEDDING';

export interface RecordUsageInput {
  tenantId: string;
  type: UsageKind;
  /** GENERATION: token prompt. EMBEDDING: token của văn bản được embed. */
  inputTokens: number;
  /** Chỉ có ý nghĩa với GENERATION (token câu trả lời, gồm cả token "suy nghĩ" nếu model tính phí). */
  outputTokens?: number;
}

const PER_MILLION = 1_000_000;

function price(config: ConfigService, key: string): number {
  const n = Number(config.get<string | number>(key) ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);
  private readonly priceInputPerM: number;
  private readonly priceOutputPerM: number;
  private readonly priceEmbeddingPerM: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.priceInputPerM = price(config, 'USAGE_PRICE_INPUT_PER_1M_USD');
    this.priceOutputPerM = price(config, 'USAGE_PRICE_OUTPUT_PER_1M_USD');
    this.priceEmbeddingPerM = price(config, 'USAGE_PRICE_EMBEDDING_PER_1M_USD');
  }

  /** Fire-and-forget: gọi không cần await, không bao giờ làm hỏng luồng gọi. */
  record(input: RecordUsageInput): void {
    void this.recordNow(input);
  }

  async recordNow(input: RecordUsageInput): Promise<void> {
    try {
      const inputTokens = Math.max(0, Math.round(input.inputTokens || 0));
      const outputTokens = Math.max(0, Math.round(input.outputTokens ?? 0));
      const tokens = inputTokens + outputTokens;
      if (tokens === 0) return; // không có gì để ghi (provider không trả usage)

      const costUsd =
        input.type === 'EMBEDDING'
          ? (inputTokens * this.priceEmbeddingPerM) / PER_MILLION
          : (inputTokens * this.priceInputPerM +
              outputTokens * this.priceOutputPerM) /
            PER_MILLION;

      await this.prisma.runInTenantContext(input.tenantId, (tx) =>
        tx.usageLog.create({
          data: {
            tenantId: input.tenantId,
            type: input.type,
            tokens,
            costUsd: Number(costUsd.toFixed(4)),
          },
        }),
      );
    } catch (err) {
      this.logger.warn(
        `Could not record usage for tenant ${input.tenantId}: ${String(err)}`,
      );
    }
  }
}
