// Hybrid search: kết hợp vector similarity (pgvector cosine distance, toán tử `<=>`) với full-text
// search (cột `content_tsv` có sẵn từ Phase 1 — trigger `tsvectorupdate` tự điền mỗi lần insert
// chunk, xem migration.sql) bằng Reciprocal Rank Fusion (RRF). RRF được chọn thay vì cộng trực tiếp
// 2 điểm số vì cosine distance (~0..2) và ts_rank (~0..1, phụ thuộc độ dài query) KHÔNG cùng thang
// đo, cộng thẳng vào nhau vô nghĩa — RRF chỉ dùng THỨ HẠNG (rank) trong mỗi danh sách, không quan
// tâm giá trị điểm số gốc:
//
//   score(chunk) = Σ 1 / (k + rank_i(chunk))   với mọi danh sách i mà chunk xuất hiện
//
// k=60 là hằng số kinh nghiệm phổ biến trong tài liệu Information Retrieval (giảm ảnh hưởng của
// chênh lệch rank quá lớn ở top đầu), đúng theo RRF_K đã chốt từ doc Phase 2 gốc.
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CollectionsService } from '../collections/collections.service.js';
import { EMBEDDING_PROVIDER_TOKEN } from '../documents/processing/embedding.module.js';
import type { EmbeddingProvider } from '../documents/processing/embedding.service.js';
import type { AccessTokenPayload } from '../auth/auth.service.js';
import { RetrievalSearchDto } from './dtos/retrieval.dto.js';

const RRF_K = 60;
// Mỗi nhánh (vector/full-text) lấy rộng hơn topK cuối cùng trước khi fusion — 1 chunk hạng thấp ở
// nhánh này nhưng hạng cao ở nhánh kia vẫn cần có mặt trong tập ứng viên thì RRF mới cộng điểm đúng.
const CANDIDATE_MULTIPLIER = 4;

export interface RetrievedChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  headingContext: string | null;
  pageNumber: number | null;
  filename: string;
  score: number;
}

interface RetrievedChunkRow {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  headingContext: string | null;
  pageNumber: number | null;
  filename: string;
  // Postgres driver có thể trả double precision dưới dạng string tuỳ cấu hình parse type của
  // node-postgres — ép lại Number() tường minh trước khi trả ra ngoài, không tin kiểu TS khai báo.
  score: number | string;
}

@Injectable()
export class RetrievalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collectionsService: CollectionsService,
    // Inject qua token (xem EMBEDDING_PROVIDER_NOTES.md), KHÔNG import thẳng
    // GeminiEmbeddingService/JinaEmbeddingService — đổi provider chỉ cần đổi env.
    @Inject(EMBEDDING_PROVIDER_TOKEN)
    private readonly embedding: EmbeddingProvider,
  ) {}

  async search(
    caller: AccessTokenPayload,
    dto: RetrievalSearchDto,
  ): Promise<RetrievedChunk[]> {
    const accessibleCollectionIds =
      await this.collectionsService.listAccessibleCollectionIds(caller);

    // dto.collectionId: thu hẹp phạm vi search về đúng 1 collection — PHẢI đối chiếu với danh sách
    // accessible, không tin thẳng input. Trả mảng rỗng thay vì throw NotFound khi không có quyền:
    // search trả "không có kết quả" không làm lộ việc collection đó có tồn tại hay không, giống
    // cách CollectionsService.assertCollectionAccessible dùng 404 thay vì 403 ở chỗ khác.
    const searchCollectionIds = dto.collectionId
      ? accessibleCollectionIds.filter((id) => id === dto.collectionId)
      : accessibleCollectionIds;

    if (searchCollectionIds.length === 0) {
      return [];
    }

    // mode='query': đây là chỗ embed CÂU HỎI user lúc search, khác ngữ cảnh embed CHUNK tài liệu lúc
    // index (DocumentProcessingProcessor dùng mode='document') — ĐÃ SỬA, trước đây dùng chung 1 task
    // type cho cả 2 (xem EmbeddingMode trong embedding.service.ts).
    const [queryVector] = await this.embedding.embedBatch([dto.query], 'query');
    const vectorLiteral = `[${queryVector.join(',')}]`;
    const candidateLimit = dto.topK * CANDIDATE_MULTIPLIER;

    const rows = await this.prisma.runInTenantContext(
      caller.tenantId,
      (tx) =>
        tx.$queryRaw<RetrievedChunkRow[]>`
        WITH vector_matches AS (
          SELECT
            dc.id, dc.document_id, dc.content, dc.chunk_index, dc.heading_context, dc.page_number,
            d.filename,
            ROW_NUMBER() OVER (ORDER BY dc.embedding <=> ${vectorLiteral}::vector) AS rank
          FROM document_chunks dc
          JOIN documents d ON d.id = dc.document_id
          WHERE dc.embedding IS NOT NULL AND d.collection_id = ANY(${searchCollectionIds}::text[])
          ORDER BY dc.embedding <=> ${vectorLiteral}::vector
          LIMIT ${candidateLimit}
        ),
        fts_matches AS (
          SELECT
            dc.id, dc.document_id, dc.content, dc.chunk_index, dc.heading_context, dc.page_number,
            d.filename,
            ROW_NUMBER() OVER (
              ORDER BY ts_rank(dc.content_tsv, plainto_tsquery('simple', ${dto.query})) DESC
            ) AS rank
          FROM document_chunks dc
          JOIN documents d ON d.id = dc.document_id
          WHERE dc.content_tsv @@ plainto_tsquery('simple', ${dto.query})
            AND d.collection_id = ANY(${searchCollectionIds}::text[])
          LIMIT ${candidateLimit}
        )
        SELECT
          COALESCE(v.id, f.id) AS id,
          COALESCE(v.document_id, f.document_id) AS "documentId",
          COALESCE(v.content, f.content) AS content,
          COALESCE(v.chunk_index, f.chunk_index) AS "chunkIndex",
          COALESCE(v.heading_context, f.heading_context) AS "headingContext",
          COALESCE(v.page_number, f.page_number) AS "pageNumber",
          COALESCE(v.filename, f.filename) AS filename,
          (COALESCE(1.0 / (${RRF_K} + v.rank), 0) + COALESCE(1.0 / (${RRF_K} + f.rank), 0)) AS score
        FROM vector_matches v
        FULL OUTER JOIN fts_matches f ON v.id = f.id
        ORDER BY score DESC
        LIMIT ${dto.topK}
      `,
    );

    return rows.map((row) => ({ ...row, score: Number(row.score) }));
  }
}
