import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../api-keys/api-key.guard.js';
import { RetrievalModule } from '../retrieval/retrieval.module.js';
import { LlmModule } from '../chat/llm/llm.module.js';
import { PublicApiController } from './public-api.controller.js';
import { PublicQueryService } from './public-query.service.js';

// PrismaModule là @Global() nên ApiKeyGuard/PublicQueryService resolve được Prisma mà không cần import.
// RetrievalModule: searchInCollections(). LlmModule: LLM_PROVIDER_TOKEN (cùng provider với chat).
@Module({
  imports: [RetrievalModule, LlmModule],
  controllers: [PublicApiController],
  providers: [ApiKeyGuard, PublicQueryService],
  exports: [PublicQueryService], // SlackModule (/ask) dùng lại cùng luồng RAG
})
export class PublicApiModule {}
