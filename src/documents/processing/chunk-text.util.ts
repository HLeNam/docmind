// Dùng tiktoken (cùng tokenizer cl100k_base mà OpenAI embedding model dùng) để đếm token chính
// xác, thay vì đếm theo từ (ước lượng sai lệch nhiều với tiếng Việt do dấu).
import { get_encoding } from 'tiktoken';
import type { PdfPageSegment } from './extract-text.util.js';

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
    const headingContext = headingMatch?.[1]?.trim();
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
