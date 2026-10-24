// Module riêng cho ProgressGateway để DocumentsModule (và sau này worker module nếu tách riêng)
// chỉ cần import RealtimeModule, không cần biết chi tiết bên trong gateway.
//
// JwtModule: gateway tự verify access token lúc handshake. Dùng cùng JWT_SECRET với AuthModule, đăng ký lại
// ở đây (thay vì phụ thuộc AuthModule export) để RealtimeModule độc lập, không tạo vòng phụ thuộc.
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ProgressGateway } from './progress.gateway.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [ProgressGateway],
  exports: [ProgressGateway],
})
export class RealtimeModule {}
