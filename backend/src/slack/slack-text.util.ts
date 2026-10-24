// Xử lý text thô từ Slack, dùng chung cho SlackEventsService và dựng lịch sử thread.

/**
 * Lấy câu hỏi từ text của sự kiện: bỏ mention bot, giải mã ký tự Slack đã escape (&amp; &lt; &gt;).
 * Không có botUserId thì chỉ bỏ các mention nằm ở ĐẦU câu.
 */
export function extractQuestion(rawText: string, botUserId?: string): string {
  let text = rawText;
  if (botUserId && /^[A-Z0-9]+$/.test(botUserId)) {
    text = text.replace(new RegExp(`<@${botUserId}(\\|[^>]*)?>`, 'g'), ' ');
  } else {
    text = text.replace(/^(\s*<@[A-Z0-9]+(\|[^>]*)?>)+/, ' ');
  }
  // Giải mã SAU khi bỏ mention: "&lt;@U1&gt;" người dùng gõ chữ thường chỉ là văn bản, không phải mention.
  text = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  return text.replace(/[ \t]+/g, ' ').trim();
}

/** Giải mã ký tự Slack đã escape (dùng cho nội dung đọc lại từ tin nhắn của bot). */
export function unescapeSlackText(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
