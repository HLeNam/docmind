// Dựng lịch sử hội thoại từ các tin trong 1 thread Slack (conversations.replies) — Slack là nguồn dữ liệu
// duy nhất, DocMind không lưu thêm gì (không cần bảng mới, không giữ nội dung chat của khách).
//
// Chỉ những tin thuộc "cuộc hội thoại với bot" mới được tính:
//   - tin của bot            -> lượt TRỢ LÝ (câu trả lời) — trừ tin báo lỗi
//   - tin của bot dạng "*<@U> hỏi:*\n> ..." (/ask đăng lại câu hỏi) -> lượt NGƯỜI DÙNG
//   - tin người dùng có @mention bot -> lượt NGƯỜI DÙNG
//   - người dùng chat với nhau trong thread (không mention bot) -> BỎ QUA
import type { ChatMessage } from '../chat/llm/llm-provider.interface.js';
import type { SlackThreadMessage } from './slack-api.client.js';
import { extractQuestion, unescapeSlackText } from './slack-text.util.js';

export const THREAD_HISTORY_MAX_MESSAGES = 6; // 3 cặp hỏi–đáp gần nhất
export const THREAD_HISTORY_MAX_CHARS = 1500; // mỗi lượt, tránh prompt phình

// "*<@U123> hỏi:*\n> dòng 1\n> dòng 2" — định dạng SlackCommandsService đăng lại câu hỏi của /ask.
const ASK_ECHO = /^\*<@[A-Z0-9]+> hỏi:\*\n/;

/** So sánh ts của Slack ("1700000000.000100", luôn 6 chữ số phần thập phân) mà không mất độ chính xác. */
function tsValue(ts: string): bigint {
  return BigInt(ts.replace('.', ''));
}

/** Lấy nội dung câu trả lời đầy đủ từ blocks (text fallback bị cắt 300 ký tự), không có thì dùng text. */
function answerText(msg: SlackThreadMessage): string {
  const sections: string[] = [];
  for (const block of msg.blocks ?? []) {
    const b = block as { type?: string; text?: { text?: string } };
    if (b.type === 'divider') break; // sau divider là khối "Nguồn", không phải nội dung trả lời
    if (b.type === 'section' && typeof b.text?.text === 'string')
      sections.push(b.text.text);
  }
  return unescapeSlackText(
    (sections.length > 0 ? sections.join('\n') : (msg.text ?? '')).trim(),
  );
}

function clip(text: string): string {
  return text.length > THREAD_HISTORY_MAX_CHARS
    ? `${text.slice(0, THREAD_HISTORY_MAX_CHARS)}…`
    : text;
}

export function buildThreadHistory(
  messages: SlackThreadMessage[],
  opts: { botUserId?: string; currentTs: string; maxMessages?: number },
): ChatMessage[] {
  const { botUserId, currentTs } = opts;
  const limit = opts.maxMessages ?? THREAD_HISTORY_MAX_MESSAGES;
  const current = tsValue(currentTs);

  const isBot = (m: SlackThreadMessage) =>
    botUserId ? m.user === botUserId : Boolean(m.bot_id);
  const mentionsBot = (text: string) =>
    botUserId ? text.includes(`<@${botUserId}`) : /^\s*<@[A-Z0-9]+/.test(text);

  const history: ChatMessage[] = [];
  const ordered = [...messages].sort((a, b) =>
    tsValue(a.ts) < tsValue(b.ts) ? -1 : 1,
  );

  for (const msg of ordered) {
    if (tsValue(msg.ts) >= current) break; // tin hiện tại và mọi thứ sau nó không phải "lịch sử"
    const rawText = msg.text ?? '';

    if (isBot(msg)) {
      if (ASK_ECHO.test(rawText)) {
        const question = rawText
          .replace(ASK_ECHO, '')
          .split('\n')
          .map((line) => line.replace(/^>\s?/, ''))
          .join('\n');
        const content = unescapeSlackText(question).trim();
        if (content) history.push({ role: 'user', content: clip(content) });
        continue;
      }
      const content = answerText(msg);
      if (!content || content.includes('DocMind gặp lỗi')) continue;
      history.push({ role: 'assistant', content: clip(content) });
      continue;
    }

    if (mentionsBot(rawText)) {
      const content = extractQuestion(rawText, botUserId);
      if (content) history.push({ role: 'user', content: clip(content) });
    }
  }

  return history.slice(-limit);
}
