// OCR fallback cho PDF scan ảnh — dùng tesseract.js (chạy THUẦN NODE, KHÔNG cần cài binary
// Tesseract riêng ngoài hệ điều hành, KHÔNG gọi API trả phí nào) kết hợp pdf-parse.getScreenshot()
// để rasterize từng trang PDF cần OCR thành ảnh PNG, rồi OCR ảnh đó. Đúng tinh thần "không phải hộp
// đen" của sản phẩm (self-hosted hoàn toàn, không phụ thuộc Google Vision/AWS Textract...).
//
// ⚠️ CHƯA XÁC NHẬN bằng PDF scan ảnh THẬT — code viết theo README/docs chính thức của pdf-parse
// (getScreenshot({partial, scale}) trả {pages: [{data: Uint8Array PNG}]}) và tesseract.js
// (createWorker(langs) + worker.recognize(Buffer.from(pageImage))), nhưng CHƯA tự chạy thử với 1 file PDF scan thật.
// PHẢI tự test trước khi tin cậy, giống mọi provider khác trong dự án (xem cảnh báo tương tự ở
// gemini-embedding.service.ts, extract-text.util.ts phần PDF).
//
// Ngôn ngữ OCR: 'eng+vie' (tiếng Anh + tiếng Việt) — khớp đối tượng dùng chính của DocMind.
// tesseract.js MẶC ĐỊNH tải file .traineddata ngôn ngữ từ CDN (jsdelivr) ở LẦN CHẠY ĐẦU TIÊN nếu
// chưa có sẵn local — nghĩa là cần mạng ra ngoài lần đầu. Môi trường production self-hosted/hạn chế
// mạng ra ngoài NÊN tải sẵn eng.traineddata.gz + vie.traineddata.gz và trỏ option `langPath` vào thư
// mục local khi gọi createWorker() — xem "Triển khai production" trong WORKER_MODULE_NOTES.md mục 9.
import { createWorker } from 'tesseract.js';
import { PDFParse } from 'pdf-parse';

const OCR_LANGUAGES = 'eng+vie';
// Scale 2x giúp tesseract đọc chữ nhỏ/mờ chính xác hơn đáng kể so với scale mặc định 1 (kinh nghiệm
// phổ biến khi OCR ảnh scan văn bản, đặc biệt văn bản tiếng Việt có dấu) — đánh đổi: ảnh lớn hơn,
// OCR chậm hơn đáng kể so với 1 trang scale=1. Chưa đo thời gian thực tế, có thể cần chỉnh lại.
const SCREENSHOT_SCALE = 2;

// Ngưỡng coi 1 trang là "có khả năng là ảnh scan, cần OCR" — text thường (không OCR) của 1 trang
// thực sự có nội dung hiếm khi dưới ngưỡng này (vd trang bìa chỉ có vài chữ vẫn thường > 20 ký tự).
// Cố ý để THẤP (an toàn false-negative hơn false-positive): thà bỏ sót 1 trang scan hiếm gặp còn hơn
// OCR nhầm hàng loạt trang đã có text tốt (OCR chậm hơn đọc text trực tiếp rất nhiều).
export const OCR_MIN_CHARS_PER_PAGE = 20;

// OCR các trang trong `pageNumbers` của 1 PDF (dùng LẠI buffer đã tải từ storage ở processor, KHÔNG
// tải lại file). Trả Map<pageNumber, text> — trang nào render/OCR lỗi thì KHÔNG có mặt trong Map
// (bị bỏ qua, không throw làm hỏng cả document chỉ vì 1 trang lỗi).
export async function ocrPdfPages(
  buffer: Buffer,
  pageNumbers: number[],
): Promise<Map<number, string>> {
  const results = new Map<number, string>();
  if (pageNumbers.length === 0) return results;

  const parser = new PDFParse({ data: buffer });
  const worker = await createWorker(OCR_LANGUAGES);

  try {
    // Tuần tự từng trang (KHÔNG Promise.all song song) — tesseract.js worker xử lý 1 ảnh/lần, chạy
    // song song nhiều ảnh trên CÙNG 1 worker không tăng tốc (vẫn phải xếp hàng nội bộ), lại tốn thêm
    // bộ nhớ giữ nhiều ảnh cùng lúc. Tạo nhiều worker song song là tối ưu hoá có thể làm sau nếu đo
    // được OCR là bottleneck thật của pipeline.
    for (const pageNumber of pageNumbers) {
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
  }

  return results;
}
