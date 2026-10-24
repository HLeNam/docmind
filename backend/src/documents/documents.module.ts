import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DocumentsService } from './documents.service.js';
import { DocumentsController } from './documents.controller.js';
import { StorageModule } from '../storage/storage.module.js';
import { CollectionsModule } from '../collections/collections.module.js';
import { EmbeddingModule } from './processing/embedding.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { DocumentProcessingProcessor } from './processing/document-processing.processor.js';

@Module({
  imports: [
    // Đăng ký queue (cho phép @InjectQueue('document-processing') ở DocumentsService hoạt động)
    // VÀ gắn @Processor xử lý job thật (DocumentProcessingProcessor) cùng trong module này — giữ
    // nguyên cách đã chọn từ trước (không tách QueueModule riêng như draft doc Phase 2 gốc từng
    // nhắc tới), để khớp với DocumentsModule đã gửi ở các đợt trước. BullModule.forRootAsync() (đọc
    // REDIS_URL) vẫn phải đã được import ở AppModule — xem WORKER_MODULE_NOTES.md.
    BullModule.registerQueue({ name: 'document-processing' }),
    StorageModule,
    CollectionsModule,
    // EmbeddingModule: processor cần EMBEDDING_PROVIDER_TOKEN để embed chunk lúc index.
    EmbeddingModule,
    // RealtimeModule: processor cần ProgressGateway để báo tiến độ realtime qua WebSocket.
    RealtimeModule,
  ],
  providers: [DocumentsService, DocumentProcessingProcessor],
  controllers: [DocumentsController],
  exports: [DocumentsService],
})
export class DocumentsModule {}
