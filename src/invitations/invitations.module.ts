import { Module } from '@nestjs/common';
import { InvitationsService } from './invitations.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { InvitationsController } from './invitations.controller.js';

@Module({
  imports: [AuthModule],
  providers: [InvitationsService],
  controllers: [InvitationsController],
})
export class InvitationsModule {}
