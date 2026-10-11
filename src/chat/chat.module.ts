import { Module } from '@nestjs/common';
import { ChatService } from './chat.service.js';
import { ChatController } from './chat.controller.js';
import { RetrievalModule } from '../retrieval/retrieval.module.js';
import { LlmModule } from './llm/llm.module.js';

@Module({
  // RetrievalModule: lấy context (chunk liên quan) cho RAG. LlmModule: LLM_PROVIDER_TOKEN để sinh
  // câu trả lời streaming. Cả 2 đều nhẹ, không kéo theo BullMQ/StorageModule.
  imports: [RetrievalModule, LlmModule],
  providers: [ChatService],
  controllers: [ChatController],
})
export class ChatModule {}
