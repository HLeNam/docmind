import { describe, expect, it, vi } from 'vitest';
import { Readable } from 'stream';
import { DocumentsController } from '../src/documents/documents.controller.js';

const CALLER = {
  identityId: 'i1',
  tenantId: 't1',
  membershipId: 'm1',
  role: 'ADMIN',
} as any;

describe('DocumentsController - getFile & getChunks', () => {
  it('getFile sets response headers and returns StreamableFile', async () => {
    const fakeStream = Readable.from(['content']);
    const mockFileResult = {
      stream: fakeStream,
      filename: 'sample.pdf',
      mimeType: 'application/pdf',
      contentLength: 512,
    };
    const svc = {
      getFile: vi.fn(async () => mockFileResult),
    };
    const controller = new DocumentsController(svc as any);

    const mockRes = {
      set: vi.fn(),
    };

    const result = await controller.getFile(CALLER, 'doc-1', mockRes as any);

    expect(svc.getFile).toHaveBeenCalledWith(CALLER, 'doc-1');
    expect(mockRes.set).toHaveBeenCalledWith({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="sample.pdf"',
      'Content-Length': '512',
    });
    expect(result.getStream()).toBe(fakeStream);
  });

  it('getChunks delegates to documentsService.getChunks', async () => {
    const mockChunks = [
      {
        id: 'c1',
        documentId: 'doc-1',
        chunkIndex: 0,
        pageNumber: 1,
        headingContext: 'Header',
        content: 'Body',
      },
    ];
    const svc = {
      getChunks: vi.fn(async () => mockChunks),
    };
    const controller = new DocumentsController(svc as any);

    const result = await controller.getChunks(CALLER, 'doc-1');

    expect(svc.getChunks).toHaveBeenCalledWith(CALLER, 'doc-1');
    expect(result).toBe(mockChunks);
  });
});
