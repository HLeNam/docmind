// src/documents/processing/chunk-text.util.ts
//
// Dùng tiktoken (cùng tokenizer cl100k_base mà OpenAI embedding model dùng) để đếm token chính
// xác, thay vì đếm theo từ (ước lượng sai lệch nhiều với tiếng Việt do dấu).
import { get_encoding } from 'tiktoken';

const encoding = get_encoding('cl100k_base');

export interface TextChunk {
  content: string;
  chunkIndex: number;
  headingContext?: string;
}

const CHUNK_SIZE_TOKENS = 500;
const CHUNK_OVERLAP_TOKENS = 50;

export function chunkText(rawText: string): TextChunk[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // Markdown có cấu trúc heading rõ ràng ("# ", "## "...) -> chia theo section trước, fallback
  // sliding window NẾU 1 section vẫn quá dài so với CHUNK_SIZE_TOKENS.
  const hasMarkdownHeadings = /^#{1,6}\s/m.test(trimmed);
  if (hasMarkdownHeadings) {
    return chunkByHeading(trimmed);
  }
  return slidingWindowChunk(trimmed, undefined);
}

function chunkByHeading(text: string): TextChunk[] {
  const sections = text
    .split(/(?=^#{1,6}\s)/m)
    .filter((s) => s.trim().length > 0);
  const chunks: TextChunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const headingMatch = section.match(/^(#{1,6}\s.+)$/m);
    const headingContext = headingMatch?.[1]?.trim();
    const sectionTokens = encoding.encode(section).length;

    if (sectionTokens <= CHUNK_SIZE_TOKENS) {
      chunks.push({
        content: section.trim(),
        chunkIndex: chunkIndex++,
        headingContext,
      });
    } else {
      // Section quá dài (vd 1 heading bao nhiều nội dung) -> fallback sliding window NGAY TRONG
      // section đó, vẫn giữ headingContext để biết chunk thuộc phần nào.
      const subChunks = slidingWindowChunk(section, headingContext);
      for (const sub of subChunks)
        chunks.push({ ...sub, chunkIndex: chunkIndex++ });
    }
  }
  return chunks;
}

function slidingWindowChunk(
  text: string,
  headingContext: string | undefined,
): TextChunk[] {
  const tokens = encoding.encode(text);
  const chunks: TextChunk[] = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < tokens.length) {
    const end = Math.min(start + CHUNK_SIZE_TOKENS, tokens.length);
    const slice = tokens.slice(start, end);
    const content = new TextDecoder().decode(encoding.decode(slice));
    if (content.trim().length > 0) {
      chunks.push({
        content: content.trim(),
        chunkIndex: chunkIndex++,
        headingContext,
      });
    }
    if (end === tokens.length) break;
    start = end - CHUNK_OVERLAP_TOKENS; // overlap 50 token với chunk kế tiếp
  }
  return chunks;
}
