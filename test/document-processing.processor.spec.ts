// Test processor bằng cách `new` trực tiếp (giống cách đã làm với các service khác trong session
// này) với toàn bộ dependency là mock — KHÔNG mock global.fetch hay gọi API thật nào. extractText/
// chunkText được mock qua vi.mock() module vì bản thân 2 hàm đó đã có test riêng
// (extract-text.util.spec.ts, chunk-text.util.spec.ts) — ở đây chỉ cần giả lập input/output của
// chúng để test ĐÚNG LOGIC NỐI CÁC BƯỚC LẠI VỚI NHAU (orchestration), không test lại extract/chunk.
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { DocumentProcessingProcessor } from '../src/documents/processing/document-processing.processor.js';
import {
  extractText,
  getPdfPageCount,
  splitPdfPagesByMarker,
} from '../src/documents/processing/extract-text.util.js';
import {
  chunkText,
  chunkPagedText,
} from '../src/documents/processing/chunk-text.util.js';
import { ocrPdfPages } from '../src/documents/processing/ocr.util.js';

vi.mock('../src/documents/processing/extract-text.util.js');
vi.mock('../src/documents/processing/chunk-text.util.js');
vi.mock('../src/documents/processing/ocr.util.js', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('../src/documents/processing/ocr.util.js')
    >();
  return {
    ...actual,
    // Chỉ mock hàm gọi ra tesseract/pdf-parse thật — vẫn giữ nguyên các hằng số ngưỡng OCR thật (dùng
    // requireActual). Text giả trong test phải dài/ngắn đủ so với ngưỡng thật (xem LONG_PAGE_TEXT bên dưới).
    ocrPdfPages: vi.fn(),
  };
});

const mockExtractText = extractText as unknown as Mock;
const mockChunkText = chunkText as unknown as Mock;
const mockSplitPdfPagesByMarker = splitPdfPagesByMarker as unknown as Mock;
const mockChunkPagedText = chunkPagedText as unknown as Mock;
const mockGetPdfPageCount = getPdfPageCount as unknown as Mock;
const mockOcrPdfPages = ocrPdfPages as unknown as Mock;

function buildProcessor() {
  const system = {
    document: { findUnique: vi.fn(), update: vi.fn() },
    documentChunk: { deleteMany: vi.fn() },
    $executeRaw: vi.fn(),
  };
  const storage = { getObjectBuffer: vi.fn() };
  const progressGateway = { emitProgress: vi.fn() };
  const embedding = { embedBatch: vi.fn() };
  const usage = { recordEmbedding: vi.fn() };

  const processor = new DocumentProcessingProcessor(
    system as never,
    storage as never,
    progressGateway as never,
    embedding as never,
    usage as never,
  );

  return { processor, system, storage, progressGateway, embedding, usage };
}

// Text trang "đủ chữ": ~260 ký tự khác khoảng trắng, trên ngưỡng OCR_SPARSE_PAGE_CHARS (200) nên không bị OCR.
const LONG_PAGE_TEXT = 'Nội dung trang đủ dài. '.repeat(12).trim();

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

  it('records EMBEDDING usage log for each batch using reported tokens when provided', async () => {
    const { processor, system, storage, embedding, usage } = buildProcessor();
    system.document.findUnique.mockResolvedValue(BASE_DOCUMENT);
    storage.getObjectBuffer.mockResolvedValue(Buffer.from('x'));
    mockExtractText.mockResolvedValue('hello world');
    mockChunkText.mockReturnValue([
      { content: 'chunk 1', chunkIndex: 0 },
      { content: 'chunk 2', chunkIndex: 1 },
    ]);
    embedding.embedBatch.mockImplementation(
      async (
        _texts: string[],
        _mode: string,
        onUsage?: (n: number) => void,
      ) => {
        onUsage?.(42); // provider reports actual token count
        return [
          [0.1, 0.2],
          [0.3, 0.4],
        ];
      },
    );

    await processor.process({ data: { documentId: 'doc-1' } } as never);

    expect(usage.recordEmbedding).toHaveBeenCalledWith({
      tenantId: BASE_DOCUMENT.tenantId,
      texts: ['chunk 1', 'chunk 2'],
      reportedTokens: 42,
    });
  });

  it('passes undefined reportedTokens so UsageService estimates tokens when provider does not report usage', async () => {
    const { processor, system, storage, embedding, usage } = buildProcessor();
    system.document.findUnique.mockResolvedValue(BASE_DOCUMENT);
    storage.getObjectBuffer.mockResolvedValue(Buffer.from('x'));
    mockExtractText.mockResolvedValue('hello world');
    mockChunkText.mockReturnValue([{ content: 'chunk 1', chunkIndex: 0 }]);
    embedding.embedBatch.mockResolvedValue([[0.1, 0.2]]);

    await processor.process({ data: { documentId: 'doc-1' } } as never);

    expect(usage.recordEmbedding).toHaveBeenCalledWith({
      tenantId: BASE_DOCUMENT.tenantId,
      texts: ['chunk 1'],
      reportedTokens: undefined,
    });
  });

  it('successfully processes document: extract -> chunk -> embed -> insert raw SQL -> status INDEXED', async () => {
    const { processor, system, storage, progressGateway, embedding } =
      buildProcessor();
    system.document.findUnique.mockResolvedValue(BASE_DOCUMENT);
    storage.getObjectBuffer.mockResolvedValue(Buffer.from('nội dung file'));
    mockExtractText.mockResolvedValue('hello world');
    mockChunkText.mockReturnValue([
      { content: 'chunk 1', chunkIndex: 0 },
      { content: 'chunk 2', chunkIndex: 1, headingContext: '# Tiêu đề' },
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
    expect(embedding.embedBatch).toHaveBeenCalledWith(
      ['chunk 1', 'chunk 2'],
      'document',
      expect.any(Function),
    );
    expect(system.$executeRaw).toHaveBeenCalledTimes(2); // 1 insert / chunk
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

  it('silently ignores and finishes job without throwing when document was deleted before worker run', async () => {
    const { processor, system, storage } = buildProcessor();
    system.document.findUnique.mockResolvedValue(null);

    await expect(
      processor.process({ data: { documentId: 'doc-x' } } as never),
    ).resolves.toBeUndefined();
    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
    expect(system.document.update).not.toHaveBeenCalled();
  });

  it('throws error and sets status to FAILED when chunkText returns 0 chunks', async () => {
    const { processor, system, storage, progressGateway } = buildProcessor();
    system.document.findUnique.mockResolvedValue(BASE_DOCUMENT);
    storage.getObjectBuffer.mockResolvedValue(Buffer.from('x'));
    mockExtractText.mockResolvedValue('');
    mockChunkText.mockReturnValue([]);

    await expect(
      processor.process({ data: { documentId: 'doc-1' } } as never),
    ).rejects.toThrow(/failed to extract any content/i);

    expect(system.document.update).toHaveBeenLastCalledWith({
      where: { id: 'doc-1' },
      data: {
        status: 'FAILED',
        failReason: expect.stringMatching(/failed to extract any content/i),
      },
    });
    expect(progressGateway.emitProgress).toHaveBeenLastCalledWith(
      'tenant-1',
      expect.objectContaining({ phase: 'failed', percent: 0 }),
    );
  });

  it('throws error and sets status to FAILED without inserting when provider returns vector count mismatch', async () => {
    const { processor, system, storage, embedding } = buildProcessor();
    system.document.findUnique.mockResolvedValue(BASE_DOCUMENT);
    storage.getObjectBuffer.mockResolvedValue(Buffer.from('x'));
    mockExtractText.mockResolvedValue('hello');
    mockChunkText.mockReturnValue([{ content: 'chunk 1', chunkIndex: 0 }]);
    embedding.embedBatch.mockResolvedValue([]); // thiếu vector so với 1 chunk đầu vào

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

  it('sets status to FAILED with error message and rethrows for BullMQ retry when storage download fails', async () => {
    const { processor, system, storage } = buildProcessor();
    system.document.findUnique.mockResolvedValue(BASE_DOCUMENT);
    storage.getObjectBuffer.mockRejectedValue(new Error('S3 timeout'));

    await expect(
      processor.process({ data: { documentId: 'doc-1' } } as never),
    ).rejects.toThrow('S3 timeout');

    expect(system.document.update).toHaveBeenLastCalledWith({
      where: { id: 'doc-1' },
      data: { status: 'FAILED', failReason: 'S3 timeout' },
    });
  });

  it('throws descriptive error when document has no mimeType', async () => {
    const { processor, system, storage } = buildProcessor();
    system.document.findUnique.mockResolvedValue({
      ...BASE_DOCUMENT,
      mimeType: null,
    });

    await expect(
      processor.process({ data: { documentId: 'doc-1' } } as never),
    ).rejects.toThrow(/mimeType/i);
    expect(storage.getObjectBuffer).not.toHaveBeenCalled();
  });

  it('chunks paged text directly without OCR and inserts correct page numbers when PDF pages are split with sufficient text', async () => {
    const { processor, system, storage, embedding } = buildProcessor();
    const pdfDocument = { ...BASE_DOCUMENT, mimeType: 'application/pdf' };
    system.document.findUnique.mockResolvedValue(pdfDocument);
    storage.getObjectBuffer.mockResolvedValue(Buffer.from('%PDF-...'));
    // Text mỗi trang PHẢI đủ dài (>= OCR_SPARSE_PAGE_CHARS) để không bị coi là "ít chữ, cần OCR".
    const rawText = `${LONG_PAGE_TEXT}\n-- 1 of 2 --\n${LONG_PAGE_TEXT}\n-- 2 of 2 --`;
    mockExtractText.mockResolvedValue(rawText);
    const pages = [
      { pageNumber: 1, text: LONG_PAGE_TEXT },
      { pageNumber: 2, text: LONG_PAGE_TEXT },
    ];
    mockSplitPdfPagesByMarker.mockReturnValue(pages);
    mockChunkPagedText.mockReturnValue([
      { content: LONG_PAGE_TEXT, chunkIndex: 0, pageNumber: 1 },
      { content: LONG_PAGE_TEXT, chunkIndex: 1, pageNumber: 2 },
    ]);
    embedding.embedBatch.mockResolvedValue([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);

    await processor.process({ data: { documentId: 'doc-1' } } as never);

    // chunkText (fallback thường) KHÔNG được gọi khi đã tách trang thành công — đúng nhánh PDF.
    expect(mockChunkText).not.toHaveBeenCalled();
    expect(mockSplitPdfPagesByMarker).toHaveBeenCalledWith(rawText);
    expect(mockChunkPagedText).toHaveBeenCalledWith(pages); // KHÔNG bị OCR ghi đè, dùng đúng pages gốc
    expect(mockOcrPdfPages).not.toHaveBeenCalled(); // text mỗi trang đủ dài -> không nghi scan ảnh

    // Mỗi lệnh INSERT raw SQL nhận đúng pageNumber theo thứ tự chunk tương ứng (tham số cuối cùng
    // truyền vào $executeRaw sau templateStrings, randomUUID, documentId, content, vectorLiteral,
    // chunkIndex, headingContext).
    expect(system.$executeRaw).toHaveBeenCalledTimes(2);
    const firstCallArgs = system.$executeRaw.mock.calls[0]!;
    const secondCallArgs = system.$executeRaw.mock.calls[1]!;
    expect(firstCallArgs[firstCallArgs.length - 1]).toBe(1); // pageNumber trang 1
    expect(secondCallArgs[secondCallArgs.length - 1]).toBe(2); // pageNumber trang 2
  });

  it('falls back to standard chunkText without OCR and sets pageNumber to null when PDF marker splitting fails but text is sufficient', async () => {
    const { processor, system, storage, embedding } = buildProcessor();
    const pdfDocument = { ...BASE_DOCUMENT, mimeType: 'application/pdf' };
    system.document.findUnique.mockResolvedValue(pdfDocument);
    storage.getObjectBuffer.mockResolvedValue(Buffer.from('%PDF-...'));
    mockExtractText.mockResolvedValue('text PDF không có marker (vd 1 trang)'); // >= OCR_EMPTY_DOC_CHARS (20)
    mockSplitPdfPagesByMarker.mockReturnValue(null);
    mockChunkText.mockReturnValue([{ content: 'nội dung', chunkIndex: 0 }]); // không có pageNumber
    embedding.embedBatch.mockResolvedValue([[0.1, 0.2]]);

    await processor.process({ data: { documentId: 'doc-1' } } as never);

    expect(mockChunkPagedText).not.toHaveBeenCalled();
    expect(mockChunkText).toHaveBeenCalledWith(
      'text PDF không có marker (vd 1 trang)',
    );
    expect(mockOcrPdfPages).not.toHaveBeenCalled();
    expect(mockGetPdfPageCount).not.toHaveBeenCalled();
    const callArgs = system.$executeRaw.mock.calls[0]!;
    expect(callArgs[callArgs.length - 1]).toBeNull(); // pageNumber null khi không tách được trang
  });

  it('runs OCR only on sparse pages and merges OCR text into existing page text when PDF has sparse pages', async () => {
    const { processor, system, storage, embedding, progressGateway } =
      buildProcessor();
    const pdfDocument = { ...BASE_DOCUMENT, mimeType: 'application/pdf' };
    system.document.findUnique.mockResolvedValue(pdfDocument);
    const buffer = Buffer.from('%PDF-...');
    storage.getObjectBuffer.mockResolvedValue(buffer);
    mockExtractText.mockResolvedValue(
      `${LONG_PAGE_TEXT}\n-- 1 of 2 --\nTiêu đề slide\n-- 2 of 2 --`,
    );
    mockSplitPdfPagesByMarker.mockReturnValue([
      { pageNumber: 1, text: LONG_PAGE_TEXT },
      { pageNumber: 2, text: 'Tiêu đề slide' }, // chỉ có tiêu đề, nội dung nằm trong ảnh
    ]);
    mockOcrPdfPages.mockResolvedValue(
      new Map([[2, 'Nội dung OCR được từ ảnh trang 2.']]),
    );
    mockChunkPagedText.mockReturnValue([
      { content: LONG_PAGE_TEXT, chunkIndex: 0, pageNumber: 1 },
      {
        content: 'Tiêu đề slide\nNội dung OCR được từ ảnh trang 2.',
        chunkIndex: 1,
        pageNumber: 2,
      },
    ]);
    embedding.embedBatch.mockResolvedValue([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);

    await processor.process({ data: { documentId: 'doc-1' } } as never);

    // CHỈ gọi OCR cho trang 2 (trang 1 có text đủ dài, không cần OCR).
    expect(mockOcrPdfPages).toHaveBeenCalledWith(buffer, [2]);
    expect(mockGetPdfPageCount).not.toHaveBeenCalled(); // đã biết tổng số trang qua splitPdfPagesByMarker, không cần gọi thêm

    // chunkPagedText() nhận pages đã MERGE: trang 1 giữ nguyên, trang 2 = chữ có sẵn + chữ OCR.
    expect(mockChunkPagedText).toHaveBeenCalledWith([
      { pageNumber: 1, text: LONG_PAGE_TEXT },
      {
        pageNumber: 2,
        text: 'Tiêu đề slide\nNội dung OCR được từ ảnh trang 2.',
      },
    ]);
    expect(progressGateway.emitProgress).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ phase: 'ocr' }),
    );
  });

  it('runs OCR on all pages when PDF marker splitting fails and extracted text is nearly empty', async () => {
    const { processor, system, storage, embedding, progressGateway } =
      buildProcessor();
    const pdfDocument = { ...BASE_DOCUMENT, mimeType: 'application/pdf' };
    system.document.findUnique.mockResolvedValue(pdfDocument);
    const buffer = Buffer.from('%PDF-...');
    storage.getObjectBuffer.mockResolvedValue(buffer);
    mockExtractText.mockResolvedValue('  '); // gần như rỗng -> < OCR_EMPTY_DOC_CHARS
    mockSplitPdfPagesByMarker.mockReturnValue(null); // không có marker nào (PDF scan hoàn toàn)
    mockGetPdfPageCount.mockResolvedValue(2);
    mockOcrPdfPages.mockResolvedValue(
      new Map([
        [1, 'OCR trang 1.'],
        [2, 'OCR trang 2.'],
      ]),
    );
    mockChunkPagedText.mockReturnValue([
      { content: 'OCR trang 1.', chunkIndex: 0, pageNumber: 1 },
      { content: 'OCR trang 2.', chunkIndex: 1, pageNumber: 2 },
    ]);
    embedding.embedBatch.mockResolvedValue([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);

    await processor.process({ data: { documentId: 'doc-1' } } as never);

    expect(mockGetPdfPageCount).toHaveBeenCalledWith(buffer);
    expect(mockOcrPdfPages).toHaveBeenCalledWith(buffer, [1, 2]); // OCR HẾT mọi trang (1..totalPages)
    expect(mockChunkText).not.toHaveBeenCalled(); // không dùng fallback chunkText() thường ở nhánh này
    expect(mockChunkPagedText).toHaveBeenCalledWith([
      { pageNumber: 1, text: 'OCR trang 1.' },
      { pageNumber: 2, text: 'OCR trang 2.' },
    ]);
    expect(progressGateway.emitProgress).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ phase: 'ocr' }),
    );
  });

  it('throws descriptive error noting OCR attempt when OCR also yields no content', async () => {
    const { processor, system, storage } = buildProcessor();
    const pdfDocument = { ...BASE_DOCUMENT, mimeType: 'application/pdf' };
    system.document.findUnique.mockResolvedValue(pdfDocument);
    storage.getObjectBuffer.mockResolvedValue(Buffer.from('%PDF-...'));
    mockExtractText.mockResolvedValue('');
    mockSplitPdfPagesByMarker.mockReturnValue(null);
    mockGetPdfPageCount.mockResolvedValue(1);
    mockOcrPdfPages.mockResolvedValue(new Map()); // OCR chạy nhưng không đọc được chữ nào
    mockChunkPagedText.mockReturnValue([]); // không trang nào có text -> 0 chunk

    await expect(
      processor.process({ data: { documentId: 'doc-1' } } as never),
    ).rejects.toThrow(/even after attempting OCR/i);
    expect(system.document.update).toHaveBeenLastCalledWith({
      where: { id: 'doc-1' },
      data: {
        status: 'FAILED',
        failReason: expect.stringMatching(/even after attempting OCR/i),
      },
    });
  });
});
