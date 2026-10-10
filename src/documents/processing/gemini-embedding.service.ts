// src/documents/processing/gemini-embedding.service.ts
//
// Lựa chọn ĐÁNG CÂN NHẮC NHẤT trong 3 provider thay thế OpenAI (xem so sánh đầy đủ trong
// EMBEDDING_PROVIDER_NOTES.md): Google Gemini có free tier cho embedding API, VÀ
// gemini-embedding-001 hỗ trợ output_dimensionality=1536 — ĐÚNG KHỚP cột
// `embedding Unsupported("vector(1536)")?` đã có sẵn trong schema.prisma, nên KHÔNG CẦN migration
// đổi số chiều vector như khi dùng Ollama (768 chiều, lệch với cột hiện tại).
//
// ⚠️ 1 điểm CHƯA XÁC NHẬN CHẮC CHẮN (khác hẳn rủi ro đã gặp với officeparser/pdf-parse): tài liệu
// REST chính thức không nêu rõ `outputDimensionality` đặt ở đâu trong 1 item của
// `batchEmbedContents` (SDK Python/Node dùng `config.output_dimensionality`, REST thuần thì tài
// liệu chỉ nói field này "deprecated, dùng EmbedContentConfig thay thế" mà không chỉ rõ vị trí
// tương đương trong batch). Code dưới đặt `outputDimensionality` làm field cùng cấp với
// `model`/`content` trong mỗi request item (suy luận từ field tương đương ở endpoint
// `embedContent` đơn lẻ) — BẮT BUỘC gọi thử 1 lần thật và kiểm tra `embedding.length === 1536`
// trước khi tin cậy, giống cách đã làm với officeparser.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingProvider } from './embedding.service.js';

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

  async embedBatch(texts: string[]): Promise<number[][]> {
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
          // task_type mặc định RETRIEVAL_DOCUMENT — đúng cho việc embed CHUNK tài liệu lúc index.
          // Khi RetrievalService (module sau) dùng provider này để embed CÂU HỎI của user lúc
          // search, về lý thuyết nên dùng RETRIEVAL_QUERY để chất lượng tốt hơn (Gemini tối ưu
          // riêng cho từng loại) — nhưng EmbeddingProvider interface hiện tại (embedBatch(texts))
          // không phân biệt được 2 ngữ cảnh này. Chấp nhận đơn giản hoá ở MVP: dùng chung
          // RETRIEVAL_DOCUMENT cho cả 2. Nếu đo được retrieval kém, đây là chỗ đầu tiên cần xem lại.
          taskType: 'RETRIEVAL_DOCUMENT',
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
