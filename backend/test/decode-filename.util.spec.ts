import { describe, expect, it } from 'vitest';
import { decodeUploadedFilename } from '../src/documents/decode-filename.util.js';

// Mô phỏng đúng thứ multer làm: byte UTF-8 của tên file bị đọc như latin1.
const asMulterSees = (utf8Name: string) =>
  Buffer.from(utf8Name, 'utf8').toString('latin1');

describe('decodeUploadedFilename', () => {
  it.each([
    'TÀI LIỆU HƯỚNG DẪN HỌC TẬP VÀ THAM KHẢO MÔN TTHCM.pptx',
    'Báo cáo quý 3 - Đề cương.docx',
    'Ảnh chụp màn hình.png',
  ])('restores Vietnamese filenames corrupted by multer: %s', (name) => {
    const broken = asMulterSees(name);
    expect(broken).not.toBe(name);
    expect(decodeUploadedFilename(broken)).toBe(name);
  });

  it('keeps ASCII filename unchanged', () => {
    expect(decodeUploadedFilename('2023-Lecture10-BasicML.pdf')).toBe(
      '2023-Lecture10-BasicML.pdf',
    );
  });

  it('keeps already valid Unicode filename intact without re-decoding', () => {
    expect(decodeUploadedFilename('Tài liệu.pdf')).toBe('Tài liệu.pdf');
  });

  it('keeps valid latin1 filename unchanged when not valid UTF-8', () => {
    expect(decodeUploadedFilename('café.txt')).toBe('café.txt');
  });
});
