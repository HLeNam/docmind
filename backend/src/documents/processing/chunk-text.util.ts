// Dùng tiktoken (cùng tokenizer cl100k_base mà OpenAI embedding model dùng) để đếm token chính
// xác, thay vì đếm theo từ (ước lượng sai lệch nhiều với tiếng Việt do dấu).
import { get_encoding } from 'tiktoken';
import type { PdfPageSegment } from './extract-text.util.js';
import type { SpreadsheetSheet } from './office-structure.util.js';

const encoding = get_encoding('cl100k_base');

export interface TextChunk {
  content: string;
  chunkIndex: number;
  headingContext?: string;
  // Chỉ có giá trị khi chunk được tạo từ chunkPagedText() (PDF, tách được ranh giới trang qua
  // splitPdfPagesByMarker()) — mọi định dạng khác (docx/pptx/xlsx/txt/csv/md) hoặc PDF không tách
  // được trang vẫn dùng chunkText() như cũ, pageNumber luôn null ở DB (xem document-processing.processor.ts).
  pageNumber?: number;
}

const CHUNK_SIZE_TOKENS = 500;
const CHUNK_OVERLAP_TOKENS = 50;

export function chunkText(rawText: string): TextChunk[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];
  return chunkSingleText(trimmed).map((c, i) => ({ ...c, chunkIndex: i }));
}

// Dùng cho PDF khi splitPdfPagesByMarker() tách được ranh giới trang: chunk TỪNG TRANG riêng (dùng
// lại đúng logic heading-or-sliding-window của chunkText(), không viết lại) rồi gắn pageNumber đúng
// của trang đó, chunkIndex vẫn tăng liên tục xuyên suốt cả document (không reset về 0 mỗi trang) —
// giữ đúng ý nghĩa "thứ tự chunk trong document" như trước đây.
export function chunkPagedText(pages: PdfPageSegment[]): TextChunk[] {
  const chunks: TextChunk[] = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const trimmed = page.text.trim();
    if (!trimmed) continue; // trang trống (vd trang bìa, trang chỉ có ảnh) -> không tạo chunk rỗng
    for (const c of chunkSingleText(trimmed)) {
      chunks.push({
        ...c,
        chunkIndex: chunkIndex++,
        pageNumber: page.pageNumber,
      });
    }
  }
  return chunks;
}

// XLSX: gom các HÀNG liền nhau thành chunk (không cắt giữa hàng), LẶP LẠI hàng tiêu đề ở đầu mỗi chunk để embedding và
// LLM hiểu cột nào là gì ("700 | 420" vô nghĩa nếu thiếu "Doanh thu | Chi phí"). headingContext cho FE "nhảy đúng chỗ":
// `Sheet "Tên" · hàng 2–8`. Hàng đầu tiên của sheet được coi là tiêu đề. chunkIndex tăng liên tục xuyên các sheet.
export function chunkSpreadsheet(sheets: SpreadsheetSheet[]): TextChunk[] {
  const chunks: TextChunk[] = [];
  let chunkIndex = 0;
  const push = (content: string, headingContext: string) =>
    chunks.push({ content, headingContext, chunkIndex: chunkIndex++ });

  for (const sheet of sheets) {
    const [header, ...dataRows] = sheet.rows;
    if (!header) continue;

    const prefix = `[Sheet: ${sheet.name}]`;
    const headerLine = header.cells.join(' | ');
    const base = `${prefix}\n${headerLine}`;
    const baseTokens = encoding.encode(base).length;
    const label = (from: number, to: number) =>
      `Sheet "${sheet.name}" · ${from === to ? `hàng ${from}` : `hàng ${from}–${to}`}`;

    if (dataRows.length === 0) {
      push(base, label(header.rowNumber, header.rowNumber));
      continue;
    }

    let buffer: string[] = [];
    let first = 0;
    let last = 0;
    let tokens = baseTokens;
    const flush = () => {
      if (buffer.length === 0) return;
      push(`${base}\n${buffer.join('\n')}`, label(first, last));
      buffer = [];
      tokens = baseTokens;
    };

    for (const row of dataRows) {
      const line = row.cells.join(' | ');
      const lineTokens = encoding.encode(line).length;

      if (baseTokens + lineTokens > CHUNK_SIZE_TOKENS) {
        // 1 hàng dài hơn cả 1 chunk (ô chứa đoạn văn dài): cắt sliding window riêng, vẫn gắn đúng số hàng.
        flush();
        for (const c of slidingWindowChunk(
          `${prefix}\n${line}`,
          label(row.rowNumber, row.rowNumber),
        )) {
          push(c.content, c.headingContext!);
        }
        continue;
      }
      if (tokens + lineTokens > CHUNK_SIZE_TOKENS) flush();
      if (buffer.length === 0) first = row.rowNumber;
      buffer.push(line);
      last = row.rowNumber;
      tokens += lineTokens;
    }
    flush();
  }
  return chunks;
}

// Phần lõi dùng chung cho cả chunkText() và chunkPagedText() — KHÔNG tự gán chunkIndex (việc này
// khác nhau giữa 2 chỗ gọi: chunkText() đánh số trong phạm vi 1 lần gọi, chunkPagedText() đánh số
// liên tục xuyên nhiều trang), chỉ lo logic chia heading/sliding-window.
function chunkSingleText(
  trimmed: string,
): Array<Omit<TextChunk, 'chunkIndex'>> {
  // Markdown có cấu trúc heading rõ ràng ("# ", "## "...) -> chia theo section trước, fallback
  // sliding window NẾU 1 section vẫn quá dài so với CHUNK_SIZE_TOKENS.
  const hasMarkdownHeadings = /^#{1,6}\s/m.test(trimmed);
  if (hasMarkdownHeadings) {
    return chunkByHeading(trimmed);
  }
  return slidingWindowChunk(trimmed, undefined);
}

function chunkByHeading(text: string): Array<Omit<TextChunk, 'chunkIndex'>> {
  const sections = text
    .split(/(?=^#{1,6}\s)/m)
    .filter((s) => s.trim().length > 0);
  const chunks: Array<Omit<TextChunk, 'chunkIndex'>> = [];

  for (const section of sections) {
    const headingMatch = section.match(/^(#{1,6}\s.+)$/m);
    // turndown (DOCX -> markdown) escape ký tự đặc biệt bằng backslash, vd heading "1. Khái niệm" ra
    // "### 1\. Khái niệm" (tránh bị hiểu thành danh sách đánh số). Bỏ backslash ở headingContext để
    // FE hiển thị đúng chữ gốc; nội dung chunk giữ nguyên, không đụng. File .md thật không có
    // escape kiểu này nên không bị ảnh hưởng.
    const headingContext = headingMatch?.[1]
      ?.trim()
      .replace(/\\([\\`*_{}[\]()#+\-.!])/g, '$1');
    const sectionTokens = encoding.encode(section).length;

    if (sectionTokens <= CHUNK_SIZE_TOKENS) {
      chunks.push({ content: section.trim(), headingContext });
    } else {
      // Section quá dài (vd 1 heading bao nhiều nội dung) -> fallback sliding window NGAY TRONG
      // section đó, vẫn giữ headingContext để biết chunk thuộc phần nào.
      chunks.push(...slidingWindowChunk(section, headingContext));
    }
  }
  return chunks;
}

function slidingWindowChunk(
  text: string,
  headingContext: string | undefined,
): Array<Omit<TextChunk, 'chunkIndex'>> {
  const tokens = encoding.encode(text);
  const chunks: Array<Omit<TextChunk, 'chunkIndex'>> = [];
  let start = 0;

  while (start < tokens.length) {
    const end = Math.min(start + CHUNK_SIZE_TOKENS, tokens.length);
    const slice = tokens.slice(start, end);
    const content = new TextDecoder().decode(encoding.decode(slice));
    if (content.trim().length > 0) {
      chunks.push({ content: content.trim(), headingContext });
    }
    if (end === tokens.length) break;
    start = end - CHUNK_OVERLAP_TOKENS; // overlap 50 token với chunk kế tiếp
  }
  return chunks;
}
