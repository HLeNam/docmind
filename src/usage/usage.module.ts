// @Global: Chat, PublicApi, Slack, Worker, Retrieval inject UsageService (ghi log) mà không cần import.
// Chỉ import UsageModule MỘT LẦN ở AppModule. PrismaModule/ConfigModule đã global.
// Thêm GET /usage/summary (UsageController + UsageSummaryService) — không đổi cách các module khác dùng UsageService.
import { Global, Module } from '@nestjs/common';
import { UsageController } from './usage.controller.js';
import { UsageService } from './usage.service.js';
import { UsageSummaryService } from './usage-summary.service.js';

@Global()
@Module({
  controllers: [UsageController],
  providers: [UsageService, UsageSummaryService],
  exports: [UsageService],
})
export class UsageModule {}
