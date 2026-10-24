// Pure function, không cần mock gì — test trực tiếp logic chunking.
import { describe, it, expect } from 'vitest';
import {
  chunkText,
  chunkPagedText,
} from '../src/documents/processing/chunk-text.util.js';
import type { PdfPageSegment } from '../src/documents/processing/extract-text.util.js';

describe('chunkText', () => {
  it('text rỗng (hoặc chỉ whitespace) -> trả về mảng rỗng, không throw', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\t  ')).toEqual([]);
  });

  it('text ngắn (dưới 500 token, không có heading) -> đúng 1 chunk, chunkIndex = 0', () => {
    const chunks = chunkText('Đây là một đoạn văn bản ngắn để test chunking.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.chunkIndex).toBe(0);
    expect(chunks[0]!.headingContext).toBeUndefined();
    expect(chunks[0]!.content).toContain('đoạn văn bản ngắn');
  });

  it('text dài (không heading) -> chia nhiều chunk, chunkIndex tăng dần liên tục từ 0', () => {
    // Lặp lại 1 câu đủ nhiều lần để chắc chắn vượt 500 token.
    const longText =
      'Đây là một câu lặp lại nhiều lần để tạo văn bản dài cho việc kiểm thử. '.repeat(
        100,
      );
    const chunks = chunkText(longText);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, i) => expect(chunk.chunkIndex).toBe(i));
  });

  it('text dài (không heading) -> có overlap giữa 2 chunk liên tiếp (chunk sau chứa phần đuôi chunk trước)', () => {
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

  it('text có Markdown heading -> chia theo section, mỗi chunk giữ đúng headingContext của section đó', () => {
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

  it('heading có ký tự bị escape bởi turndown (vd "1\\.") -> headingContext được bỏ backslash', () => {
    const md = [
      '### 1\\. Khái niệm',
      'Nội dung ngắn.',
      '',
      '### 2\\. Lợi ích',
      'Nội dung khác.',
    ].join('\n');
    const chunks = chunkText(md);
    expect(chunks.map((c) => c.headingContext)).toEqual([
      '### 1. Khái niệm',
      '### 2. Lợi ích',
    ]);
  });

  it('1 section Markdown quá dài (>500 token) -> fallback sliding window NGAY TRONG section, vẫn giữ headingContext', () => {
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

  it('nhiều heading ngắn liên tiếp (mỗi section đều dưới 500 token) -> số chunk = số section, không gộp lại', () => {
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
  it('mỗi trang ngắn -> 1 chunk/trang, pageNumber đúng theo trang, chunkIndex liên tục xuyên suốt', () => {
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

  it('trang trống (vd trang bìa/chỉ có ảnh) -> bị bỏ qua, không tạo chunk rỗng', () => {
    const pages: PdfPageSegment[] = [
      { pageNumber: 1, text: '   ' },
      { pageNumber: 2, text: 'Có nội dung thật ở đây.' },
    ];
    const chunks = chunkPagedText(pages);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.pageNumber).toBe(2);
    expect(chunks[0]!.chunkIndex).toBe(0); // vẫn bắt đầu từ 0, không để lại "lỗ hổng" vì trang 1 bị bỏ
  });

  it('1 trang dài (>500 token) -> fallback sliding window NGAY TRONG trang đó, mọi sub-chunk vẫn giữ đúng pageNumber', () => {
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

  it('danh sách trang rỗng -> trả về mảng rỗng, không throw', () => {
    expect(chunkPagedText([])).toEqual([]);
  });
});
