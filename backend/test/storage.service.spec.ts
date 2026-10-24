// test/storage.service.spec.ts
//
// Unit test cho StorageService — cố tình KHÔNG cần MinIO/S3 thật chạy (khác với
// refresh-token.service.spec.ts vốn cần Postgres thật): mock thẳng S3Client.send() và
// getSignedUrl() của @aws-sdk, vì ở đây chỉ cần xác nhận StorageService gọi đúng Command với
// đúng tham số và xử lý đúng khi SDK thất bại — không cần tích hợp thật với MinIO.
//
// Nếu sau này thêm test tích hợp thật (upload/download/delete với MinIO thật qua docker compose),
// để ở 1 file riêng (vd storage.integration.spec.ts), không trộn vào đây.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../src/storage/storage.service.js';
import { ErrorCode } from '../src/common/exceptions/error-codes.js';

// Mock module trước khi import StorageService dùng nó — vitest hoist mock lên đầu file tự động.
const sendMock = vi.fn();
vi.mock('@aws-sdk/client-s3', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    S3Client: vi.fn().mockImplementation(function () {
      return { send: sendMock };
    }),
  };
});

const getSignedUrlMock = vi.fn();
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => getSignedUrlMock(...args),
}));

function buildConfigService(): ConfigService {
  const values: Record<string, string | boolean> = {
    S3_ENDPOINT: 'http://localhost:9000',
    S3_REGION: 'us-east-1',
    S3_BUCKET: 'docmind-documents',
    S3_ACCESS_KEY_ID: 'minioadmin',
    S3_SECRET_ACCESS_KEY: 'minioadmin',
    S3_FORCE_PATH_STYLE: true,
  };
  return {
    getOrThrow: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    sendMock.mockReset();
    getSignedUrlMock.mockReset();
    service = new StorageService(buildConfigService());
  });

  describe('buildObjectKey', () => {
    it('should properly concatenate tenantId/documentId/uuid-filename', () => {
      const key = service.buildObjectKey('tenant-1', 'doc-1', 'báo cáo Q1.pdf');
      expect(key.startsWith('tenant-1/doc-1/')).toBe(true);
      // Ký tự có dấu/khoảng trắng phải được thay bằng "_" — tránh path traversal / ký tự lạ trên S3 key.
      expect(key).toMatch(/^tenant-1\/doc-1\/[0-9a-f-]{36}-b_o_c_o_Q1\.pdf$/);
    });

    it('should return different keys for two consecutive calls with the same input (random uuid each time)', () => {
      const key1 = service.buildObjectKey('tenant-1', 'doc-1', 'file.txt');
      const key2 = service.buildObjectKey('tenant-1', 'doc-1', 'file.txt');
      expect(key1).not.toBe(key2);
    });
  });

  describe('uploadObject', () => {
    it('should call PutObjectCommand with correct Bucket/Body/ContentType and return key + etag', async () => {
      sendMock.mockResolvedValueOnce({ ETag: '"abc123"' });

      const result = await service.uploadObject({
        tenantId: 'tenant-1',
        documentId: 'doc-1',
        originalFilename: 'file.pdf',
        body: Buffer.from('hello'),
        contentType: 'application/pdf',
      });

      expect(sendMock).toHaveBeenCalledTimes(1);
      const commandArg = sendMock.mock.calls[0]![0];
      expect(commandArg.input).toMatchObject({
        Bucket: 'docmind-documents',
        Body: Buffer.from('hello'),
        ContentType: 'application/pdf',
        Metadata: { tenantId: 'tenant-1', documentId: 'doc-1' },
      });
      expect(result.key.startsWith('tenant-1/doc-1/')).toBe(true);
      expect(result.etag).toBe('"abc123"');
    });

    it('should throw InternalAppException with code STORAGE_UPLOAD_FAILED when S3 throws an error, masking the original SDK error', async () => {
      sendMock.mockRejectedValueOnce(new Error('connection refused'));

      await expect(
        service.uploadObject({
          tenantId: 'tenant-1',
          documentId: 'doc-1',
          originalFilename: 'file.pdf',
          body: Buffer.from('hello'),
          contentType: 'application/pdf',
        }),
      ).rejects.toMatchObject({ code: ErrorCode.STORAGE_UPLOAD_FAILED });
    });
  });

  describe('getObjectBuffer', () => {
    it('should read the async iterable Body entirely and concatenate it into a single Buffer in the correct order', async () => {
      const chunks = [Buffer.from('hel'), Buffer.from('lo')];
      sendMock.mockResolvedValueOnce({
        Body: {
          [Symbol.asyncIterator]: async function* () {
            for (const c of chunks) yield c;
          },
        },
      });

      const buffer = await service.getObjectBuffer('tenant-1/doc-1/x-file.pdf');
      expect(buffer.toString()).toBe('hello');
    });

    it('should throw InternalAppException with code STORAGE_DOWNLOAD_FAILED when S3 throws an error', async () => {
      sendMock.mockRejectedValueOnce(new Error('not found'));

      await expect(
        service.getObjectBuffer('tenant-1/doc-1/missing.pdf'),
      ).rejects.toMatchObject({
        code: ErrorCode.STORAGE_DOWNLOAD_FAILED,
      });
    });
  });

  describe('getSignedDownloadUrl', () => {
    it('should call getSignedUrl with the provided expiresIn parameter (default to 300s if omitted)', async () => {
      getSignedUrlMock.mockResolvedValueOnce('https://signed.example/file');

      const url = await service.getSignedDownloadUrl('tenant-1/doc-1/file.pdf');

      expect(url).toBe('https://signed.example/file');
      expect(getSignedUrlMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 300 },
      );
    });

    it('should use the custom expiresInSeconds value when provided', async () => {
      getSignedUrlMock.mockResolvedValueOnce('https://signed.example/file');

      await service.getSignedDownloadUrl('tenant-1/doc-1/file.pdf', 60);

      expect(getSignedUrlMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 60 },
      );
    });

    it('should throw InternalAppException with code STORAGE_DOWNLOAD_FAILED when getSignedUrl throws an error', async () => {
      getSignedUrlMock.mockRejectedValueOnce(new Error('signing failed'));

      await expect(
        service.getSignedDownloadUrl('tenant-1/doc-1/file.pdf'),
      ).rejects.toMatchObject({
        code: ErrorCode.STORAGE_DOWNLOAD_FAILED,
      });
    });
  });

  describe('deleteObject', () => {
    it('should call DeleteObjectCommand with correct Bucket/Key', async () => {
      sendMock.mockResolvedValueOnce({});

      await service.deleteObject('tenant-1/doc-1/file.pdf');

      expect(sendMock).toHaveBeenCalledTimes(1);
      const commandArg = sendMock.mock.calls[0]![0];
      expect(commandArg.input).toMatchObject({
        Bucket: 'docmind-documents',
        Key: 'tenant-1/doc-1/file.pdf',
      });
    });

    it('should throw InternalAppException with code STORAGE_DELETE_FAILED when S3 throws an error', async () => {
      sendMock.mockRejectedValueOnce(new Error('access denied'));

      await expect(
        service.deleteObject('tenant-1/doc-1/file.pdf'),
      ).rejects.toMatchObject({
        code: ErrorCode.STORAGE_DELETE_FAILED,
      });
    });
  });
});
