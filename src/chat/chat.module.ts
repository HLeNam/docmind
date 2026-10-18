import { Module } from '@nestjs/common';
import { ChatService } from './chat.service.js';
import { ChatController } from './chat.controller.js';
import { ConversationsController } from './conversations.controller.js';
import { ConversationsService } from './conversations.service.js';
import { ConversationSummarizerService } from './conversation-summarizer.service.js';
import { RetrievalModule } from '../retrieval/retrieval.module.js';
import { LlmModule } from './llm/llm.module.js';

@Module({
  // RetrievalModule: lấy context (chunk liên quan) cho RAG. LlmModule: LLM_PROVIDER_TOKEN để sinh
  // câu trả lời streaming. Cả 2 đều nhẹ, không kéo theo BullMQ/StorageModule.
  imports: [RetrievalModule, LlmModule],
  providers: [ChatService, ConversationsService, ConversationSummarizerService],
  controllers: [ChatController, ConversationsController],
})
export class ChatModule {}
