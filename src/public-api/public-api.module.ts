import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../api-keys/api-key.guard.js';
import { PublicApiController } from './public-api.controller.js';

// PrismaModule là @Global() nên ApiKeyGuard resolve được PrismaSystemService mà không cần import.
@Module({
  controllers: [PublicApiController],
  providers: [ApiKeyGuard],
})
export class PublicApiModule {}
