// src/documents/processing/embedding.module.ts
//
// Factory pattern giống hệt MailProvider ở Phase 1: interface (EmbeddingProvider) + Symbol
// injection token + factory chọn implementation theo env EMBEDDING_PROVIDER. Chỗ nào cần embed
// (DocumentProcessingProcessor, RetrievalService sau này) inject qua token này, KHÔNG import thẳng
// OpenAiEmbeddingService/OllamaEmbeddingService — đổi provider chỉ cần đổi env, không sửa code.
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmbeddingProvider,
  OpenAiEmbeddingService,
} from './embedding.service.js';
import { OllamaEmbeddingService } from './ollama-embedding.service.js';
import { GeminiEmbeddingService } from './gemini-embedding.service.js';
import { JinaEmbeddingService } from './jina-embedding.service.js';

export const EMBEDDING_PROVIDER_TOKEN = Symbol('EMBEDDING_PROVIDER_TOKEN');

@Module({
  providers: [
    {
      provide: EMBEDDING_PROVIDER_TOKEN,
      inject: [ConfigService],
      // CỐ Ý không khai OpenAiEmbeddingService/OllamaEmbeddingService là provider riêng rồi
      // @Inject() cả 2 vào factory — làm vậy Nest sẽ khởi tạo CẢ HAI ngay lúc bootstrap (kể cả cái
      // không dùng), mà constructor của mỗi service dùng getOrThrow() cho API key/model riêng của
      // nó -> app sẽ crash lúc khởi động vì thiếu OPENAI_API_KEY dù đang chọn dùng Ollama (hoặc
      // ngược lại). Tự `new` đúng 1 class cần dùng bên trong factory để chỉ cấu hình nào thật sự
      // được chọn mới bị validate.
      useFactory: (config: ConfigService): EmbeddingProvider => {
        // Mặc định 'openai' để không đổi hành vi cho ai đã cấu hình sẵn OPENAI_API_KEY từ trước —
        // set EMBEDDING_PROVIDER=ollama khi chưa có ngân sách gọi API trả phí.
        const provider =
          config.get<string>('EMBEDDING_PROVIDER', { infer: true }) ?? 'openai';
        switch (provider) {
          case 'ollama':
            return new OllamaEmbeddingService(config);
          case 'gemini':
            return new GeminiEmbeddingService(config);
          case 'jina':
            return new JinaEmbeddingService(config);
          case 'openai':
            return new OpenAiEmbeddingService(config);
          default:
            throw new Error(
              `Invalid EMBEDDING_PROVIDER: "${provider}" (expected 'openai' | 'gemini' | 'ollama' | 'jina')`,
            );
        }
      },
    },
  ],
  exports: [EMBEDDING_PROVIDER_TOKEN],
})
export class EmbeddingModule {}
