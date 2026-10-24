// Tiêu đề mặc định của hội thoại = câu hỏi đầu tiên (gọn lại), giống ChatGPT/Claude.ai — để sidebar lịch sử chat
// có chữ để hiển thị mà không tốn thêm lượt LLM. Người dùng đổi tên sau bằng PATCH /chat/conversations/:id.
export const CONVERSATION_TITLE_MAX_CHARS = 60;

/** Gộp khoảng trắng/xuống dòng, cắt tối đa `max` ký tự (kể cả dấu …). Rỗng -> null. */
export function deriveConversationTitle(
  content: string,
  max: number = CONVERSATION_TITLE_MAX_CHARS,
): string | null {
  const flat = content.replace(/\s+/g, ' ').trim();
  if (!flat) return null;
  const chars = Array.from(flat); // đếm theo ký tự Unicode, không cắt đôi cặp surrogate (emoji)
  if (chars.length <= max) return flat;
  return `${chars
    .slice(0, max - 1)
    .join('')
    .trimEnd()}…`;
}
