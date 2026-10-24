// Provider chính được chọn dùng (thay OpenAI do chưa có ngân sách — xem so sánh đầy đủ trong
// EMBEDDING_PROVIDER_NOTES.md): Google Gemini có free tier cho embedding API, VÀ
// gemini-embedding-001 hỗ trợ output_dimensionality=1536 — ĐÚNG KHỚP cột
// `embedding Unsupported("vector(1536)")?` đã có sẵn trong schema.prisma, nên KHÔNG CẦN migration
// đổi số chiều vector như khi dùng Ollama (768 chiều, lệch với cột hiện tại).
//
// ✅ ĐÃ XÁC NHẬN bằng request thật (10/2026): `outputDimensionality` đặt cùng cấp với
// `model`/`content` trong mỗi request item của `batchEmbedContents` HOẠT ĐỘNG ĐÚNG — vector trả về
// đúng 1536 chiều (tài liệu REST chính thức không nêu rõ vị trí field này, phải tự test để xác
// nhận, giống cách đã làm với officeparser/pdf-parse).
//
// mode 'document' vs 'query': ĐÃ SỬA (trước đây dùng chung RETRIEVAL_DOCUMENT cho cả 2, ghi là hạn
// chế cần xem lại trong RETRIEVAL_MODULE_NOTES.md mục 3). Gemini tối ưu riêng cho 2 taskType:
// RETRIEVAL_DOCUMENT lúc embed chunk tài liệu, RETRIEVAL_QUERY lúc embed câu hỏi user — nay
// embedBatch() nhận thêm tham số mode để chọn đúng taskType.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmbeddingMode, EmbeddingProvider } from './embedding.service.js';

interface GeminiBatchEmbedResponse {
  embeddings: Array<{ values: number[] }>;
}

@Injectable()
export class GeminiEmbeddingService implements EmbeddingProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly outputDimensionality: number;

  constructor(configService: ConfigService) {
    this.apiKey = configService.getOrThrow<string>('GEMINI_API_KEY', {
      infer: true,
    });
    this.model = configService.getOrThrow<string>('GEMINI_EMBEDDING_MODEL', {
      infer: true,
    });
    this.outputDimensionality = configService.getOrThrow<number>(
      'GEMINI_EMBEDDING_DIMENSIONS',
      {
        infer: true,
      },
    );
  }

  // Tham số thứ 3 (onUsage) cố ý KHÔNG dùng: batchEmbedContents của Gemini không trả số token trong response, nên nơi
  // gọi sẽ ước lượng theo độ dài văn bản (UsageService.recordEmbedding). Khai để khớp interface chung.
  async embedBatch(
    texts: string[],
    mode: EmbeddingMode = 'document',
    _onUsage?: (tokens: number) => void,
  ): Promise<number[][]> {
    const taskType =
      mode === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:batchEmbedContents`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${this.model}`,
          content: { parts: [{ text }] },
          taskType,
          outputDimensionality: this.outputDimensionality,
        })),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Gemini embedding request failed (${res.status}): ${body}`,
      );
    }
    const data = (await res.json()) as GeminiBatchEmbedResponse;
    return data.embeddings.map((e) => e.values);
  }
}
