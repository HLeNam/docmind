// Chuyển câu trả lời của LLM (Markdown chuẩn) sang "mrkdwn" của Slack và dựng Block Kit.
// Khác biệt chính: Slack dùng *đậm* (1 dấu sao) thay vì **đậm**, không có heading `#`, bullet hiển thị đẹp
// hơn với "•", và PHẢI escape `& < >` (nếu không, `<!channel>` hay `<@U123>` do LLM sinh ra sẽ thành mention thật).

const SECTION_TEXT_LIMIT = 2800; // Slack giới hạn 3000 ký tự / section, chừa biên an toàn
const FALLBACK_CITATION_COUNT = 3;
const NO_ANSWER_TEXT = '(Không có câu trả lời)';

export interface SlackCitation {
  index: number;
  filename: string;
  pageNumber: number | null;
  headingContext: string | null;
}

export function escapeSlackText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escape trước, rồi mới đổi cú pháp Markdown -> mrkdwn (các ký tự đổi không chứa & < >). */
export function markdownToSlackMrkdwn(markdown: string): string {
  return escapeSlackText(markdown)
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*') // heading -> đậm
    .replace(/\*\*(.+?)\*\*/g, '*$1*') // **đậm** -> *đậm*
    .replace(/^(\s*)[*-]\s+/gm, '$1• '); // bullet "* x" / "- x" -> "• x" (sau bước đổi **, "* *x*" vẫn đúng)
}

/**
 * Chỉ hiện những nguồn mà câu trả lời THỰC SỰ trích dẫn ([1], [2]...) — hiện cả 5 nguồn khi chỉ dùng 1
 * thì gây nhiễu. Không trích dẫn số nào (LLM quên, hoặc "không tìm thấy") thì hiện vài nguồn đầu để
 * người dùng vẫn biết đã tham khảo tài liệu nào.
 */
export function selectCitationsToShow(
  answer: string,
  citations: SlackCitation[],
): SlackCitation[] {
  const cited = new Set(
    [...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])),
  );
  const picked = citations.filter((c) => cited.has(c.index));
  return picked.length > 0
    ? picked
    : citations.slice(0, FALLBACK_CITATION_COUNT);
}

function formatCitationLine(c: SlackCitation): string {
  const parts = [`[${c.index}] ${escapeSlackText(c.filename)}`];
  if (c.pageNumber !== null) parts.push(`trang ${c.pageNumber}`);
  if (c.headingContext)
    parts.push(escapeSlackText(c.headingContext.replace(/^#+\s*/, '').trim()));
  return parts.join(' — ');
}

/** Cắt text dài thành nhiều khúc ≤ limit, ưu tiên cắt ở ranh giới đoạn văn. */
function splitIntoChunks(text: string, limit: number): string[] {
  const chunks: string[] = [];
  let current = '';
  for (const paragraph of text.split(/\n{2,}/)) {
    if (paragraph.length > limit) {
      if (current) chunks.push(current);
      current = '';
      for (let i = 0; i < paragraph.length; i += limit)
        chunks.push(paragraph.slice(i, i + limit));
      continue;
    }
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > limit) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function buildAnswerBlocks(
  answer: string,
  citations: SlackCitation[],
): { text: string; blocks: unknown[] } {
  const mrkdwn = markdownToSlackMrkdwn(answer.trim()) || NO_ANSWER_TEXT;

  const blocks: unknown[] = splitIntoChunks(mrkdwn, SECTION_TEXT_LIMIT).map(
    (chunk) => ({
      type: 'section',
      text: { type: 'mrkdwn', text: chunk },
    }),
  );

  const shown = selectCitationsToShow(answer, citations);
  if (shown.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `*Nguồn*\n${shown.map(formatCitationLine).join('\n')}`,
        },
      ],
    });
  }

  // `text` là bản dự phòng cho thông báo đẩy/email khi client không hiển thị blocks.
  return { text: mrkdwn.slice(0, 300), blocks };
}
