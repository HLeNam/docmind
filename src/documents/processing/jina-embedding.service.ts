// src/documents/processing/jina-embedding.service.ts
//
// Lựa chọn thứ 2 khớp đúng vector(1536) có sẵn, ngang hàng Gemini — nhưng dùng model
// `jina-embeddings-v4` (KHÔNG phải v5, vì v5 chỉ hỗ trợ dimensions tối đa 1024). v4 hỗ trợ
// `dimensions` 1-2048, đặt 1536 là khớp chính xác cột `vector(1536)` hiện có, không cần migration.
//
// Free tier (công bố CHÍNH THỨC bởi Jina, khác Gemini chỉ có số liệu cộng đồng tự đo): 100 RPM,
// 100,000 TPM, không hết hạn, không cần thẻ thanh toán để lấy API key.
//
// Response theo đúng schema OpenAI (`data: [{ embedding, index }]`) — dùng lại logic sort theo
// index giống OpenAiEmbeddingService, phòng trường hợp response không giữ nguyên thứ tự.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EmbeddingProvider } from './embedding.service.js';

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

  async embedBatch(texts: string[]): Promise<number[][]> {
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
        // 'retrieval.passage' đúng cho việc embed CHUNK tài liệu lúc index. Giống tình huống đã
        // ghi ở GeminiEmbeddingService: khi RetrievalService (module sau) dùng provider này để
        // embed CÂU HỎI user lúc search, về lý thuyết nên dùng 'retrieval.query' — nhưng
        // EmbeddingProvider interface hiện tại không phân biệt 2 ngữ cảnh, nên dùng chung
        // 'retrieval.passage' cho cả 2 ở MVP. Xem lại nếu đo được retrieval kém.
        task: 'retrieval.passage',
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
