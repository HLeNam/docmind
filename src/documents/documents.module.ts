import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { StorageModule } from '../storage/storage.module.js';
import { CollectionsModule } from '../collections/collections.module.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';

@Module({
  imports: [
    // Chỉ ĐĂNG KÝ queue ở đây (cho phép @InjectQueue('document-processing') hoạt động) — chưa gắn
    // @Processor xử lý job thật, việc đó thuộc module Worker (sẽ làm ở bước kế tiếp). BullModule
    // cần BullModule.forRootAsync() (đọc REDIS_URL) đã được import ở AppModule — xem notes.
    BullModule.registerQueue({ name: 'document-processing' }),
    StorageModule,
    CollectionsModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
