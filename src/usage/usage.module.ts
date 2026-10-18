// @Global: Chat, PublicApi, Slack (và sau này Worker/Retrieval cho embedding) inject UsageService mà không cần import.
// Chỉ import UsageModule MỘT LẦN ở AppModule. PrismaModule/ConfigModule đã global.
import { Global, Module } from '@nestjs/common';
import { UsageService } from './usage.service.js';

@Global()
@Module({
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
