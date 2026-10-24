// Kết nối Redis dùng chung cho rate limit (BullMQ có kết nối riêng của nó, không đụng vào).
// Cấu hình để KHÔNG làm treo request khi Redis chết: enableOfflineQueue=false (lệnh lỗi ngay thay vì xếp hàng
// chờ kết nối lại) và maxRetriesPerRequest=1. RateLimitService bắt lỗi đó và rơi về bộ đếm in-memory.
import {
  Global,
  Inject,
  Logger,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const logger = new Logger('RedisClient');
        const client = new Redis(config.getOrThrow<string>('REDIS_URL'), {
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 5000,
        });
        // Bắt buộc có handler 'error', không thì ioredis ném lỗi chưa bắt khi mất kết nối. Giới hạn log để
        // lúc Redis chết không spam mỗi lần thử nối lại.
        let lastLoggedAt = 0;
        client.on('error', (err) => {
          const now = Date.now();
          if (now - lastLoggedAt > 30_000) {
            lastLoggedAt = now;
            logger.warn(
              `Redis error (rate limit sẽ tạm dùng bộ đếm in-memory): ${err.message}`,
            );
          }
        });
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
