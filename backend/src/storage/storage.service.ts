import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { InternalAppException } from '../common/exceptions/app.exception.js';
import { ErrorCode, ErrorMessage } from '../common/exceptions/error-codes.js';

export interface UploadObjectParams {
  tenantId: string;
  documentId: string;
  originalFilename: string;
  body: Buffer;
  contentType: string;
}

export interface UploadObjectResult {
  key: string;
  etag?: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    // getOrThrow (không dùng get()): các env này đã được Zod validate bắt buộc ở bootstrap, nên
    // nếu thiếu thì phải crash ngay lúc app khởi động, không phải đợi tới lúc gọi S3 mới lỗi.
    // Đồng thời tránh lỗi type "string | undefined not assignable to string" mà get() luôn trả về.
    const endpoint = this.config.getOrThrow<string>('S3_ENDPOINT', {
      infer: true,
    });
    const region = this.config.getOrThrow<string>('S3_REGION', { infer: true });
    const accessKeyId = this.config.getOrThrow<string>('S3_ACCESS_KEY_ID', {
      infer: true,
    });
    const secretAccessKey = this.config.getOrThrow<string>(
      'S3_SECRET_ACCESS_KEY',
      { infer: true },
    );
    const forcePathStyle = this.config.getOrThrow<boolean>(
      'S3_FORCE_PATH_STYLE',
      { infer: true },
    );
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET', { infer: true });

    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle, // bắt buộc true cho MinIO (virtual-hosted-style không hoạt động với IP/port local)
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  // Key convention: {tenantId}/{documentId}/{uuid}-{originalFilename}
  // - tenantId ở đầu: cho phép liệt kê/migrate/xoá toàn bộ object của 1 tenant bằng list-by-prefix,
  //   hữu ích khi tenant bị xoá hoặc cần export dữ liệu.
  // - documentId: gom mọi object liên quan 1 document (bản thân file gốc; sau này có thể thêm file
  //   phụ như thumbnail) vào cùng 1 "thư mục" logic.
  // - uuid prefix trên filename: tránh va chạm khi 2 lần upload cùng tên file, và tránh path traversal
  //   nếu originalFilename chứa ký tự lạ (không dùng originalFilename làm key trực tiếp).
  buildObjectKey(
    tenantId: string,
    documentId: string,
    originalFilename: string,
  ): string {
    const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${tenantId}/${documentId}/${randomUUID()}-${safeName}`;
  }

  async uploadObject(params: UploadObjectParams): Promise<UploadObjectResult> {
    const key = this.buildObjectKey(
      params.tenantId,
      params.documentId,
      params.originalFilename,
    );

    try {
      const result = await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: params.body,
          ContentType: params.contentType,
          // Metadata để debug/audit trực tiếp trên S3 console khi cần, KHÔNG dùng để enforce quyền
          // truy cập — quyền truy cập vẫn phải check qua DocumentsService/RLS, không tin metadata này.
          Metadata: {
            tenantId: params.tenantId,
            documentId: params.documentId,
          },
        }),
      );
      return { key, etag: result.ETag };
    } catch (err) {
      this.logger.error(`Upload failed: ${key}`, err as Error);
      throw new InternalAppException(ErrorCode.STORAGE_UPLOAD_FAILED);
    }
  }

  // Worker (document-processing.processor.ts) gọi hàm này để lấy lại toàn bộ nội dung file
  // trước khi extract text. Đọc hết vào Buffer vì các thư viện parse (officeparser, pdf-parse...)
  // đều nhận Buffer; file đã bị giới hạn kích thước ở lúc upload (MAX_DOCUMENT_SIZE_BYTES /
  // MAX_TABULAR_SIZE_BYTES) nên buffer hoá toàn bộ vào RAM là chấp nhận được.
  async getObjectBuffer(key: string): Promise<Buffer> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      const chunks: Buffer[] = [];
      // SDK v3 trả Body là một web stream / Node stream tuỳ runtime — dùng async iterator cho an toàn
      for await (const chunk of result.Body as AsyncIterable<Buffer>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } catch (err) {
      this.logger.error(`Download failed: ${key}`, err as Error);
      throw new InternalAppException(ErrorCode.STORAGE_DOWNLOAD_FAILED);
    }
  }

  async getObjectStream(key: string): Promise<{
    body: Readable;
    contentType?: string;
    contentLength?: number;
  }> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return {
        body: result.Body as unknown as Readable,
        contentType: result.ContentType,
        contentLength: result.ContentLength,
      };
    } catch (err) {
      this.logger.error(`Download stream failed: ${key}`, err as Error);
      throw new InternalAppException(ErrorCode.STORAGE_DOWNLOAD_FAILED);
    }
  }

  // Dùng cho nút "tải file gốc" trên FE — presigned URL để client tải thẳng từ S3/MinIO, không
  // phải proxy qua backend (tránh tốn băng thông + memory của app server cho file lớn).
  async getSignedDownloadUrl(
    key: string,
    expiresInSeconds = 300,
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      return await getSignedUrl(this.client, command, {
        expiresIn: expiresInSeconds,
      });
    } catch (err) {
      this.logger.error(
        `Create signed URL failed for key=${key}`,
        err as Error,
      );
      throw new InternalAppException(ErrorCode.STORAGE_DOWNLOAD_FAILED);
    }
  }

  // Gọi khi xoá Document (hard delete) hoặc rollback khi 1 bước sau upload thất bại (vd tạo
  // DB record lỗi) — tránh để lại object mồ côi trong bucket.
  async deleteObject(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      // Không throw lên trên cho mọi trường hợp gọi deleteObject: nếu đây là dọn dẹp best-effort
      // (vd rollback), caller có thể chủ động bắt lỗi riêng. Nhưng mặc định vẫn throw để caller
      // nào cần đảm bảo xoá thành công (vd API xoá document) biết mà xử lý/thông báo.
      this.logger.error(`Delete failed: ${key}`, err as Error);
      throw new InternalAppException(ErrorCode.STORAGE_DELETE_FAILED);
    }
  }
}
