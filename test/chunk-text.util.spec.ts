// Pure function, không cần mock gì — test trực tiếp logic chunking.
import { describe, it, expect } from 'vitest';
import {
  chunkText,
  chunkPagedText,
} from '../src/documents/processing/chunk-text.util.js';
import type { PdfPageSegment } from '../src/documents/processing/extract-text.util.js';

describe('chunkText', () => {
  it('returns empty array when text is empty or whitespace only', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\t  ')).toEqual([]);
  });

  it('creates a single chunk with chunkIndex 0 when text is short (<500 tokens) and has no headings', () => {
    const chunks = chunkText('Đây là một đoạn văn bản ngắn để test chunking.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.chunkIndex).toBe(0);
    expect(chunks[0]!.headingContext).toBeUndefined();
    expect(chunks[0]!.content).toContain('đoạn văn bản ngắn');
  });

  it('splits long text into multiple chunks with sequentially incrementing chunkIndex', () => {
    // Lặp lại 1 câu đủ nhiều lần để chắc chắn vượt 500 token.
    const longText =
      'Đây là một câu lặp lại nhiều lần để tạo văn bản dài cho việc kiểm thử. '.repeat(
        100,
      );
    const chunks = chunkText(longText);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, i) => expect(chunk.chunkIndex).toBe(i));
  });

  it('maintains sliding window overlap between consecutive chunks', () => {
    const longText =
      'token test overlap sliding window chunk boundary check '.repeat(150);
    const chunks = chunkText(longText);
    expect(chunks.length).toBeGreaterThan(1);

    // Không assert overlap chính xác theo token (phụ thuộc tokenizer), chỉ xác nhận có cơ chế
    // overlap: tổng độ dài tất cả chunk phải LỚN HƠN độ dài text gốc (vì có phần bị lặp lại).
    const totalChunkLength = chunks.reduce(
      (sum, c) => sum + c.content.length,
      0,
    );
    expect(totalChunkLength).toBeGreaterThan(longText.trim().length);
  });

  it('splits Markdown text by sections and preserves headingContext for each chunk', () => {
    const md = [
      '# Giới thiệu',
      'Nội dung phần giới thiệu, ngắn gọn.',
      '',
      '## Chi tiết',
      'Nội dung phần chi tiết, cũng ngắn gọn.',
    ].join('\n');

    const chunks = chunkText(md);
    expect(chunks.length).toBe(2);
    expect(chunks[0]!.headingContext).toBe('# Giới thiệu');
    expect(chunks[1]!.headingContext).toBe('## Chi tiết');
    // chunkIndex vẫn phải liên tục xuyên suốt toàn bộ document, không reset về 0 mỗi section.
    expect(chunks[0]!.chunkIndex).toBe(0);
    expect(chunks[1]!.chunkIndex).toBe(1);
  });

  it('falls back to sliding window within a section if it exceeds 500 tokens while preserving headingContext', () => {
    const longSection =
      '# Phần dài\n' +
      'nội dung lặp lại nhiều lần để vượt quá 500 token mỗi chunk. '.repeat(
        100,
      );
    const chunks = chunkText(longSection);

    expect(chunks.length).toBeGreaterThan(1);
    // Mọi sub-chunk thuộc section này đều phải giữ cùng headingContext.
    chunks.forEach((c) => expect(c.headingContext).toBe('# Phần dài'));
    // chunkIndex vẫn liên tục, không trùng lặp.
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });

  it('keeps short consecutive Markdown headings as separate chunks without merging', () => {
    const md = [
      '# A',
      'nội dung A',
      '# B',
      'nội dung B',
      '# C',
      'nội dung C',
    ].join('\n');
    const chunks = chunkText(md);
    expect(chunks).toHaveLength(3);
    expect(chunks.map((c) => c.headingContext)).toEqual(['# A', '# B', '# C']);
  });
});

describe('chunkPagedText', () => {
  it('creates 1 chunk per page for short pages with correct pageNumber and continuous chunkIndex', () => {
    const pages: PdfPageSegment[] = [
      { pageNumber: 1, text: 'Nội dung trang một.' },
      { pageNumber: 2, text: 'Nội dung trang hai.' },
      { pageNumber: 3, text: 'Nội dung trang ba.' },
    ];
    const chunks = chunkPagedText(pages);

    expect(chunks).toHaveLength(3);
    expect(chunks.map((c) => c.pageNumber)).toEqual([1, 2, 3]);
    expect(chunks.map((c) => c.chunkIndex)).toEqual([0, 1, 2]); // KHÔNG reset về 0 mỗi trang
    expect(chunks[0]!.content).toContain('trang một');
  });

  it('skips empty or whitespace-only pages without creating empty chunks', () => {
    const pages: PdfPageSegment[] = [
      { pageNumber: 1, text: '   ' },
      { pageNumber: 2, text: 'Có nội dung thật ở đây.' },
    ];
    const chunks = chunkPagedText(pages);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.pageNumber).toBe(2);
    expect(chunks[0]!.chunkIndex).toBe(0); // vẫn bắt đầu từ 0, không để lại "lỗ hổng" vì trang 1 bị bỏ
  });

  it('falls back to sliding window within a long page while preserving the same pageNumber for all sub-chunks', () => {
    const longPageText =
      'nội dung lặp lại nhiều lần để vượt quá 500 token mỗi chunk. '.repeat(
        100,
      );
    const pages: PdfPageSegment[] = [{ pageNumber: 5, text: longPageText }];
    const chunks = chunkPagedText(pages);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c) => expect(c.pageNumber).toBe(5));
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });

  it('returns empty array when given an empty list of pages', () => {
    expect(chunkPagedText([])).toEqual([]);
  });
});
