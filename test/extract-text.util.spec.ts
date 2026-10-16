// Chỉ test các nhánh KHÔNG phụ thuộc thư viện parse ngoài (txt/csv/md đọc thẳng buffer, và
// mimeType không hỗ trợ). KHÔNG test PDF/DOCX/PPTX/XLSX ở đây — xem cảnh báo trong
// extract-text.util.ts và WORKER_MODULE_NOTES.md: officeparser đã đổi API giữa các bản, cần tự
// test với 1 file thật trước khi tin cậy, không nên giả lập (mock) rồi tưởng là đã verify xong.

import { describe, it, expect } from 'vitest';
import {
  extractText,
  splitPdfPagesByMarker,
} from '../src/documents/processing/extract-text.util.js';

describe('extractText — plain text formats without external parser dependencies', () => {
  it('returns raw buffer as utf-8 string for text/plain', async () => {
    const result = await extractText(
      Buffer.from('Xin chào, đây là văn bản thuần.'),
      'text/plain',
    );
    expect(result).toBe('Xin chào, đây là văn bản thuần.');
  });

  it('reads text/csv directly as raw text without row/column parsing', async () => {
    const result = await extractText(Buffer.from('a,b,c\n1,2,3'), 'text/csv');
    expect(result).toBe('a,b,c\n1,2,3');
  });

  it('reads text/markdown as raw text, preserving markdown syntax', async () => {
    const result = await extractText(
      Buffer.from('# Tiêu đề\n\nNội dung.'),
      'text/markdown',
    );
    expect(result).toBe('# Tiêu đề\n\nNội dung.');
  });

  it('throws descriptive error when mimeType is unsupported', async () => {
    await expect(extractText(Buffer.from('x'), 'image/png')).rejects.toThrow(
      /Unsupported mimeType for text extraction: image\/png/,
    );
  });
});

describe('splitPdfPagesByMarker — marker boundary extraction', () => {
  it('splits text correctly by pages and preserves pageNumber using pdf-parse default markers', () => {
    const fullText = [
      'Nội dung trang 1.',
      '-- 1 of 3 --',
      'Nội dung trang 2.',
      '-- 2 of 3 --',
      'Nội dung trang 3.',
      '-- 3 of 3 --',
    ].join('\n');

    const pages = splitPdfPagesByMarker(fullText);

    expect(pages).not.toBeNull();
    expect(pages).toHaveLength(3);
    expect(pages!.map((p) => p.pageNumber)).toEqual([1, 2, 3]);
    expect(pages![0]!.text).toBe('Nội dung trang 1.');
    expect(pages![1]!.text).toBe('Nội dung trang 2.');
    expect(pages![2]!.text).toBe('Nội dung trang 3.');
  });

  it('returns null when no page markers are present in text', () => {
    expect(
      splitPdfPagesByMarker('Văn bản bình thường, không có marker trang nào.'),
    ).toBeNull();
  });

  it('appends trailing text after the last marker to the final page segment', () => {
    const fullText = [
      'Trang 1.',
      '-- 1 of 1 --',
      'Phần dư ngoài dự kiến.',
    ].join('\n');
    const pages = splitPdfPagesByMarker(fullText);

    expect(pages).toHaveLength(1);
    expect(pages![0]!.text).toContain('Trang 1.');
    expect(pages![0]!.text).toContain('Phần dư ngoài dự kiến.');
  });
});

// TODO (cần làm thủ công, không tự động hoá ở đây): test extractText() với PDF/DOCX/PPTX/XLSX
// THẬT — lấy 1 file mẫu nhỏ mỗi loại, chạy thử qua hàm này, xác nhận text trả về hợp lý.
// - PPTX/XLSX: phụ thuộc đúng API version của `officeparser` đang cài — đã xác nhận bạn dùng
//   8.1.1 (API `parseOffice()` + `ast.to('text')`), code đã khớp.
// - PDF: phụ thuộc version của `pdf-parse` — CHƯA xác nhận bạn đang cài bản nào (`npm ls pdf-parse`
//   để biết chắc). Code hiện viết theo API bản v2+ (class `PDFParse`, không có default export như
//   bản v1 cũ) vì đó là bản npm cài mặc định hiện nay — nhưng phải tự chạy thử với 1 file PDF thật
//   trước khi tin cậy, y hệt lý do không mock PPTX/XLSX ở trên.
