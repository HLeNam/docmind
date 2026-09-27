import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { PrismaSystemService } from './prisma-system.service.js';

@Global()
@Module({
  providers: [PrismaService, PrismaSystemService],
  exports: [PrismaService, PrismaSystemService],
})
export class PrismaModule {}
