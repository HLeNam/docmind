import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentProcessingProcessor } from '../src/documents/processing/document-processing.processor.js';
import { extractText } from '../src/documents/processing/extract-text.util.js';
import { chunkText } from '../src/documents/processing/chunk-text.util.js';

vi.mock('../src/documents/processing/extract-text.util.js', () => ({
  extractText: vi.fn(),
}));
vi.mock('../src/documents/processing/chunk-text.util.js', () => ({
  chunkText: vi.fn(),
}));

const mockExtractText = vi.mocked(extractText);
const mockChunkText = vi.mocked(chunkText);

function buildProcessor() {
  const system = {
    document: { findUnique: vi.fn(), update: vi.fn() },
    documentChunk: { deleteMany: vi.fn() },
    $executeRaw: vi.fn(),
  };
  const storage = { getObjectBuffer: vi.fn() };
  const progressGateway = { emitProgress: vi.fn() };
  const embedding = { embedBatch: vi.fn() };

  const processor = new DocumentProcessingProcessor(
    system as never,
    storage as never,
    progressGateway as never,
    embedding as never,
  );

  return { processor, system, storage, progressGateway, embedding };
}

const BASE_DOCUMENT = {
  id: 'doc-1',
  tenantId: 'tenant-1',
  mimeType: 'text/plain',
  fileUrl: 'tenant-1/doc-1/file.txt',
};

describe('DocumentProcessingProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully runs the pipeline: extract -> chunk -> embed -> insert raw SQL -> status INDEXED', async () => {
    const { processor, system, storage, progressGateway, embedding } =
      buildProcessor();
    system.document.findUnique.mockResolvedValue(BASE_DOCUMENT as never);
    storage.getObjectBuffer.mockResolvedValue(Buffer.from('file content'));
    mockExtractText.mockResolvedValue('hello world');
    mockChunkText.mockReturnValue([
      { content: 'chunk 1', chunkIndex: 0 },
      { content: 'chunk 2', chunkIndex: 1, headingContext: '# Title' },
    ]);
    embedding.embedBatch.mockResolvedValue([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);

    await processor.process({ data: { documentId: 'doc-1' } } as never);

    expect(system.document.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'doc-1' },
      data: { status: 'PROCESSING', failReason: null },
    });
    expect(system.documentChunk.deleteMany).toHaveBeenCalledWith({
      where: { documentId: 'doc-1' },
    });
    expect(embedding.embedBatch).toHaveBeenCalledWith(['chunk 1', 'chunk 2']);
    expect(system.$executeRaw).toHaveBeenCalledTimes(2); // 1 insert per chunk
    expect(system.document.update).toHaveBeenLastCalledWith({
      where: { id: 'doc-1' },
      data: { status: 'INDEXED', failReason: null },
    });
    expect(progressGateway.emitProgress).toHaveBeenLastCalledWith('tenant-1', {
      documentId: 'doc-1',
      percent: 100,
      phase: 'completed',
      message: undefined,
    });
  });

  it('skips gracefully without throwing if document was deleted between enqueue and execution', async () => {
    const { processor, system, storage } = buildProcessor();
    system.document.findUnique.mockResolvedValue(null);

    await expect(
      processor.process({ data: { documentId: 'doc-x' } } as never),
    ).resolves.toBeUndefined();
    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
    expect(system.document.update).not.toHaveBeenCalled();
  });

  it('throws and marks status as FAILED when chunkText returns 0 chunks', async () => {
    const { processor, system, storage, progressGateway } = buildProcessor();
    system.document.findUnique.mockResolvedValue(BASE_DOCUMENT as never);
    storage.getObjectBuffer.mockResolvedValue(Buffer.from('x'));
    mockExtractText.mockResolvedValue('');
    mockChunkText.mockReturnValue([]);

    await expect(
      processor.process({ data: { documentId: 'doc-1' } } as never),
    ).rejects.toThrow(/no content could be extracted/i);

    expect(system.document.update).toHaveBeenLastCalledWith({
      where: { id: 'doc-1' },
      data: {
        status: 'FAILED',
        failReason: expect.stringMatching(/no content could be extracted/i),
      },
    });
    expect(progressGateway.emitProgress).toHaveBeenLastCalledWith(
      'tenant-1',
      expect.objectContaining({ phase: 'failed', percent: 0 }),
    );
  });

  it('throws, sets status FAILED, and does not insert when provider returns mismatched vector count', async () => {
    const { processor, system, storage, embedding } = buildProcessor();
    system.document.findUnique.mockResolvedValue(BASE_DOCUMENT as never);
    storage.getObjectBuffer.mockResolvedValue(Buffer.from('x'));
    mockExtractText.mockResolvedValue('hello');
    mockChunkText.mockReturnValue([{ content: 'chunk 1', chunkIndex: 0 }]);
    embedding.embedBatch.mockResolvedValue([]); // fewer vectors than chunks

    await expect(
      processor.process({ data: { documentId: 'doc-1' } } as never),
    ).rejects.toThrow(/count mismatch/i);
    expect(system.$executeRaw).not.toHaveBeenCalled();
    expect(system.document.update).toHaveBeenLastCalledWith({
      where: { id: 'doc-1' },
      data: {
        status: 'FAILED',
        failReason: expect.stringMatching(/count mismatch/i),
      },
    });
  });

  it('marks status as FAILED and rethrows for BullMQ retry when storage download fails', async () => {
    const { processor, system, storage } = buildProcessor();
    system.document.findUnique.mockResolvedValue(BASE_DOCUMENT as never);
    storage.getObjectBuffer.mockRejectedValue(new Error('S3 timeout'));

    await expect(
      processor.process({ data: { documentId: 'doc-1' } } as never),
    ).rejects.toThrow('S3 timeout');

    expect(system.document.update).toHaveBeenLastCalledWith({
      where: { id: 'doc-1' },
      data: { status: 'FAILED', failReason: 'S3 timeout' },
    });
  });

  it('throws clear error when document has no mimeType', async () => {
    const { processor, system, storage } = buildProcessor();
    system.document.findUnique.mockResolvedValue({
      ...BASE_DOCUMENT,
      mimeType: null,
    } as never);

    await expect(
      processor.process({ data: { documentId: 'doc-1' } } as never),
    ).rejects.toThrow(/mimeType/i);
    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
  });
});
