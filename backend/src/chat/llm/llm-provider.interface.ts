// Interface chung cho mọi LLM provider dùng để trả lời chat — cùng pattern provider-agnostic đã
// dùng cho Mail (Phase 1) và Embedding (Worker module): interface + Symbol injection token + factory
// chọn implementation theo env. Đổi provider chỉ đổi 1 biến env, không sửa ChatService.
//
// streamChat() trả AsyncGenerator<string> (từng mẩu text nhỏ, "delta") thay vì Promise<string> trả
// nguyên câu — để ChatController có thể pipe thẳng từng mẩu ra SSE ngay khi provider sinh ra, không
// phải đợi LLM trả lời xong hết mới gửi (trải nghiệm "gõ dần" quen thuộc của chatbot).
export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Số token provider báo cáo cho 1 lần gọi (để ghi UsageLog). */
export interface LlmUsage {
  inputTokens: number;
  /** Gồm cả token "suy nghĩ" nếu model có và tính phí. */
  outputTokens: number;
  model?: string;
}

export interface StreamChatParams {
  // Tách riêng systemPrompt thay vì nhét vào messages[0] với role 'system' — nhiều provider (Gemini)
  // có field riêng cho system instruction, không coi nó như 1 message trong hội thoại.
  systemPrompt?: string;
  messages: ChatMessage[];
  // Gọi ĐÚNG MỘT LẦN khi stream kết thúc thành công, nếu provider có trả thông tin token. Không có/khi lỗi giữa
  // chừng thì không gọi. Callback không được throw (nơi gọi dùng UsageService.record — fire-and-forget).
  onUsage?: (usage: LlmUsage) => void;
}

export interface LlmProvider {
  streamChat(params: StreamChatParams): AsyncGenerator<string>;
}

export const LLM_PROVIDER_TOKEN = Symbol('LLM_PROVIDER_TOKEN');
