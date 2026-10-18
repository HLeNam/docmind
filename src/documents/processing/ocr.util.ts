// OCR fallback cho PDF scan ảnh — dùng tesseract.js (chạy THUẦN NODE, KHÔNG cần cài binary
// Tesseract riêng ngoài hệ điều hành, KHÔNG gọi API trả phí nào) kết hợp pdf-parse.getScreenshot()
// để rasterize từng trang PDF cần OCR thành ảnh PNG, rồi OCR ảnh đó. Đúng tinh thần "không phải hộp
// đen" của sản phẩm (self-hosted hoàn toàn, không phụ thuộc Google Vision/AWS Textract...).
//
// ⚠️ CHƯA XÁC NHẬN bằng PDF scan ảnh THẬT — code viết theo README/docs chính thức của pdf-parse
// (getScreenshot({partial, scale}) trả {pages: [{data: Buffer PNG}]}) và tesseract.js
// (createWorker(langs) + worker.recognize(buffer)), nhưng CHƯA tự chạy thử với 1 file PDF scan thật.
// PHẢI tự test trước khi tin cậy, giống mọi provider khác trong dự án (xem cảnh báo tương tự ở
// gemini-embedding.service.ts, extract-text.util.ts phần PDF).
//
// Ngôn ngữ OCR (ocr-config.util.ts): 'eng+vie' (tiếng Anh + tiếng Việt) — khớp đối tượng dùng chính của DocMind.
// tesseract.js MẶC ĐỊNH tải file .traineddata ngôn ngữ từ CDN (jsdelivr) ở LẦN CHẠY ĐẦU TIÊN nếu
// chưa có sẵn local. Production: đặt env OCR_LANG_PATH trỏ vào thư mục chứa eng/vie.traineddata.gz (tải bằng
// `node scripts/download-tessdata.mjs <thư mục>`) -> không cần mạng ra ngoài; xem ocr-config.util.ts và
// "Triển khai production" trong WORKER_MODULE_NOTES.md mục 9.
import { Logger } from '@nestjs/common';
import { createWorker } from 'tesseract.js';
import { PDFParse } from 'pdf-parse';
import { OCR_LANGUAGES, resolveOcrWorkerOptions } from './ocr-config.util.js';

const logger = new Logger('OCR');
// Scale 2x giúp tesseract đọc chữ nhỏ/mờ chính xác hơn đáng kể so với scale mặc định 1 (kinh nghiệm
// phổ biến khi OCR ảnh scan văn bản, đặc biệt văn bản tiếng Việt có dấu) — đánh đổi: ảnh lớn hơn,
// OCR chậm hơn đáng kể so với 1 trang scale=1. Chưa đo thời gian thực tế, có thể cần chỉnh lại.
const SCREENSHOT_SCALE = 2;

// Ngưỡng "trang ít chữ" (đếm ký tự KHÁC khoảng trắng): trang có text layer dưới ngưỡng này bị coi là
// nội dung có thể nằm trong ảnh (slide chỉ có tiêu đề + sơ đồ/ảnh, trang scan...) -> OCR rồi GHÉP chữ OCR
// vào chữ có sẵn. Đo trên PDF slide thật (2023-Lecture10-BasicML.pdf): slide sơ đồ "Types of machine
// learning" chỉ có 85-108 ký tự (tiêu đề + dòng nguồn), trong khi slide toàn chữ thường 300+ ký tự ->
// 200 tách được hai nhóm. Đánh đổi: slide ít chữ nhưng không có ảnh cũng bị OCR thừa (chậm hơn một
// chút, không sai kết quả). Chưa đo thời gian OCR thực tế, có thể cần chỉnh ngưỡng.
export const OCR_SPARSE_PAGE_CHARS = 200;

// Ngưỡng "cả document gần như không có chữ" khi KHÔNG tách được trang qua marker (xem
// chunkPdfWithOcrFallback): dưới ngưỡng này coi là PDF scan hoàn toàn và OCR hết mọi trang.
export const OCR_EMPTY_DOC_CHARS = 20;

// OCR các trang trong `pageNumbers` của 1 PDF (dùng LẠI buffer đã tải từ storage ở processor, KHÔNG
// tải lại file). Trả Map<pageNumber, text> — trang nào render/OCR lỗi thì KHÔNG có mặt trong Map
// (bị bỏ qua, không throw làm hỏng cả document chỉ vì 1 trang lỗi).
export interface OcrPdfPagesOptions {
  /**
   * Gọi TRƯỚC khi OCR mỗi trang. Throw để dừng ngay (vd document đã bị xoá giữa chừng) — lỗi lan ra cho caller,
   * worker tesseract và parser vẫn được dọn trong `finally`.
   */
  beforePage?: () => Promise<void>;
}

export async function ocrPdfPages(
  buffer: Buffer,
  pageNumbers: number[],
  options: OcrPdfPagesOptions = {},
): Promise<Map<number, string>> {
  const results = new Map<number, string>();
  if (pageNumbers.length === 0) return results;

  // Kiểm tra cấu hình TRƯỚC khi tốn công mở PDF; thiếu traineddata local -> lỗi rõ ràng (xem ocr-config.util.ts).
  const workerOptions = resolveOcrWorkerOptions();
  const startedAt = Date.now();
  const parser = new PDFParse({ data: buffer });
  const worker = await createWorker(OCR_LANGUAGES, 1, workerOptions); // 1 = LSTM only (mặc định của tesseract.js >= 5)

  try {
    // Tuần tự từng trang (KHÔNG Promise.all song song) — tesseract.js worker xử lý 1 ảnh/lần, chạy
    // song song nhiều ảnh trên CÙNG 1 worker không tăng tốc (vẫn phải xếp hàng nội bộ), lại tốn thêm
    // bộ nhớ giữ nhiều ảnh cùng lúc. Tạo nhiều worker song song là tối ưu hoá có thể làm sau nếu đo
    // được OCR là bottleneck thật của pipeline.
    for (const pageNumber of pageNumbers) {
      await options.beforePage?.();
      const screenshot = await parser.getScreenshot({
        partial: [pageNumber],
        scale: SCREENSHOT_SCALE,
      });
      const pageImage = screenshot.pages[0]?.data;
      if (!pageImage) continue; // trang không render ra ảnh được (hiếm) -> bỏ qua trang này

      const { data } = await worker.recognize(Buffer.from(pageImage));
      const text = data.text.trim();
      if (text) results.set(pageNumber, text);
    }
  } finally {
    await worker.terminate();
    await parser.destroy();
    // Số liệu thật để chỉnh ngưỡng/timeout sau này (trước đây chưa đo được thời gian OCR).
    const ms = Date.now() - startedAt;
    logger.log(
      `OCR ${results.size}/${pageNumbers.length} pages in ${ms}ms` +
        (pageNumbers.length > 0
          ? ` (~${Math.round(ms / pageNumbers.length)}ms/page)`
          : '') +
        (workerOptions.langPath
          ? ' [local traineddata]'
          : ' [traineddata from CDN]'),
    );
  }

  return results;
}
