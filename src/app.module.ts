import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from '@nestjs/config';
import {
  appConfig,
  databaseConfig,
  jwtConfig,
  envSchema,
} from './config/index.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './common/guards/roles.guard.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // dùng ConfigService ở mọi module không cần import lại
      cache: true, // tăng performance khi đọc process.env nhiều lần
      expandVariables: true, // hỗ trợ biến lồng nhau kiểu ${APP_URL}
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      envFilePath: ['.env.local', '.env'], // ưu tiên .env.local nếu có
      load: [appConfig, databaseConfig, jwtConfig],
      validationSchema: envSchema,
    }),

    PrismaModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Thứ tự trong mảng LÀ thứ tự chạy: JwtAuthGuard phải chạy trước RolesGuard,
    // vì RolesGuard cần đọc request.user.role — chỉ có sau khi JwtAuthGuard verify token xong.
    // Mặc định MỌI route đều bị JwtAuthGuard chặn, trừ route có @Public() (xem mục 4.4/4.5).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
