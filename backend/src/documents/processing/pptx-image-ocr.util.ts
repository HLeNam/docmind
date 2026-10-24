// Hàm THUẦN (không IO) cho OCR ảnh trong PPTX: chọn ảnh nào đáng OCR và ghép chữ OCR vào đúng slide.
//
// Vì sao phải chọn: OCR tốn vài giây/ảnh, còn deck thật đầy ảnh trang trí (logo lặp ở mọi slide, icon, ảnh nền). OCR hết
// vừa chậm vừa nhét chữ nhiễu ("ACME Corp ACME Corp...") vào mọi chunk. Quy tắc:
//   1. Chỉ PNG/JPEG (tesseract đọc được; EMF/WMF/SVG/GIF... bỏ qua).
//   2. Bỏ ảnh quá nhỏ (icon/bullet): < 5KB hoặc cạnh ngắn < 100px.
//   3. Cùng một ảnh (so sánh nội dung bằng SHA-256) xuất hiện ở >= 3 slide -> coi là trang trí (logo/watermark), bỏ.
//      Ảnh xuất hiện ở 1-2 slide chỉ OCR MỘT lần rồi gắn chữ vào mọi slide chứa nó.
//   4. Tối đa 60 ảnh/tài liệu (chặn deck khổng lồ làm worker chạy hàng giờ).
import { createHash } from 'node:crypto';
import type { PdfPageSegment } from './extract-text.util.js';

export interface PptxImage {
  slideNumber: number;
  name: string;
  mimeType: string;
  data: Buffer;
}

export interface OcrCandidate {
  /** SHA-256 của nội dung ảnh — cũng là khoá kết quả OCR. */
  id: string;
  data: Buffer;
  /** Các slide có ảnh này (tăng dần). */
  slides: number[];
}

export interface OcrSelectionStats {
  total: number;
  unsupported: number;
  tooSmall: number;
  decorative: number;
  truncated: number;
}

export const OCR_MIN_IMAGE_BYTES = 5_000;
export const OCR_MIN_IMAGE_SIDE_PX = 100;
export const OCR_DECORATIVE_MIN_SLIDES = 3;
export const OCR_MAX_IMAGES_PER_DOCUMENT = 60;
export const OCR_MIN_TEXT_CHARS = 4; // chữ OCR ngắn hơn (đếm ký tự khác khoảng trắng) coi là nhiễu

const SUPPORTED_MIME = new Set(['image/png', 'image/jpeg']);

/** Đọc kích thước từ header PNG/JPEG, không cần thư viện ảnh. Không đọc được -> null. */
export function getImageSize(
  data: Buffer,
  mimeType: string,
): { width: number; height: number } | null {
  try {
    if (mimeType === 'image/png') {
      // 8 byte chữ ký + chunk IHDR: [len 4][type 4]['IHDR'] rồi width(4) height(4) big-endian.
      if (data.length < 24 || data.toString('ascii', 12, 16) !== 'IHDR')
        return null;
      return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
    }
    if (mimeType === 'image/jpeg') {
      if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
      let i = 2;
      while (i + 9 < data.length) {
        if (data[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = data[i + 1]!;
        if (marker === 0xff) {
          i++;
          continue;
        }
        const isSof =
          marker >= 0xc0 &&
          marker <= 0xcf &&
          marker !== 0xc4 &&
          marker !== 0xc8 &&
          marker !== 0xcc;
        if (isSof)
          return {
            height: data.readUInt16BE(i + 5),
            width: data.readUInt16BE(i + 7),
          };
        if (
          marker === 0xd8 ||
          marker === 0x01 ||
          (marker >= 0xd0 && marker <= 0xd7)
        ) {
          i += 2; // marker không có độ dài
          continue;
        }
        i += 2 + data.readUInt16BE(i + 2);
      }
    }
  } catch {
    // dữ liệu hỏng -> không đọc được kích thước
  }
  return null;
}

export function selectImagesForOcr(images: PptxImage[]): {
  candidates: OcrCandidate[];
  stats: OcrSelectionStats;
} {
  const stats: OcrSelectionStats = {
    total: images.length,
    unsupported: 0,
    tooSmall: 0,
    decorative: 0,
    truncated: 0,
  };
  const byId = new Map<string, OcrCandidate>();

  for (const img of images) {
    if (!SUPPORTED_MIME.has(img.mimeType)) {
      stats.unsupported++;
      continue;
    }
    const size = getImageSize(img.data, img.mimeType);
    if (
      img.data.length < OCR_MIN_IMAGE_BYTES ||
      !size ||
      Math.min(size.width, size.height) < OCR_MIN_IMAGE_SIDE_PX
    ) {
      stats.tooSmall++;
      continue;
    }
    const id = createHash('sha256').update(img.data).digest('hex');
    const existing = byId.get(id);
    if (existing) {
      if (!existing.slides.includes(img.slideNumber))
        existing.slides.push(img.slideNumber);
    } else {
      byId.set(id, { id, data: img.data, slides: [img.slideNumber] });
    }
  }

  let candidates = [...byId.values()];
  const decorative = candidates.filter(
    (c) => c.slides.length >= OCR_DECORATIVE_MIN_SLIDES,
  );
  stats.decorative = decorative.length;
  candidates = candidates.filter(
    (c) => c.slides.length < OCR_DECORATIVE_MIN_SLIDES,
  );

  for (const c of candidates) c.slides.sort((a, b) => a - b);
  candidates.sort((a, b) => a.slides[0]! - b.slides[0]!);

  if (candidates.length > OCR_MAX_IMAGES_PER_DOCUMENT) {
    stats.truncated = candidates.length - OCR_MAX_IMAGES_PER_DOCUMENT;
    candidates = candidates.slice(0, OCR_MAX_IMAGES_PER_DOCUMENT);
  }
  return { candidates, stats };
}

const countNonWhitespace = (s: string) => s.replace(/\s/g, '').length;

/**
 * Ghép chữ OCR vào SAU chữ của đúng slide ("Chữ trong ảnh: …"). Slide chỉ có ảnh (không có chữ nào nên chưa có segment)
 * được tạo segment mới. Kết quả sắp theo số slide.
 */
export function mergeSlideOcrText(
  slides: PdfPageSegment[],
  candidates: OcrCandidate[],
  ocrTextById: Map<string, string>,
): PdfPageSegment[] {
  const ocrBySlide = new Map<number, string[]>();
  for (const c of candidates) {
    const text = (ocrTextById.get(c.id) ?? '').replace(/\s+/g, ' ').trim();
    if (countNonWhitespace(text) < OCR_MIN_TEXT_CHARS) continue;
    for (const slide of c.slides) {
      const list = ocrBySlide.get(slide) ?? [];
      list.push(`Chữ trong ảnh: ${text}`);
      ocrBySlide.set(slide, list);
    }
  }
  if (ocrBySlide.size === 0) return slides;

  const merged = new Map<number, string>(
    slides.map((s) => [s.pageNumber, s.text]),
  );
  for (const [slide, lines] of ocrBySlide) {
    const base = merged.get(slide);
    merged.set(slide, base ? `${base}\n${lines.join('\n')}` : lines.join('\n'));
  }
  return [...merged.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pageNumber, text]) => ({ pageNumber, text }));
}
