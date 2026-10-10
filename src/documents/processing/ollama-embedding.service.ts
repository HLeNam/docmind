// src/documents/processing/ollama-embedding.service.ts
//
// Provider thay thế OpenAI, dùng cho khi chưa có ngân sách gọi API trả phí — Ollama chạy model
// embedding MIỄN PHÍ ngay trên máy (hoặc server riêng), không gọi ra ngoài internet. Cũng đúng
// tinh thần "không phải hộp đen", tổ chức self-hosted hoàn toàn không cần gọi API ra ngoài.
//
// ⚠️ KHÁC SỐ CHIỀU VECTOR với OpenAI: model gợi ý `nomic-embed-text` ra vector 768 chiều, trong khi
// schema.prisma hiện định nghĩa cột `embedding Unsupported("vector(1536)")` (khớp
// text-embedding-3-small của OpenAI, 1536 chiều). ĐỔI PROVIDER KHÔNG TỰ ĐỔI CỘT DB — xem
// EMBEDDING_MODULE_NOTES.md mục "Đổi số chiều vector trong DB" trước khi bật provider này.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingProvider } from './embedding.service.js';

interface OllamaEmbedResponse {
  embeddings: number[][];
}

@Injectable()
export class OllamaEmbeddingService implements EmbeddingProvider {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(configService: ConfigService) {
    this.baseUrl = configService.getOrThrow<string>('OLLAMA_BASE_URL', {
      infer: true,
    });
    this.model = configService.getOrThrow<string>('OLLAMA_EMBEDDING_MODEL', {
      infer: true,
    });
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // /api/embed (bản hiện hành, thay cho /api/embeddings cũ đã deprecated) — nhận "input" là
    // string hoặc mảng string để batch, trả "embeddings" là mảng vector ĐÚNG THEO THỨ TỰ input
    // (không có field index để tự sort lại như OpenAI, nên không cần sort ở đây).
    const res = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Ollama embedding request failed (${res.status}): ${body}. ` +
          `Check if Ollama is running (\`ollama serve\`) and the model is pulled (\`ollama pull ${this.model}\`).`,
      );
    }
    const data = (await res.json()) as OllamaEmbedResponse;
    return data.embeddings;
  }
}
