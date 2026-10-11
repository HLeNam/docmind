// src/documents/processing/extract-text.util.ts
//
// officeparser@8.1.1 (bản đang cài — xác nhận qua `npm ls officeparser`): API mới, KHÁC hẳn bản cũ
// `parseOfficeAsync(buffer)`. Giờ dùng `parseOffice(buffer, { fileType })` trả về 1 AST
// (`OfficeParserAST`), phải gọi thêm `await ast.to('text')` (bất đồng bộ) để lấy text —
// `ast.toText()` vẫn tồn tại nhưng đã deprecated (đồng bộ, khuyến nghị chuyển sang `.to('text')`).
// Truyền `fileType` tường minh ('pptx'/'xlsx') thay vì để tự đoán từ buffer — nhanh và chắc chắn hơn.
//
// pdf-parse cũng vừa đổi hẳn API: bản cũ (v1, Danejan) export 1 FUNCTION mặc định
// (`import pdfParse from 'pdf-parse'; pdfParse(buffer)`); bản mới (v2+, mehmet-kozan, rewrite
// TypeScript) KHÔNG còn default export, thay bằng class `PDFParse` — xem usage bên dưới. CHƯA xác
// nhận version thật bạn đang cài (chạy `npm ls pdf-parse` rồi đối chiếu, giống bước đã làm với
// officeparser) — code dưới viết theo API bản v2+ vì đó là bản đang được npm cài mặc định hiện nay.
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import officeParser from 'officeparser';

export async function extractText(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  switch (mimeType) {
    case 'application/pdf': {
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        return result.text;
      } finally {
        // README của pdf-parse v2+ yêu cầu luôn gọi destroy() để giải phóng bộ nhớ worker nội bộ
        // (khác hẳn bản v1 cũ, chỉ là 1 hàm thuần không giữ state) — bỏ bước này dễ rò rỉ memory
        // khi xử lý nhiều PDF liên tiếp trong worker.
        await parser.destroy();
      }
    }
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
      // .pptx
      const ast = await officeParser.parseOffice(buffer, { fileType: 'pptx' });
      const { value } = await ast.to('text');
      return value;
    }
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
      // .xlsx
      // officeparser xử lý chung các định dạng Office còn lại. PDF/DOCX vẫn giữ pdf-parse/mammoth
      // đã chọn ở trên — ổn định, không đổi để giảm rủi ro.
      const ast = await officeParser.parseOffice(buffer, { fileType: 'xlsx' });
      const { value } = await ast.to('text');
      return value;
    }
    case 'text/csv':
    case 'text/plain':
    case 'text/markdown':
      // CSV ở MVP đọc thẳng như text thô, KHÔNG parse theo hàng/cột — chunking cắt theo token như
      // mọi văn bản khác nên sẽ mất cấu trúc bảng. Xem "Đã hoãn có chủ đích" trong doc Phase 2.
      return buffer.toString('utf-8');
    default:
      throw new Error(`Unsupported extract text for mimeType: ${mimeType}`);
  }
}

// Vẫn CHƯA hỗ trợ ở Phase 2 MVP: định dạng binary cũ (.doc/.xls/.ppt Office 97-2003), ODF
// (.odt/.ods/.odp — dù officeparser hỗ trợ sẵn, chỉ chưa thêm vào ALLOWED_MIME_TYPES vì ít gặp ở
// công ty dùng Microsoft 365/Google Workspace), và ảnh/scan (OCR). Thêm sau chỉ cần thêm 1-2 dòng
// vào ALLOWED_MIME_TYPES (document.schema.ts) + 1 case ở trên, không đổi kiến trúc.
//
// pageNumber chưa gắn được ở bước chunk vì pdf-parse (cấu hình mặc định) trả về text đã gộp toàn
// bộ PDF, không giữ ranh giới trang. Muốn có pageNumber chính xác cần đổi sang xử lý theo từng
// trang PDF riêng (pdf-parse hỗ trợ qua callback `pagerender`) — để trống ở Phase 2 MVP.
