// src/chat/llm/llm.module.ts
//
// Factory + Symbol token — y hệt pattern EmbeddingModule (xem WORKER_MODULE_NOTES.md mục 4 và
// EMBEDDING_PROVIDER_NOTES.md): chỉ Gemini được implement ở đợt này (provider đã chốt dùng, free
// tier, cùng key với EmbeddingModule). Factory vẫn viết theo switch/case ngay từ đầu (không phải
// if/else đơn) để thêm provider khác sau này (vd OpenAI, Ollama local) chỉ cần thêm 1 nhánh case +
// 1 class mới — không sửa ChatService/ChatController nào cả, đúng lý do interface này tồn tại.
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiLlmService } from './gemini-llm.service.js';
import {
  LLM_PROVIDER_TOKEN,
  type LlmProvider,
} from './llm-provider.interface.js';

@Module({
  providers: [
    {
      provide: LLM_PROVIDER_TOKEN,
      inject: [ConfigService],
      // CỐ Ý không khai GeminiLlmService là provider riêng rồi @Inject() vào factory — giữ đúng lý
      // do đã giải thích ở EmbeddingModule: nếu sau này thêm provider thứ 2 (vd OpenAiLlmService) và
      // khai CẢ HAI làm provider, Nest sẽ khởi tạo cả hai lúc bootstrap kể cả cái không dùng, crash
      // vì thiếu API key của provider không chọn. Tự `new` đúng 1 class cần dùng trong factory.
      useFactory: (config: ConfigService): LlmProvider => {
        const provider =
          config.get<string>('LLM_PROVIDER', { infer: true }) ?? 'gemini';
        switch (provider) {
          case 'gemini':
            return new GeminiLlmService(config);
          default:
            throw new Error(
              `Invalid LLM_PROVIDER: "${provider}" (currently only 'gemini' is supported)`,
            );
        }
      },
    },
  ],
  exports: [LLM_PROVIDER_TOKEN],
})
export class LlmModule {}
