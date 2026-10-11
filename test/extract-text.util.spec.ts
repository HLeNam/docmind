// test/extract-text.util.spec.ts
//
// Chỉ test các nhánh KHÔNG phụ thuộc thư viện parse ngoài (txt/csv/md đọc thẳng buffer, và
// mimeType không hỗ trợ). KHÔNG test PDF/DOCX/PPTX/XLSX ở đây — xem cảnh báo trong
// extract-text.util.ts và WORKER_MODULE_NOTES.md: officeparser đã đổi API giữa các bản, cần tự
// test với 1 file thật trước khi tin cậy, không nên giả lập (mock) rồi tưởng là đã verify xong.

import { extractText } from '../src/documents/processing/extract-text.util.js';

describe('extractText — pure text branches (no external parsing library required)', () => {
  it('text/plain -> returns buffer directly as utf-8 string', async () => {
    const result = await extractText(
      Buffer.from('Xin chào, đây là văn bản thuần.'),
      'text/plain',
    );
    expect(result).toBe('Xin chào, đây là văn bản thuần.');
  });

  it('text/csv -> read directly as raw text, DOES NOT parse by rows/cols', async () => {
    const result = await extractText(Buffer.from('a,b,c\n1,2,3'), 'text/csv');
    expect(result).toBe('a,b,c\n1,2,3');
  });

  it('text/markdown -> read directly as is, keeps Markdown syntax intact (for chunk-text to handle headings)', async () => {
    const result = await extractText(
      Buffer.from('# Tiêu đề\n\nNội dung.'),
      'text/markdown',
    );
    expect(result).toBe('# Tiêu đề\n\nNội dung.');
  });

  it('unsupported mimeType -> throws clear error indicating the mimeType', async () => {
    await expect(extractText(Buffer.from('x'), 'image/png')).rejects.toThrow(
      /image\/png/,
    );
  });
});

// TODO (cần làm thủ công, không tự động hoá ở đây): test extractText() với PDF/DOCX/PPTX/XLSX
// THẬT — lấy 1 file mẫu nhỏ mỗi loại, chạy thử qua hàm này, xác nhận text trả về hợp lý. Đặc biệt
// chú ý PPTX/XLSX vì phụ thuộc đúng API version của `officeparser` đang cài (xem comment đầu file
// extract-text.util.ts). Nếu `parseOfficeAsync` không tồn tại ở version đã cài, lỗi sẽ hiện ngay
// khi chạy thử, dễ sửa hơn là phát hiện qua 1 unit test giả (mock) rồi tưởng nhầm là đã chạy đúng.
