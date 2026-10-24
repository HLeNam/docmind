// Tách interface EmbeddingProvider ngay từ đầu — đúng pattern MailProvider đã dùng ở Phase 1 — để
// sau này thêm provider khác (Cohere, hoặc local qua Ollama cho tổ chức self-hosted không gọi API
// ra ngoài, đúng mục tiêu định vị sản phẩm "không phải hộp đen") chỉ cần thêm 1 class, không đụng
// gì tới DocumentProcessingProcessor/RetrievalService đang dùng interface này.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// 'document': embed CHUNK tài liệu lúc index (DocumentProcessingProcessor).
// 'query': embed CÂU HỎI user lúc search (RetrievalService). Gemini/Jina tối ưu riêng cho 2 ngữ
// cảnh này (taskType khác nhau) — trước đây dùng chung 1 task type cho cả 2, đã ghi là hạn chế cần
// sửa trong RETRIEVAL_MODULE_NOTES.md mục 3, giờ sửa ở đây. Mặc định 'document' (giữ nguyên hành vi
// cũ cho mọi chỗ gọi embedBatch() không truyền mode — chỉ RetrievalService cần đổi sang 'query').
export type EmbeddingMode = 'document' | 'query';

export interface EmbeddingProvider {
  // onUsage (tuỳ chọn): provider GỌI 1 LẦN với số token thật nếu API có trả (OpenAI/Jina/Ollama có, Gemini không).
  // Không gọi = provider không biết -> nơi gọi tự ước lượng (UsageService.recordEmbedding).
  embedBatch(
    texts: string[],
    mode?: EmbeddingMode,
    onUsage?: (tokens: number) => void,
  ): Promise<number[][]>;
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

  // OpenAI embedding API không có khái niệm "query vs document" (không có tham số taskType tương
  // đương Gemini/Jina) -> tham số mode bị bỏ qua, chỉ khai để khớp interface chung.
  async embedBatch(
    texts: string[],
    _mode?: EmbeddingMode,
    onUsage?: (tokens: number) => void,
  ): Promise<number[][]> {
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
      usage?: { total_tokens?: number };
    };
    if (typeof data.usage?.total_tokens === 'number')
      onUsage?.(data.usage.total_tokens);
    // API trả về có thể không giữ nguyên thứ tự -> sort lại theo index cho chắc, để chunk thứ i
    // trong input luôn khớp đúng embedding thứ i trong kết quả trả về.
    return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }
}
