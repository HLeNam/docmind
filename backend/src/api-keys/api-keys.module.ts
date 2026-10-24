import { Module } from '@nestjs/common';
import { ApiKeysController } from './api-keys.controller.js';
import { ApiKeysService } from './api-keys.service.js';

// PrismaModule đã @Global() nên không cần import. ApiKeysService export để ApiKeyGuard/QueryModule
// (bước 4.2/4.3) có thể dùng lại nếu cần.
@Module({
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
