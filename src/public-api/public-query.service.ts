// RAG stateless cho API key (POST /v1/query và /v1/query/stream): không tạo Conversation/Message, không
// có lịch sử hội thoại (mỗi lần gọi độc lập). Khác ChatService ở 2 điểm: (1) quyền theo SCOPE CỦA KEY chứ
// không theo membership, (2) không lưu gì vào DB.
//
// Tách prepare() / streamAnswer() giống ChatService vì cùng lý do ranh giới HTTP (xem chat.service.ts):
// mọi lỗi nghiệp vụ (403 scope, 404 collection...) phải throw TRONG prepare(), TRƯỚC khi route SSE set
// header; lỗi LLM giữa chừng mới là lỗi trong luồng stream.
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RetrievalService } from '../retrieval/retrieval.service.js';
import { LLM_PROVIDER_TOKEN } from '../chat/llm/llm-provider.interface.js';
import type {
  ChatMessage,
  LlmProvider,
} from '../chat/llm/llm-provider.interface.js';
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
import type { PublicQueryDto } from './schemas/public-query.schema.js';

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

export interface PreparedPublicQuery {
  citations: PublicQueryCitation[];
  systemPrompt: string;
  messages: ChatMessage[];
}

@Injectable()
export class PublicQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly retrievalService: RetrievalService,
    @Inject(LLM_PROVIDER_TOKEN) private readonly llm: LlmProvider,
  ) {}

  /**
   * Phần CÓ THỂ throw lỗi nghiệp vụ bình thường + tốn embedding (retrieval), chưa gọi LLM.
   * Route SSE PHẢI await xong hàm này trước khi set header.
   */
  async prepare(
    key: ApiKeyPrincipal,
    dto: PublicQueryDto,
  ): Promise<PreparedPublicQuery> {
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

    return {
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
      systemPrompt: buildSystemPrompt(buildContextBlock(retrieved)),
      messages: [{ role: 'user', content: dto.query }],
    };
  }

  /** Sinh câu trả lời từng mẩu — lỗi ở đây là lỗi GIỮA CHỪNG (route SSE tự bắt bằng try/catch). */
  async *streamAnswer(prepared: PreparedPublicQuery): AsyncGenerator<string> {
    yield* this.llm.streamChat({
      systemPrompt: prepared.systemPrompt,
      messages: prepared.messages,
    });
  }

  /** Bản không stream (POST /v1/query): gom hết các mẩu thành 1 chuỗi, trả JSON 1 lần. */
  async query(
    key: ApiKeyPrincipal,
    dto: PublicQueryDto,
  ): Promise<PublicQueryResult> {
    const prepared = await this.prepare(key, dto);

    let answer = '';
    for await (const delta of this.streamAnswer(prepared)) {
      answer += delta;
    }
    return { answer, citations: prepared.citations };
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
