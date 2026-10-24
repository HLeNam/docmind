// Cửa sổ lịch sử gửi cho LLM mỗi lượt chat: N tin GẦN NHẤT. Phần cũ hơn được ConversationSummarizerService
// gộp thành bản tóm tắt (Conversation.summary) thay vì bị "quên" hẳn.
export const HISTORY_WINDOW = 10;
