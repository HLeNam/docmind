// Rút lịch sử hội thoại đã lưu (Message) thành đầu vào gọn cho QuestionCondenserService: chỉ vài tin gần nhất,
// mỗi tin cắt ngắn — câu trả lời của trợ lý có thể dài hàng nghìn ký tự, không cần nguyên văn để hiểu "loại thứ hai"
// là gì. Giống giới hạn của luồng Slack (slack-thread-history.util.ts).
import type { ChatMessage } from './llm/llm-provider.interface.js';

export const CONDENSER_HISTORY_MAX_MESSAGES = 6;
export const CONDENSER_HISTORY_MAX_CHARS = 1500;

export function buildCondenserHistory(
  messages: { role: 'USER' | 'ASSISTANT'; content: string }[],
  maxMessages: number = CONDENSER_HISTORY_MAX_MESSAGES,
  maxChars: number = CONDENSER_HISTORY_MAX_CHARS,
): ChatMessage[] {
  return messages.slice(-maxMessages).map((m) => ({
    role: m.role === 'USER' ? 'user' : 'assistant',
    content: m.content.slice(0, maxChars),
  }));
}
