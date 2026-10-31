import { Module } from '@nestjs/common';
import { MembersService } from './members.service.js';
import { MembersController } from './members.controller.js';

@Module({
  providers: [MembersService],
  controllers: [MembersController],
  exports: [MembersService],
})
export class MembersModule {}
