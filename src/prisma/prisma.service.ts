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
  private readonly pool: Pool; // Lưu lại reference của Pool để đóng kết nối

  constructor(configService: ConfigService) {
    // Khởi tạo connection pool thông qua pg
    const pool = new Pool({
      connectionString: configService.get<string>('DATABASE_URL', {
        infer: true,
      }),
    });
    // Bọc vào Prisma Adapter (Bắt buộc ở Prisma 7)
    const adapter = new PrismaPg(pool);

    // Bật log ở đây để dễ debug xem Prisma sinh câu SQL như thế nào
    super({
      adapter,
      log: ['error', 'warn'],
    });

    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Prisma connected to PostgreSQL');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end(); // Chốt chặn: Đóng hẳn connection pool của pg
    this.logger.log('Prisma & PG Pool disconnected');
  }

  /**
   * Chạy 1 transaction với RLS context đã set.
   * MỌI query cần lọc theo tenant phải chạy qua transaction này.
   *
   * Lưu ý bảo mật: `SET LOCAL` không hỗ trợ parameterized query của Postgres,
   * nên phải tự validate format UUID trước khi interpolate string — tránh SQL injection.
   */
  async runInTenantContext<T>(
    tenantId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (!this.isValidUuid(tenantId)) {
      throw new Error(`Invalid tenantId format: ${tenantId}`);
    }

    return this.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant = '${tenantId}'`,
      );
      return fn(tx);
    });
  }

  /**
   * Chạy 1 transaction bỏ qua RLS (Dành cho các API Global/Auth/Admin).
   * LƯU Ý: Chỉ dùng khi bắt buộc phải query data xuyên Tenant (ví dụ: Lấy danh sách Workspaces của User).
   */
  async runAsSystem<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      // Vì ta đã dùng cờ FORCE ROW LEVEL SECURITY,
      // ta cần tắt row_security tạm thời để superuser có thể đọc toàn bộ data.
      await tx.$executeRawUnsafe(`SET LOCAL row_security = off`);

      return fn(tx);
    });
  }

  private isValidUuid(value: string): boolean {
    return z.string().uuid().safeParse(value).success;
  }
}
