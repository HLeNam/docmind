import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { Prisma, PrismaClient } from './prisma-client.js';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor(configService: ConfigService) {
    // QUAN TRỌNG: dùng APP_DATABASE_URL (role docmind_app), KHÔNG dùng DATABASE_URL (owner/superuser).
    // Dùng nhầm DATABASE_URL ở đây là lỗi âm thầm nguy hiểm nhất của cả hệ thống RLS —
    // mọi query sẽ chạy bằng quyền bypass RLS mà không có dấu hiệu lỗi nào cả.
    const pool = new Pool({
      connectionString: configService.get<string>('APP_DATABASE_URL', {
        infer: true,
      }),
    });
    const adapter = new PrismaPg(pool);

    super({ adapter, log: ['error', 'warn'] });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected to PostgreSQL (role: docmind_app)');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end(); // đóng hẳn pool pg vì ta tự tạo, Prisma không tự đóng connection ta truyền vào
    this.logger.log('Prisma & PG Pool disconnected');
  }

  /**
   * Chạy 1 transaction với RLS context đã set app.current_tenant.
   * MỌI query cần lọc theo tenant phải chạy qua đây.
   *
   * Dùng set_config() (function call) thay vì `SET LOCAL ... = '<interpolated>'` (utility statement)
   * vì function call hỗ trợ bind parameter thật ($1) — loại bỏ hoàn toàn nguy cơ SQL injection
   * mà không cần validate UUID thủ công. is_local=true tương đương SET LOCAL: chỉ có hiệu lực
   * trong transaction hiện tại, tự reset khi transaction kết thúc.
   */
  async runInTenantContext<T>(
    tenantId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.current_tenant', $1, true)`,
        tenantId,
      );
      return fn(tx);
    });
  }
}
