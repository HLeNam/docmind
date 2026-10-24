// src/common/rate-limit/rate-limit.module.ts
//
// @Global: mọi module (ApiKeys, PublicApi, Chat, Slack...) inject được RateLimitService mà không cần import.
// Chỉ cần import RateLimitModule MỘT LẦN ở AppModule.
import { Global, Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service.js';
import { RedisModule } from './redis.module.js';

@Global()
@Module({
  imports: [RedisModule],
  providers: [RateLimitService],
  exports: [RateLimitService],
})
export class RateLimitModule {}
