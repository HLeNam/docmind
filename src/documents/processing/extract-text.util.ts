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
import TurndownService from 'turndown';

// DOCX -> Markdown (xem case DOCX bên dưới): convert sang HTML trước (mammoth.convertToHtml(), GIỮ
// được heading Word "Heading 1/2/3..." dưới dạng <h1>/<h2>/<h3>...) rồi convert tiếp HTML -> Markdown
// bằng turndown. `headingStyle: 'atx'` BẮT BUỘC (không để mặc định 'setext') — chunkByHeading() trong
// chunk-text.util.ts match heading bằng regex `/^#{1,6}\s/m` (dạng "# ", "## "...), kiểu 'setext'
// (gạch dưới === / ---) sẽ KHÔNG match được, heading bị coi như văn bản thường, mất hết ý nghĩa đổi
// sang markdown. Khởi tạo 1 LẦN DUY NHẤT ở module scope (không state per-request, instance stateless,
// tái dùng được) thay vì new TurndownService() mỗi lần gọi extractText().
const turndownService = new TurndownService({ headingStyle: 'atx' });

// pageNumber citation: pdf-parse (cấu hình MẶC ĐỊNH, không cần truyền option gì thêm) tự chèn 1
// marker "\n-- <trang> of <tổng số trang> --\n" vào CUỐI text của MỖI trang khi gọi getText() (tham
// số `pageJoiner`, xem docs/options.md của pdf-parse — mặc định
// '\n-- page_number of total_number --', ÁP DỤNG NGAY CẢ KHI KHÔNG dùng `partial`). Đã xác nhận
// marker này CÓ THẬT trong text extract từ PDF thật của bạn (dạng "-- 1 of 6 --" xuất hiện trong
// chunk content trước đây) -> tận dụng marker có sẵn để tách lại ranh giới trang SAU KHI extract,
// KHÔNG cần đổi sang gọi getText({partial:[i]}) từng trang riêng (chậm hơn nhiều lần, 1 request/trang).
const PDF_PAGE_MARKER_RE = /\n?-- (\d+) of (\d+) --\n?/g;

export interface PdfPageSegment {
  pageNumber: number;
  text: string;
}

// Trả null nếu KHÔNG tìm thấy marker nào (vd bản pdf-parse sau này đổi default pageJoiner, hoặc
// PDF chỉ có 1 trang và vẫn có marker — trường hợp 0 match thực tế hiếm, chỉ phòng thủ) -> chỗ gọi
// (processor) fallback về chunkText() thường, không gắn pageNumber, thay vì throw lỗi làm hỏng cả
// pipeline chỉ vì không tách được trang.
export function splitPdfPagesByMarker(
  fullText: string,
): PdfPageSegment[] | null {
  const matches = [...fullText.matchAll(PDF_PAGE_MARKER_RE)];
  if (matches.length === 0) return null;

  const segments: PdfPageSegment[] = [];
  let cursor = 0;
  for (const match of matches) {
    const pageNumber = Number(match[1]);
    const text = fullText.slice(cursor, match.index).trim();
    segments.push({ pageNumber, text });
    cursor = match.index! + match[0].length;
  }
  // Phần text còn sót lại SAU marker cuối cùng -> chỉ xảy ra nếu có nội dung ngoài vùng trang đã
  // đánh dấu (hiếm). Gộp vào trang cuối cùng thay vì bỏ mất, để không mất nội dung thật nào.
  const trailing = fullText.slice(cursor).trim();
  if (trailing && segments.length > 0) {
    segments[segments.length - 1]!.text =
      `${segments[segments.length - 1]!.text}\n${trailing}`.trim();
  }
  return segments;
}

// Dùng cho nhánh OCR (ocr.util.ts) khi KHÔNG tách được trang qua marker (splitPdfPagesByMarker trả
// null) — cần biết tổng số trang để OCR hết TOÀN BỘ document. Gọi getInfo() thay vì getText() vì
// nhẹ hơn nhiều (không decode text, chỉ đọc metadata PDF).
export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  const parser = new PDFParse({ data: buffer });
  try {
    const info = await parser.getInfo();
    return info.total;
  } finally {
    await parser.destroy();
  }
}

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
      // ĐỔI từ mammoth.extractRawText() (bỏ hết heading, chỉ còn text phẳng) sang
      // convertToHtml() + turndown (html -> markdown): giữ được cấu trúc heading Word dưới dạng
      // markdown "#"/"##"... -> chunkText() (cơ chế chunkByHeading() đã có sẵn từ Phase 1, trước giờ
      // chỉ phát huy tác dụng với file .md thật) tự động tách theo heading và gắn headingContext cho
      // DOCX -> citation "nhảy đúng đoạn" được, cùng tinh thần pageNumber của PDF nhưng theo đơn vị
      // heading thay vì trang (Word không có khái niệm trang cố định trong nội dung, phụ thuộc lúc
      // render). KHÔNG giữ song song cách cũ (extractRawText) — tránh thêm flag/field không cần thiết.
      //
      // ⚠️ CHƯA tự test với 1 file .docx thật có heading — CẦN xác nhận: (1) mammoth có thật sự map
      // đúng style "Heading 1/2/3" của Word sang <h1>/<h2>/<h3> cho file thật của bạn (mapping mặc
      // định của mammoth, không custom styleMap); (2) turndown ra đúng markdown hợp lệ, không vỡ cấu
      // trúc đoạn văn. File .docx KHÔNG dùng style "Heading" (vd chỉ bôi đậm/tăng cỡ chữ thủ công thay
      // vì áp style) sẽ KHÔNG có heading nào trong HTML -> hasMarkdownHeadings ở chunkText() = false ->
      // tự fallback về sliding window như cũ, pageNumber/headingContext đều null — KHÔNG phải lỗi.
      const { value: html } = await mammoth.convertToHtml({ buffer });
      return turndownService.turndown(html);
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
      throw new Error(`Unsupported mimeType for text extraction: ${mimeType}`);
  }
}

// Vẫn CHƯA hỗ trợ ở Phase 2 MVP: định dạng binary cũ (.doc/.xls/.ppt Office 97-2003), ODF
// (.odt/.ods/.odp — dù officeparser hỗ trợ sẵn, chỉ chưa thêm vào ALLOWED_MIME_TYPES vì ít gặp ở
// công ty dùng Microsoft 365/Google Workspace). Thêm sau chỉ cần thêm 1-2 dòng vào
// ALLOWED_MIME_TYPES (document.schema.ts) + 1 case ở trên, không đổi kiến trúc.
//
// ✅ pageNumber: ĐÃ gắn được (xem splitPdfPagesByMarker() ở trên) — tận dụng marker pageJoiner có
// sẵn trong text trả về của getText(), không cần đổi cách gọi pdf-parse.
//
// ✅ OCR cho PDF scan ảnh: ĐÃ xử lý — xem ocr.util.ts (ocrPdfPages(), dùng tesseract.js) và nhánh
// chunkPdfWithOcrFallback() trong document-processing.processor.ts. extractText() ở TRÊN KHÔNG đổi
// gì — vẫn chỉ gọi getText() thường; OCR là bước FALLBACK RIÊNG chạy SAU, chỉ khi text thường extract
// ra quá ít (xem OCR_SPARSE_PAGE_CHARS trong ocr.util.ts), không làm chậm case PDF text bình thường.
//
// ✅ headingContext cho DOCX ("nhảy đúng đoạn" như pageNumber của PDF): ĐÃ xử lý — xem case DOCX ở
// trên (mammoth.convertToHtml() + turndown thay vì extractRawText()). PPTX/XLSX CHƯA làm (đơn vị tự
// nhiên là "slide"/"sheet", không phải heading markdown — cần hướng khác, xem thảo luận trong hội
// thoại xây dựng dự án, chưa ghi thành field riêng vì chưa triển khai).
