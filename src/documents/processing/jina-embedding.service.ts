// Lựa chọn thứ 2 khớp đúng vector(1536) có sẵn, ngang hàng Gemini — nhưng dùng model
// `jina-embeddings-v4` (KHÔNG phải v5, vì v5 chỉ hỗ trợ dimensions tối đa 1024). v4 hỗ trợ
// `dimensions` 1-2048, đặt 1536 là khớp chính xác cột `vector(1536)` hiện có, không cần migration.
//
// Free tier (công bố CHÍNH THỨC bởi Jina, khác Gemini chỉ có số liệu cộng đồng tự đo): 100 RPM,
// 100,000 TPM, không hết hạn, không cần thẻ thanh toán để lấy API key.
//
// Response theo đúng schema OpenAI (`data: [{ embedding, index }]`) — dùng lại logic sort theo
// index giống OpenAiEmbeddingService, phòng trường hợp response không giữ nguyên thứ tự.
//
// mode 'document' vs 'query': ĐÃ SỬA (trước đây dùng chung 'retrieval.passage' cho cả 2, ghi là hạn
// chế cần xem lại). Jina tối ưu riêng cho 2 task: 'retrieval.passage' lúc embed chunk tài liệu,
// 'retrieval.query' lúc embed câu hỏi user — nay embedBatch() nhận thêm tham số mode để chọn đúng
// task.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmbeddingMode, EmbeddingProvider } from './embedding.service.js';

interface JinaEmbedResponse {
  data: Array<{ embedding: number[]; index: number }>;
}

@Injectable()
export class JinaEmbeddingService implements EmbeddingProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly dimensions: number;

  constructor(configService: ConfigService) {
    this.apiKey = configService.getOrThrow<string>('JINA_API_KEY', {
      infer: true,
    });
    this.model = configService.getOrThrow<string>('JINA_EMBEDDING_MODEL', {
      infer: true,
    });
    this.dimensions = configService.getOrThrow<number>(
      'JINA_EMBEDDING_DIMENSIONS',
      { infer: true },
    );
  }

  async embedBatch(
    texts: string[],
    mode: EmbeddingMode = 'document',
  ): Promise<number[][]> {
    const task = mode === 'query' ? 'retrieval.query' : 'retrieval.passage';
    const res = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        dimensions: this.dimensions,
        normalized: true,
        embedding_type: 'float',
        task,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Jina embedding request failed (${res.status}): ${body}`);
    }
    const data = (await res.json()) as JinaEmbedResponse;
    return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}
