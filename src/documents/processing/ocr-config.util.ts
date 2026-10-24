// Cấu hình tesseract.js worker từ env — tách riêng khỏi ocr.util.ts để test không cần nạp tesseract.js/pdf-parse.
//
//   OCR_LANG_PATH   (tuỳ chọn) Thư mục chứa eng.traineddata.gz + vie.traineddata.gz. Có đặt -> tesseract.js đọc
//                   file local, KHÔNG gọi CDN (chạy được khi server không ra internet, không phụ thuộc jsdelivr).
//                   Không đặt -> hành vi cũ: tải từ CDN ở lần chạy đầu rồi cache.
//   OCR_CACHE_PATH  (tuỳ chọn) Thư mục cache của tesseract.js. Mặc định tesseract.js (Node) cache vào thư mục chạy
//                   (cwd) — trong Docker nên trỏ vào volume/thư mục ghi được.
//
// Đặt OCR_LANG_PATH mà THIẾU file -> throw lỗi rõ ràng ngay (kèm cách sửa) thay vì để tesseract.js văng lỗi mơ hồ
// giữa chừng khi đang xử lý tài liệu.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const OCR_LANGUAGE_CODES = ['eng', 'vie'] as const;
export const OCR_LANGUAGES = OCR_LANGUAGE_CODES.join('+'); // 'eng+vie'

export interface OcrWorkerOptions {
  langPath?: string;
  gzip?: boolean;
  cachePath?: string;
}

export function resolveOcrWorkerOptions(
  env: Record<string, string | undefined> = process.env,
  fileExists: (path: string) => boolean = existsSync,
): OcrWorkerOptions {
  const options: OcrWorkerOptions = {};

  const cachePath = env.OCR_CACHE_PATH?.trim();
  if (cachePath) options.cachePath = cachePath;

  const langPath = env.OCR_LANG_PATH?.trim();
  if (!langPath) return options;

  const missing = OCR_LANGUAGE_CODES.map((l) => `${l}.traineddata.gz`).filter(
    (f) => !fileExists(join(langPath, f)),
  );
  if (missing.length > 0) {
    throw new Error(
      `OCR_LANG_PATH="${langPath}" is missing required files: ${missing.join(', ')}. ` +
        `Download with: node scripts/download-tessdata.mjs ${langPath}`,
    );
  }

  options.langPath = langPath;
  options.gzip = true; // file là .traineddata.gz
  return options;
}
