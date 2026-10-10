// src/documents/processing/embedding.service.ts
//
// Tách interface EmbeddingProvider ngay từ đầu — đúng pattern MailProvider đã dùng ở Phase 1 — để
// sau này thêm provider khác (Cohere, hoặc local qua Ollama cho tổ chức self-hosted không gọi API
// ra ngoài, đúng mục tiêu định vị sản phẩm "không phải hộp đen") chỉ cần thêm 1 class, không đụng
// gì tới DocumentProcessingProcessor/RetrievalService đang dùng interface này.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmbeddingProvider {
  embedBatch(texts: string[]): Promise<number[][]>;
}

@Injectable()
export class OpenAiEmbeddingService implements EmbeddingProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(configService: ConfigService) {
    this.apiKey = configService.getOrThrow<string>('OPENAI_API_KEY', {
      infer: true,
    });
    this.model = configService.getOrThrow<string>('EMBEDDING_MODEL', {
      infer: true,
    });
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `OpenAI embedding request failed (${res.status}): ${body}`,
      );
    }
    const data = (await res.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };
    // API trả về có thể không giữ nguyên thứ tự -> sort lại theo index cho chắc, để chunk thứ i
    // trong input luôn khớp đúng embedding thứ i trong kết quả trả về.
    return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}
