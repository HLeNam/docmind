// test/chunk-text.util.spec.ts
//
// Pure function, không cần mock gì — test trực tiếp logic chunking.
import { chunkText } from '../src/documents/processing/chunk-text.util.js';

describe('chunkText', () => {
  it('empty text (or only whitespace) -> returns empty array, does not throw', () => {
    expect(chunkText('')).toEqual([]);
    expect(chunkText('   \n\t  ')).toEqual([]);
  });

  it('short text (under 500 tokens, no heading) -> exactly 1 chunk, chunkIndex = 0', () => {
    const chunks = chunkText('Đây là một đoạn văn bản ngắn để test chunking.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.chunkIndex).toBe(0);
    expect(chunks[0]!.headingContext).toBeUndefined();
    expect(chunks[0]!.content).toContain('đoạn văn bản ngắn');
  });

  it('long text (no heading) -> split into multiple chunks, chunkIndex increments sequentially from 0', () => {
    // Lặp lại 1 câu đủ nhiều lần để chắc chắn vượt 500 token.
    const longText =
      'Đây là một câu lặp lại nhiều lần để tạo văn bản dài cho việc kiểm thử. '.repeat(
        100,
      );
    const chunks = chunkText(longText);

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, i) => expect(chunk.chunkIndex).toBe(i));
  });

  it('long text (no heading) -> has overlap between 2 consecutive chunks (next chunk contains tail of previous chunk)', () => {
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

  it('text with Markdown heading -> split by section, each chunk keeps the exact headingContext of that section', () => {
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

  it('1 Markdown section too long (>500 tokens) -> fallback to sliding window INSIDE section, keeps headingContext', () => {
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

  it('multiple short consecutive headings (each section under 500 tokens) -> number of chunks = number of sections, no merging', () => {
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
