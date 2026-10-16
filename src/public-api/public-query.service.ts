// POST /v1/query — RAG stateless cho API key: không tạo Conversation/Message, không có lịch sử hội thoại
// (mỗi lần gọi độc lập). Khác ChatService ở 2 điểm: (1) quyền theo SCOPE CỦA KEY chứ không theo membership,
// (2) trả JSON 1 lần thay vì SSE.
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RetrievalService } from '../retrieval/retrieval.service.js';
import { LLM_PROVIDER_TOKEN } from '../chat/llm/llm-provider.interface.js';
import type { LlmProvider } from '../chat/llm/llm-provider.interface.js';
import {
  buildContextBlock,
  buildSystemPrompt,
} from '../chat/rag-prompt.util.js';
import {
  ForbiddenAppException,
  NotFoundAppException,
} from '../common/exceptions/app.exception.js';
import { ErrorCode } from '../common/exceptions/error-codes.js';
import type { ApiKeyPrincipal } from '../api-keys/api-key-principal.js';
import { PublicQueryDto } from './dtos/public-query.dto.js';

const SNIPPET_MAX_CHARS = 300;

export interface PublicQueryCitation {
  index: number;
  documentId: string;
  filename: string;
  chunkIndex: number;
  pageNumber: number | null;
  headingContext: string | null;
  snippet: string;
  score: number;
}

export interface PublicQueryResult {
  answer: string;
  citations: PublicQueryCitation[];
}

@Injectable()
export class PublicQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly retrievalService: RetrievalService,
    @Inject(LLM_PROVIDER_TOKEN) private readonly llm: LlmProvider,
  ) {}

  async query(
    key: ApiKeyPrincipal,
    dto: PublicQueryDto,
  ): Promise<PublicQueryResult> {
    const collectionIds = await this.resolveCollectionIds(
      key,
      dto.collectionId,
    );

    const retrieved = await this.retrievalService.searchInCollections(
      key.tenantId,
      collectionIds,
      dto.query,
      dto.topK,
    );

    // Gom hết các mẩu stream thành 1 chuỗi: API này trả JSON 1 lần. (Streaming cho /v1/query để dành sau
    // nếu có client thật cần — Slack ở 4.5 cần trọn câu trả lời để post vào thread nên không cần stream.)
    let answer = '';
    for await (const delta of this.llm.streamChat({
      systemPrompt: buildSystemPrompt(buildContextBlock(retrieved)),
      messages: [{ role: 'user', content: dto.query }],
    })) {
      answer += delta;
    }

    return {
      answer,
      citations: retrieved.map((chunk, i) => ({
        index: i + 1,
        documentId: chunk.documentId,
        filename: chunk.filename,
        chunkIndex: chunk.chunkIndex,
        pageNumber: chunk.pageNumber,
        headingContext: chunk.headingContext,
        snippet: chunk.content.slice(0, SNIPPET_MAX_CHARS),
        score: chunk.score,
      })),
    };
  }

  /**
   * Xác định tập collection mà request này được phép đọc.
   *  - Key scope 1 collection: chỉ đúng collection đó. Xin collection khác -> 403 (khác chat dùng 404:
   *    ở đây người gọi là máy móc/dev tích hợp, 403 rõ nghĩa giúp họ sửa nhanh, và biết scope key của
   *    chính mình không phải là thông tin nhạy cảm).
   *  - Key scope toàn tenant: mọi collection của tenant (RLS đã giới hạn trong tenant), hoặc thu hẹp
   *    về 1 collection nếu client xin — collection đó phải tồn tại trong tenant, không thì 404.
   */
  private async resolveCollectionIds(
    key: ApiKeyPrincipal,
    requested?: string,
  ): Promise<string[]> {
    if (key.collectionId) {
      if (requested && requested !== key.collectionId) {
        throw new ForbiddenAppException(
          'This API key is not allowed to query that collection',
          ErrorCode.API_KEY_SCOPE_FORBIDDEN,
        );
      }
      return [key.collectionId];
    }

    const tenantCollections = await this.prisma.runInTenantContext(
      key.tenantId,
      (tx) => tx.collection.findMany({ select: { id: true } }),
    );
    const ids = tenantCollections.map((c) => c.id);

    if (requested) {
      if (!ids.includes(requested)) {
        throw new NotFoundAppException(
          'Collection not found',
          ErrorCode.COLLECTION_NOT_FOUND,
        );
      }
      return [requested];
    }
    return ids;
  }
}
