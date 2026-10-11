// Module riêng cho ProgressGateway để DocumentsModule (và sau này worker module nếu tách riêng)
// chỉ cần import RealtimeModule, không cần biết chi tiết bên trong gateway.
import { Module } from '@nestjs/common';
import { ProgressGateway } from './progress.gateway.js';

@Module({
  providers: [ProgressGateway],
  exports: [ProgressGateway],
})
export class RealtimeModule {}
