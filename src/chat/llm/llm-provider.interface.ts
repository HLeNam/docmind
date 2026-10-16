// src/chat/llm/llm-provider.interface.ts
//
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

export interface StreamChatParams {
  // Tách riêng systemPrompt thay vì nhét vào messages[0] với role 'system' — nhiều provider (Gemini)
  // có field riêng cho system instruction, không coi nó như 1 message trong hội thoại.
  systemPrompt?: string;
  messages: ChatMessage[];
}

export interface LlmProvider {
  streamChat(params: StreamChatParams): AsyncGenerator<string>;
}

export const LLM_PROVIDER_TOKEN = Symbol('LLM_PROVIDER_TOKEN');
