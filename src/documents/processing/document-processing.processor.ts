// src/documents/processing/document-processing.processor.ts
//
// Phần nặng nhất Phase 2: BullMQ worker nối toàn bộ pipeline lại — download từ storage -> extract
// text -> chunk -> embed theo batch -> insert pgvector (raw SQL, Prisma không hỗ trợ insert trực
// tiếp cột Unsupported("vector(1536)")) -> báo tiến độ qua ProgressGateway -> cập nhật
// Document.status cuối cùng (INDEXED/FAILED).
//
// Dùng PrismaSystemService (role docmind_system, BYPASSRLS thật — xem docmind-phase1-implementation.md
// mục 3), KHÔNG dùng PrismaService.runInTenantContext() như mọi service xử lý request HTTP thường:
// job BullMQ không có request/JWT nào để lấy tenantId từ đó — ngược lại, chính Document record (tra
// theo documentId trong job data) MỚI LÀ nguồn xác định tenantId. Đây đúng là tình huống
// "truy vấn hệ thống/worker hợp lệ" mà PrismaSystemService sinh ra để phục vụ, không phải lỗ hổng.
import { Inject, Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { PrismaSystemService } from '../../prisma/prisma-system.service.js';
import { StorageService } from '../../storage/storage.service.js';
import { ProgressGateway } from '../../realtime/progress.gateway.js';
import { EMBEDDING_PROVIDER_TOKEN } from './embedding.module.js';
import type { EmbeddingProvider } from './embedding.service.js';
import { extractText } from './extract-text.util.js';
import { chunkText, type TextChunk } from './chunk-text.util.js';

export interface DocumentProcessingJobData {
  documentId: string;
}

// Số chunk gửi trong 1 lần gọi embedBatch(). KHÔNG gửi toàn bộ chunk của document cùng lúc:
// - Request quá lớn dễ timeout/bị provider từ chối (Gemini/Jina đều có giới hạn payload).
// - Giới hạn blast radius: 1 batch lỗi không làm mất progress của các batch trước đó.
const EMBEDDING_BATCH_SIZE = 20;

@Processor('document-processing')
export class DocumentProcessingProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessingProcessor.name);

  constructor(
    private readonly system: PrismaSystemService,
    private readonly storage: StorageService,
    private readonly progressGateway: ProgressGateway,
    @Inject(EMBEDDING_PROVIDER_TOKEN)
    private readonly embedding: EmbeddingProvider,
  ) {
    super();
  }

  async process(job: Job<DocumentProcessingJobData>): Promise<void> {
    const { documentId } = job.data;

    const document = await this.system.document.findUnique({
      where: { id: documentId },
    });
    if (!document) {
      // Document đã bị xoá giữa lúc enqueue và lúc worker chạy (vd user xoá ngay sau khi upload) —
      // không phải lỗi cần retry, chỉ log và kết thúc job êm thấm.
      this.logger.warn(`Document ${documentId} no longer exists, skipping job`);
      return;
    }

    const { tenantId, mimeType, fileUrl } = document;

    try {
      await this.system.document.update({
        where: { id: documentId },
        data: { status: 'PROCESSING', failReason: null },
      });
      this.emitProgress(tenantId, documentId, 5, 'extracting');

      // Xoá chunks cũ NGAY TỪ ĐẦU (không đợi tới lúc có chunk mới) — đơn giản hoá reindex: document
      // đang ở trạng thái "đang xử lý lại" thì không nên vừa có data cũ vừa có data mới lẫn lộn.
      // Đánh đổi: nếu bước extract/chunk bên dưới throw sớm, document tạm thời KHÔNG CÓ chunk nào
      // cho tới lần reindex kế tiếp — chấp nhận được vì status đã là FAILED, user biết cần reindex.
      await this.system.documentChunk.deleteMany({ where: { documentId } });

      if (!mimeType) {
        throw new Error('Document has no mimeType, cannot extract text');
      }
      const buffer = await this.storage.getObjectBuffer(fileUrl);
      const rawText = await extractText(buffer, mimeType);

      this.emitProgress(tenantId, documentId, 20, 'chunking');
      const chunks = chunkText(rawText);
      if (chunks.length === 0) {
        // Case "0 chunk" đã ghi trong WORKER_MODULE_NOTES.md (vd PDF scan ảnh, extract ra text
        // rỗng) — coi là lỗi RÕ RÀNG thay vì âm thầm để document ở trạng thái INDEXED mà không có
        // chunk nào (sẽ không bao giờ xuất hiện trong kết quả search, khó debug vì "trông như ổn").
        throw new Error(
          'No content could be extracted from document (possibly scanned PDF without OCR support)',
        );
      }

      this.emitProgress(tenantId, documentId, 30, 'embedding');
      await this.embedAndInsertChunks(tenantId, documentId, chunks);

      this.emitProgress(tenantId, documentId, 95, 'indexing');
      await this.system.document.update({
        where: { id: documentId },
        data: { status: 'INDEXED', failReason: null },
      });
      this.emitProgress(tenantId, documentId, 100, 'completed');
    } catch (err) {
      const failReason =
        err instanceof Error
          ? err.message
          : 'Unknown error during document processing';
      this.logger.error(
        `Processing document ${documentId} failed: ${failReason}`,
        err as Error,
      );

      await this.system.document.update({
        where: { id: documentId },
        data: { status: 'FAILED', failReason },
      });
      this.emitProgress(tenantId, documentId, 0, 'failed', failReason);

      // Rethrow để BullMQ áp dụng attempts/backoff đã cấu hình ở DocumentsService (attempts: 3,
      // exponential). Lưu ý: mỗi lần retry, status sẽ quay lại PROCESSING ở đầu try block rồi mới
      // FAILED lại nếu vẫn lỗi — document "nhấp nháy" FAILED/PROCESSING trong lúc chờ retry là hành
      // vi CHỦ Ý, không phải bug; trạng thái cuối cùng mới là thứ đáng tin sau khi job kết thúc hẳn.
      throw err;
    }
  }

  private async embedAndInsertChunks(
    tenantId: string,
    documentId: string,
    chunks: TextChunk[],
  ): Promise<void> {
    for (let start = 0; start < chunks.length; start += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(start, start + EMBEDDING_BATCH_SIZE);
      const vectors = await this.embedding.embedBatch(
        batch.map((c) => c.content),
      );

      if (vectors.length !== batch.length) {
        // Phòng thủ: nếu provider trả về số lượng vector không khớp số lượng input (bug ở provider,
        // hoặc response bị cắt bớt) — fail rõ ràng ngay, không insert lệch chunk<->vector.
        throw new Error(
          `Provider returned ${vectors.length} vectors for ${batch.length} chunks — count mismatch`,
        );
      }

      // Insert từng chunk bằng raw SQL vì Prisma Client KHÔNG hỗ trợ insert trực tiếp vào cột
      // Unsupported("vector(1536)") qua API thông thường (create/createMany). Format vector thành
      // chuỗi "[0.1,0.2,...]" rồi cast ::vector ngay trong câu SQL — cách chuẩn để ghi pgvector qua
      // Prisma (xem thảo luận trong docmind-phase1-implementation.md mục 2 về giới hạn Unsupported()).
      // content_tsv KHÔNG set ở đây — đã có trigger tsvectorupdate (migration.sql) tự điền mỗi lần
      // INSERT/UPDATE vào document_chunks, không cần code tự tính.
      for (const [i, chunk] of batch.entries()) {
        const vectorLiteral = `[${vectors[i]!.join(',')}]`;
        await this.system.$executeRaw`
          INSERT INTO document_chunks (id, document_id, content, embedding, chunk_index, heading_context)
          VALUES (
            ${randomUUID()},
            ${documentId},
            ${chunk.content},
            ${vectorLiteral}::vector,
            ${chunk.chunkIndex},
            ${chunk.headingContext ?? null}
          )
        `;
      }

      const percent =
        30 + Math.round(((start + batch.length) / chunks.length) * 60); // 30 -> 90
      this.emitProgress(tenantId, documentId, percent, 'embedding');
    }
  }

  private emitProgress(
    tenantId: string,
    documentId: string,
    percent: number,
    phase:
      | 'extracting'
      | 'chunking'
      | 'embedding'
      | 'indexing'
      | 'completed'
      | 'failed',
    message?: string,
  ): void {
    this.progressGateway.emitProgress(tenantId, {
      documentId,
      percent,
      phase,
      message,
    });
  }

  // Log khi job fail HẲN (hết số lần retry) — khác với catch trong process() chạy ở MỖI lần thử.
  // Chỉ để quan sát/alerting sau này (vd nối Sentry), không có logic nghiệp vụ nào ở đây vì
  // Document.status đã được cập nhật đúng trong catch của process() rồi.
  @OnWorkerEvent('failed')
  onFailed(job: Job<DocumentProcessingJobData>, err: Error): void {
    this.logger.error(
      `Job processing document ${job.data.documentId} permanently failed after ${job.attemptsMade} attempts: ${err.message}`,
    );
  }
}
