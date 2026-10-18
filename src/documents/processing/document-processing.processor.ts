// Phần nặng nhất Phase 2: BullMQ worker nối toàn bộ pipeline lại — download từ storage -> extract
// text -> (PDF: tách trang + OCR fallback nếu nghi scan ảnh, xem chunkPdfWithOcrFallback() và
// ocr.util.ts) -> chunk -> embed theo batch -> insert pgvector (raw SQL, Prisma không hỗ trợ insert
// trực tiếp cột Unsupported("vector(1536)")) -> báo tiến độ qua ProgressGateway -> cập nhật
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
import {
  ProgressGateway,
  type DocumentProcessingPhase,
} from '../../realtime/progress.gateway.js';
import { UsageService } from '../../usage/usage.service.js';
import { EMBEDDING_PROVIDER_TOKEN } from './embedding.module.js';
import type { EmbeddingProvider } from './embedding.service.js';
import {
  extractText,
  getPdfPageCount,
  splitPdfPagesByMarker,
  type PdfPageSegment,
} from './extract-text.util.js';
import {
  chunkText,
  chunkPagedText,
  chunkSpreadsheet,
  type TextChunk,
} from './chunk-text.util.js';
import {
  extractPptxSlides,
  extractXlsxSheets,
} from './office-structure.util.js';
import {
  ocrPdfPages,
  OCR_EMPTY_DOC_CHARS,
  OCR_SPARSE_PAGE_CHARS,
} from './ocr.util.js';

// Đếm ký tự khác khoảng trắng — dùng cho ngưỡng OCR (xem ocr.util.ts), không bị lệch bởi xuống dòng/
// khoảng trắng layout của text PDF.
function countNonWhitespace(text: string): number {
  return text.replace(/\s/g, '').length;
}

const PPTX_MIME =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface DocumentProcessingJobData {
  documentId: string;
}

// Document bị xoá GIỮA LÚC job đang chạy. Không phải lỗi: process() bắt riêng, kết thúc job êm (không FAILED, không
// rethrow nên BullMQ không retry) — xem assertDocumentAlive().
export class DocumentGoneError extends Error {
  constructor(documentId: string) {
    super(`Document ${documentId} was deleted while being processed`);
    this.name = 'DocumentGoneError';
  }
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
    private readonly usage: UsageService,
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
      // PPTX/XLSX: lấy cấu trúc (slide / sheet+hàng) để citation trỏ đúng vị trí. null = không phải 2 loại này, hoặc
      // không lấy được cấu trúc nào -> rơi về luồng text phẳng như cũ (không bao giờ tệ hơn trước).
      const structuredChunks = await this.extractStructuredOfficeChunks(
        buffer,
        mimeType,
      );
      const rawText = structuredChunks
        ? ''
        : await extractText(buffer, mimeType);
      // Điểm kiểm tra huỷ: đã tốn công tải + extract; chunk/OCR/embedding phía sau còn đắt hơn nhiều.
      await this.assertDocumentAlive(documentId);

      this.emitProgress(tenantId, documentId, 20, 'chunking');
      // PDF: thử tách theo trang qua marker pageJoiner có sẵn trong rawText (xem
      // splitPdfPagesByMarker() trong extract-text.util.ts) để chunk gắn được pageNumber đúng, phục
      // vụ citation trả về đúng trang — ĐỒNG THỜI cũng là bước phát hiện trang nào "gần như rỗng"
      // (nghi scan ảnh) để quyết định có cần OCR hay không (xem chunkPdfWithOcrFallback() bên dưới).
      // KHÔNG PHẢI PDF -> fallback chunkText() như cũ, pageNumber null, không OCR (OCR chỉ áp dụng
      // cho PDF — docx/pptx/xlsx/txt không có khái niệm "trang scan ảnh").
      const chunks =
        structuredChunks ??
        (mimeType === 'application/pdf'
          ? await this.chunkPdfWithOcrFallback(
              tenantId,
              documentId,
              buffer,
              rawText,
            )
          : chunkText(rawText));
      if (chunks.length === 0) {
        // Case "0 chunk" — PDF đã thử cả text extract thường LẪN OCR fallback mà vẫn không ra được
        // nội dung nào (vd ảnh quá mờ/nghiêng); định dạng khác (docx/txt/...) thì không áp dụng OCR.
        // Coi là lỗi RÕ RÀNG thay vì âm thầm để document ở trạng thái INDEXED mà không có chunk nào.
        const ocrNote =
          mimeType === 'application/pdf' ? ' (even after attempting OCR)' : '';
        throw new Error(
          `Failed to extract any content from document${ocrNote}`,
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
      // Document bị xoá giữa chừng (user bấm xoá lúc đang index): dừng êm, KHÔNG đánh dấu FAILED (không còn gì để
      // cập nhật) và KHÔNG rethrow (retry vô ích). Kiểm tra cả lỗi "lạ" (vd FK violation khi insert chunk cho document
      // vừa bị xoá) bằng cách hỏi lại DB; nếu chính việc kiểm tra lỗi thì coi như document còn, đi tiếp nhánh FAILED.
      if (
        err instanceof DocumentGoneError ||
        !(await this.documentExists(documentId).catch(() => true))
      ) {
        this.logger.log(
          `Document ${documentId} was deleted while being processed — stopping job, no retry`,
        );
        return;
      }

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
      // Mỗi batch = 1 lần gọi embedding tốn quota/tiền: document đã bị xoá thì dừng ngay, khỏi embed các batch còn lại.
      await this.assertDocumentAlive(documentId);
      const batch = chunks.slice(start, start + EMBEDDING_BATCH_SIZE);
      // mode='document': embed CHUNK tài liệu lúc index, khác ngữ cảnh RetrievalService dùng
      // mode='query' lúc embed câu hỏi user — xem EmbeddingMode trong embedding.service.ts.
      const texts = batch.map((c) => c.content);
      let reportedTokens: number | undefined;
      const vectors = await this.embedding.embedBatch(
        texts,
        'document',
        (t) => {
          reportedTokens = t;
        },
      );
      // Ghi ngay sau khi provider trả lời thành công (đã tốn quota dù bước insert bên dưới có lỗi hay không).
      this.usage.recordEmbedding({ tenantId, texts, reportedTokens });

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
          INSERT INTO document_chunks (id, document_id, content, embedding, chunk_index, heading_context, page_number)
          VALUES (
            ${randomUUID()},
            ${documentId},
            ${chunk.content},
            ${vectorLiteral}::vector,
            ${chunk.chunkIndex},
            ${chunk.headingContext ?? null},
            ${chunk.pageNumber ?? null}
          )
        `;
      }

      const percent =
        30 + Math.round(((start + batch.length) / chunks.length) * 60); // 30 -> 90
      this.emitProgress(tenantId, documentId, percent, 'embedding');
    }
  }

  // Quyết định có cần OCR hay không, VÀ chạy OCR nếu cần, rồi chunk kết quả — tách riêng khỏi
  // process() chính để dễ đọc (process() đã khá dài). 2 nhánh:
  // 1. splitPdfPagesByMarker() tách được trang (trường hợp thường gặp): OCR CHỈ những trang có text
  //    ít hơn OCR_SPARSE_PAGE_CHARS (nội dung có thể nằm trong ảnh: slide sơ đồ, trang scan...) rồi
  //    GHÉP chữ OCR vào chữ có sẵn của trang đó; các trang đủ chữ giữ nguyên, không OCR — tiết kiệm
  //    thời gian so với OCR toàn bộ document.
  // 2. Không tách được trang (rawText không có marker): nếu rawText coi như đủ dùng (không phải vì
  //    thiếu marker mà vì gần như rỗng) thì fallback chunkText() như cũ; CHỈ khi rawText quá ít mới
  //    coi cả document là "nghi scan ảnh toàn bộ" và OCR HẾT mọi trang (cần gọi thêm getPdfPageCount()
  //    vì không có sẵn thông tin tổng số trang từ bước tách marker).
  private async chunkPdfWithOcrFallback(
    tenantId: string,
    documentId: string,
    buffer: Buffer,
    rawText: string,
  ): Promise<TextChunk[]> {
    const pages = splitPdfPagesByMarker(rawText);

    if (pages === null) {
      if (countNonWhitespace(rawText) >= OCR_EMPTY_DOC_CHARS) {
        // Có text dùng được nhưng không tách được trang (vd pdf-parse đổi default pageJoiner sau
        // này) -> vẫn index bình thường, chỉ là pageNumber sẽ null cho toàn bộ document.
        return chunkText(rawText);
      }

      const totalPages = await getPdfPageCount(buffer);
      this.emitProgress(
        tenantId,
        documentId,
        22,
        'ocr',
        `Failed to split pages by marker, extracted text too sparse -> OCR all ${totalPages} pages`,
      );
      const ocrResults = await ocrPdfPages(
        buffer,
        Array.from({ length: totalPages }, (_, i) => i + 1),
        this.ocrOptions(documentId),
      );
      const ocrPages: PdfPageSegment[] = Array.from(ocrResults.entries()).map(
        ([pageNumber, text]) => ({
          pageNumber,
          text,
        }),
      );
      return chunkPagedText(ocrPages);
    }

    const scanLikePageNumbers = pages
      .filter((p) => countNonWhitespace(p.text) < OCR_SPARSE_PAGE_CHARS)
      .map((p) => p.pageNumber);

    if (scanLikePageNumbers.length === 0) {
      return chunkPagedText(pages); // mọi trang đều đủ chữ, không cần OCR trang nào
    }

    this.emitProgress(
      tenantId,
      documentId,
      22,
      'ocr',
      `Running OCR on ${scanLikePageNumbers.length}/${pages.length} sparse pages (content may be inside images)`,
    );
    const ocrResults = await ocrPdfPages(
      buffer,
      scanLikePageNumbers,
      this.ocrOptions(documentId),
    );

    // GHÉP chữ OCR vào SAU chữ có sẵn của trang (tiêu đề từ text layer + nội dung đọc từ ảnh), không
    // thay thế: slide thường có tiêu đề ở text layer còn nội dung nằm trong ảnh, OCR có thể đọc sót
    // tiêu đề. Tiêu đề có thể bị lặp 1 lần khi OCR cũng đọc được nó — vô hại. Trang OCR không đọc được
    // gì thì giữ nguyên text gốc.
    const mergedPages = pages.map((p) => {
      const ocrText = ocrResults.get(p.pageNumber);
      return ocrText ? { ...p, text: `${p.text}\n${ocrText}`.trim() } : p;
    });
    return chunkPagedText(mergedPages);
  }

  private async extractStructuredOfficeChunks(
    buffer: Buffer,
    mimeType: string,
  ): Promise<TextChunk[] | null> {
    let chunks: TextChunk[] = [];
    if (mimeType === PPTX_MIME)
      chunks = chunkPagedText(await extractPptxSlides(buffer));
    else if (mimeType === XLSX_MIME)
      chunks = chunkSpreadsheet(await extractXlsxSheets(buffer));
    else return null;
    return chunks.length > 0 ? chunks : null;
  }

  /** OCR là bước lâu nhất (vài giây/trang): kiểm tra document còn tồn tại trước mỗi trang. */
  private ocrOptions(documentId: string) {
    return { beforePage: () => this.assertDocumentAlive(documentId) };
  }

  private async documentExists(documentId: string): Promise<boolean> {
    const found = await this.system.document.findUnique({
      where: { id: documentId },
      select: { id: true },
    });
    return found !== null;
  }

  private async assertDocumentAlive(documentId: string): Promise<void> {
    if (!(await this.documentExists(documentId)))
      throw new DocumentGoneError(documentId);
  }

  private emitProgress(
    tenantId: string,
    documentId: string,
    percent: number,
    phase: DocumentProcessingPhase,
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
      `Document processing job ${job.data.documentId} permanently failed after ${job.attemptsMade} attempts: ${err.message}`,
    );
  }
}
