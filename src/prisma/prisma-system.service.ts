// PrismaClient RIÊNG, chỉ dùng cho truy vấn admin/xuyên-tenant hợp lệ (Super Admin dashboard, job hệ thống).
// Kết nối bằng role docmind_system (BYPASSRLS thật, không phải "row_security = off").
// Không inject service này vào bất kỳ chỗ nào xử lý request thường của user — chỉ dùng ở nơi
// đã tự kiểm tra quyền Super Admin trước đó.
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { PrismaClient } from './prisma-client.js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaSystemService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaSystemService.name);
  private readonly pool: Pool;

  constructor(configService: ConfigService) {
    const pool = new Pool({
      connectionString: configService.get<string>('SYSTEM_DATABASE_URL', {
        infer: true,
      }),
    });
    super({ adapter: new PrismaPg(pool), log: ['error', 'warn'] });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.warn(
      'PrismaSystemService connected (role: docmind_system, BYPASSRLS) — chỉ dùng cho truy vấn admin',
    );
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
