import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { CollectionsService } from '../collections/collections.service.js';
import {
  NotFoundAppException,
  UnprocessableAppException,
} from '../common/exceptions/app.exception.js';

import type { AccessTokenPayload } from '../auth/auth.service.js';
import { decodeUploadedFilename } from './decode-filename.util.js';
import {
  ALLOWED_MIME_TYPES,
  getMaxSizeForMimeType,
} from './schemas/document.schema.js';

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const JOB_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
};

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly collectionsService: CollectionsService,
    @InjectQueue('document-processing') private readonly queue: Queue,
  ) {}

  async upload(
    caller: AccessTokenPayload,
    collectionId: string,
    file: UploadedFileLike,
  ) {
    if (
      !ALLOWED_MIME_TYPES.includes(
        file.mimetype as (typeof ALLOWED_MIME_TYPES)[number],
      )
    ) {
      throw new UnprocessableAppException(
        `Unsupported file type: ${file.mimetype}`,
        {
          allowed: ALLOWED_MIME_TYPES,
        },
      );
    }

    // FileInterceptor ở controller chỉ chặn được 1 ngưỡng TUYỆT ĐỐI chung cho mọi file
    // (MAX_DOCUMENT_SIZE_BYTES — ngưỡng lớn nhất trong 2 mức), không phân biệt theo mimetype.
    // CSV/XLSX cần ngưỡng NHỎ HƠN (MAX_TABULAR_SIZE_BYTES) — kiểm tra tinh hơn ở đây, khi đã biết
    // chính xác mimetype.
    const maxSize = getMaxSizeForMimeType(file.mimetype);
    if (file.size > maxSize) {
      throw new UnprocessableAppException(
        `File size exceeds limit for ${file.mimetype} (max ${Math.round(maxSize / 1024 / 1024)}MB)`,
        { maxBytes: maxSize },
      );
    }

    // Check quyền + sự tồn tại của collection TRƯỚC khi đụng tới storage — tránh upload file lên
    // S3 rồi mới phát hiện không có quyền/collection không tồn tại.
    await this.collectionsService.assertCollectionAccessible(
      caller,
      collectionId,
    );

    const documentId = randomUUID();
    // multer giải mã tên file bằng latin1 nên tên tiếng Việt bị hỏng — khôi phục UTF-8 trước khi lưu/đặt key.
    const filename = decodeUploadedFilename(file.originalname);

    // Upload lên storage TRƯỚC khi tạo record DB — ngược lại với thứ tự "tạo DB trước" đã cân nhắc:
    // nếu upload S3 thất bại, không có Document record mồ côi nào phải dọn; nếu tạo DB record
    // thất bại SAU KHI đã upload, object "mồ côi" trong S3 vô hại (không ai biết tới key đó) và có
    // thể dọn định kỳ sau — đánh đổi rẻ hơn so với 1 Document PENDING mà file chưa chắc có.
    const { key } = await this.storage.uploadObject({
      tenantId: caller.tenantId,
      documentId,
      originalFilename: filename,
      body: file.buffer,
      contentType: file.mimetype,
    });

    const document = await this.prisma.runInTenantContext(
      caller.tenantId,
      async (tx) => {
        const collection = await tx.collection.findUnique({
          where: { id: collectionId },
        });
        if (!collection) throw new NotFoundAppException('Collection not found');

        return tx.document.create({
          data: {
            id: documentId,
            tenantId: caller.tenantId,
            collectionId,
            filename,
            fileUrl: key,
            mimeType: file.mimetype,
            status: 'PENDING',
            uploadedById: caller.membershipId,
          },
        });
      },
    );

    await this.queue.add('process', { documentId: document.id }, JOB_OPTS);

    return document;
  }

  async list(caller: AccessTokenPayload, collectionId?: string) {
    const accessibleCollectionIds =
      await this.collectionsService.listAccessibleCollectionIds(caller);
    if (collectionId && !accessibleCollectionIds.includes(collectionId)) {
      // Không lộ "collection này tồn tại nhưng bạn không có quyền" — trả rỗng giống hệt trường hợp
      // collection rỗng thật, tránh rò rỉ thông tin tồn tại của collection khác.
      return [];
    }

    return this.prisma.runInTenantContext(caller.tenantId, (tx) =>
      tx.document.findMany({
        where: {
          collectionId: collectionId
            ? collectionId
            : { in: accessibleCollectionIds },
        },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async getStatus(caller: AccessTokenPayload, documentId: string) {
    return this.prisma.runInTenantContext(caller.tenantId, async (tx) => {
      const document = await tx.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          status: true,
          failReason: true,
          filename: true,
          collectionId: true,
        },
      });
      if (!document) throw new NotFoundAppException('Document not found');
      await this.collectionsService.assertCollectionAccessible(
        caller,
        document.collectionId,
      );
      return document;
    });
  }

  // Quyết định MVP: dùng HARD DELETE. Schema hiện tại (Document) KHÔNG có cột deletedAt — spec gốc
  // nói "soft delete + cascade" nhưng thêm cột là 1 thay đổi schema cần quyết định riêng, không tự
  // ý thêm ở đây. Cascade xoá DocumentChunk đã có sẵn qua onDelete: Cascade trong schema.prisma.
  // Muốn soft-delete thật, xem mục "Đã hoãn có chủ đích" trong doc Phase 2.
  async remove(caller: AccessTokenPayload, documentId: string) {
    const result = await this.prisma.runInTenantContext(
      caller.tenantId,
      async (tx) => {
        const document = await tx.document.findUnique({
          where: { id: documentId },
        });
        if (!document) throw new NotFoundAppException('Document not found');
        await this.collectionsService.assertCollectionAccessible(
          caller,
          document.collectionId,
        );
        await tx.document.delete({ where: { id: documentId } });
        await this.storage.deleteObject(document.fileUrl);
        return { id: documentId, deleted: true };
      },
    );

    // Sau khi đã xoá (và đã qua kiểm tra quyền): bỏ các job đang chờ/chờ retry của document này. Job ĐANG chạy không
    // huỷ được từ ngoài (BullMQ khoá job) — worker tự dừng ở điểm kiểm tra kế tiếp (xem DocumentGoneError ở processor).
    await this.cancelPendingJobs(documentId);
    return result;
  }

  /** Best-effort: lỗi Redis/BullMQ chỉ log, không làm hỏng việc xoá (document đã xoá xong; worker vẫn tự bỏ qua job). */
  private async cancelPendingJobs(documentId: string): Promise<void> {
    try {
      const jobs = await this.queue.getJobs(['waiting', 'delayed'], 0, 999);
      const mine = jobs.filter((job) => job?.data?.documentId === documentId);
      await Promise.all(mine.map((job) => job.remove().catch(() => undefined))); // job vừa chuyển sang active -> bỏ qua
    } catch (err) {
      this.logger.warn(
        `Failed to cancel pending jobs for document ${documentId}: ${String(err)}`,
      );
    }
  }

  // Re-index: enqueue lại đúng job cũ, worker tự xoá chunks cũ trước khi tạo lại (xem module Worker).
  async reindex(caller: AccessTokenPayload, documentId: string) {
    const document = await this.getStatus(caller, documentId); // đã tự check quyền theo collection
    await this.prisma.runInTenantContext(caller.tenantId, (tx) =>
      tx.document.update({
        where: { id: documentId },
        data: { status: 'PENDING', failReason: null },
      }),
    );
    await this.queue.add('process', { documentId: document.id }, JOB_OPTS);
    return { id: documentId, status: 'PENDING' };
  }

  async getFile(caller: AccessTokenPayload, documentId: string) {
    const document = await this.prisma.runInTenantContext(
      caller.tenantId,
      async (tx) => {
        const doc = await tx.document.findUnique({
          where: { id: documentId },
          select: {
            id: true,
            filename: true,
            fileUrl: true,
            mimeType: true,
            collectionId: true,
          },
        });
        if (!doc) throw new NotFoundAppException('Document not found');
        await this.collectionsService.assertCollectionAccessible(
          caller,
          doc.collectionId,
        );
        return doc;
      },
    );

    const { body, contentType, contentLength } =
      await this.storage.getObjectStream(document.fileUrl);

    return {
      stream: body,
      filename: document.filename,
      mimeType: document.mimeType || contentType || 'application/octet-stream',
      contentLength,
    };
  }

  async getChunks(caller: AccessTokenPayload, documentId: string) {
    return this.prisma.runInTenantContext(caller.tenantId, async (tx) => {
      const doc = await tx.document.findUnique({
        where: { id: documentId },
        select: {
          id: true,
          collectionId: true,
        },
      });
      if (!doc) throw new NotFoundAppException('Document not found');
      await this.collectionsService.assertCollectionAccessible(
        caller,
        doc.collectionId,
      );

      return tx.documentChunk.findMany({
        where: { documentId },
        select: {
          id: true,
          documentId: true,
          chunkIndex: true,
          pageNumber: true,
          headingContext: true,
          content: true,
        },
        orderBy: { chunkIndex: 'asc' },
      });
    });
  }
}
