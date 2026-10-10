import { Module } from '@nestjs/common';
import { CollectionsService } from './collections.service.js';
import { CollectionsController } from './collections.controller.js';

@Module({
  providers: [CollectionsService],
  controllers: [CollectionsController]
})
export class CollectionsModule {}
