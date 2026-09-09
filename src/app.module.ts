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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
