import { describe, expect, it, vi } from 'vitest';
import { Readable } from 'stream';
import { DocumentsService } from '../src/documents/documents.service.js';

const CALLER = {
  identityId: 'i1',
  tenantId: 't1',
  membershipId: 'm1',
  role: 'ADMIN',
} as any;

describe('DocumentsService - getFile & getChunks', () => {
  it('getFile returns stream and file metadata when document exists and accessible', async () => {
    const fakeStream = Readable.from(['content']);
    const tx = {
      document: {
        findUnique: vi.fn(async () => ({
          id: 'd1',
          filename: 'report.pdf',
          fileUrl: 't1/d1/uuid-report.pdf',
          mimeType: 'application/pdf',
          collectionId: 'c1',
        })),
      },
    };
    const prisma = {
      runInTenantContext: vi.fn(
        async (_t: string, fn: (tx: any) => Promise<any>) => fn(tx),
      ),
    };
    const storage = {
      getObjectStream: vi.fn(async () => ({
        body: fakeStream,
        contentType: 'application/pdf',
        contentLength: 1024,
      })),
    };
    const collections = {
      assertCollectionAccessible: vi.fn(async () => undefined),
    };
    const svc = new DocumentsService(
      prisma as any,
      storage as any,
      collections as any,
      {} as any,
    );

    const result = await svc.getFile(CALLER, 'd1');

    expect(result.filename).toBe('report.pdf');
    expect(result.mimeType).toBe('application/pdf');
    expect(result.contentLength).toBe(1024);
    expect(result.stream).toBe(fakeStream);
    expect(collections.assertCollectionAccessible).toHaveBeenCalledWith(CALLER, 'c1');
  });

  it('getChunks returns chunk list ordered by chunkIndex', async () => {
    const mockChunks = [
      {
        id: 'chk1',
        documentId: 'd1',
        chunkIndex: 0,
        pageNumber: 1,
        headingContext: 'Intro',
        content: 'Welcome to DocMind',
      },
      {
        id: 'chk2',
        documentId: 'd1',
        chunkIndex: 1,
        pageNumber: 2,
        headingContext: 'Architecture',
        content: 'System design details',
      },
    ];

    const tx = {
      document: {
        findUnique: vi.fn(async () => ({
          id: 'd1',
          collectionId: 'c1',
        })),
      },
      documentChunk: {
        findMany: vi.fn(async () => mockChunks),
      },
    };
    const prisma = {
      runInTenantContext: vi.fn(
        async (_t: string, fn: (tx: any) => Promise<any>) => fn(tx),
      ),
    };
    const collections = {
      assertCollectionAccessible: vi.fn(async () => undefined),
    };
    const svc = new DocumentsService(
      prisma as any,
      {} as any,
      collections as any,
      {} as any,
    );

    const result = await svc.getChunks(CALLER, 'd1');

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('Welcome to DocMind');
    expect(result[1].headingContext).toBe('Architecture');
    expect(tx.documentChunk.findMany).toHaveBeenCalledWith({
      where: { documentId: 'd1' },
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
});
