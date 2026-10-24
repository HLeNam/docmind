// src/retrieval/retrieval.module.ts
import { Module } from '@nestjs/common';
import { RetrievalService } from './retrieval.service.js';
import { RetrievalController } from './retrieval.controller.js';
import { CollectionsModule } from '../collections/collections.module.js';
import { EmbeddingModule } from '../documents/processing/embedding.module.js';

@Module({
  // CollectionsModule: cần CollectionsService.listAccessibleCollectionIds() để lọc quyền.
  // EmbeddingModule: cần EMBEDDING_PROVIDER_TOKEN để embed câu hỏi của user lúc search — module
  // này nhẹ (không kéo theo BullMQ/StorageModule/ProgressGateway như DocumentsModule), đúng lý do
  // đã tách EmbeddingModule riêng từ đầu (xem WORKER_MODULE_NOTES.md mục 4).
  imports: [CollectionsModule, EmbeddingModule],
  providers: [RetrievalService],
  controllers: [RetrievalController],
  exports: [RetrievalService], // ChatModule (bước sau) sẽ dùng RetrievalService để lấy context trả lời
})
export class RetrievalModule {}
