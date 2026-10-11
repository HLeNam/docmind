// src/chat/llm/gemini-llm.service.ts
//
// Provider chính được chọn dùng — cùng lý do đã chốt cho Embedding module (chưa có ngân sách gọi
// API trả phí, Gemini có free tier): dùng REST endpoint streamGenerateContent với alt=sse để nhận
// response dạng Server-Sent Events, parse thủ công từng event (fetch() chuẩn không có helper SSE
// sẵn như EventSource — EventSource cũng không hỗ trợ custom header/POST body cần thiết ở đây).
//
// Model dùng cho CHAT khác với model dùng cho EMBEDDING (GEMINI_EMBEDDING_MODEL ở
// EmbeddingModule) — 2 biến env riêng biệt, đừng nhầm lẫn. GEMINI_API_KEY dùng CHUNG 1 key cho cả 2
// (cùng 1 project trên Google AI Studio), không cần tạo key riêng.
//
// ⚠️ CHƯA XÁC NHẬN bằng request thật — khác với GeminiEmbeddingService (đã confirmed qua test script
// của bạn). Tên model mặc định (`GEMINI_CHAT_MODEL` default bên dưới) có thể đã đổi tính tới lúc bạn
// đọc code này — vào https://aistudio.google.com/ kiểm tra model free-tier hiện có trước khi chạy
// thử, đổi qua env nếu cần, KHÔNG sửa cứng trong code.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ChatMessage,
  LlmProvider,
  StreamChatParams,
} from './llm-provider.interface.js';

interface GeminiStreamChunk {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

@Injectable()
export class GeminiLlmService implements LlmProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(configService: ConfigService) {
    this.apiKey = configService.getOrThrow<string>('GEMINI_API_KEY', {
      infer: true,
    });
    this.model = configService.getOrThrow<string>('GEMINI_CHAT_MODEL', {
      infer: true,
    });
  }

  async *streamChat(params: StreamChatParams): AsyncGenerator<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?alt=sse`;

    const body: Record<string, unknown> = {
      contents: params.messages
        .filter((m) => m.role !== 'system')
        .map(toGeminiContent),
    };
    if (params.systemPrompt) {
      // systemInstruction là field RIÊNG của Gemini, không phải 1 phần tử trong mảng contents —
      // khác hẳn convention OpenAI (role: 'system' nằm chung mảng messages).
      body.systemInstruction = { parts: [{ text: params.systemPrompt }] };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Gemini chat request failed (${res.status}): ${errBody}`);
    }

    yield* parseSseTextDeltas(res.body);
  }
}

function toGeminiContent(message: ChatMessage): {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
} {
  return {
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  };
}

// Parser SSE thủ công — tách riêng thành hàm độc lập (không phải method) để test dễ hơn (không cần
// mock toàn bộ fetch chỉ để test logic parse buffer/newline). Nhận ReadableStream<Uint8Array> (chuẩn
// Web Streams API mà fetch() trả về ở cả runtime Node 18+ lẫn browser), yield từng đoạn text delta.
export async function* parseSseTextDeltas(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE: mỗi event là 1 dòng "data: {...json...}", các event cách nhau bằng dòng trống.
      // Dòng CUỐI trong buffer có thể chưa đủ (chunk network bị cắt giữa chừng 1 dòng) -> giữ lại
      // chờ gộp với chunk kế tiếp, chỉ xử lý các dòng đã chắc chắn trọn vẹn.
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice('data: '.length).trim();
        if (!jsonStr) continue;

        let parsed: GeminiStreamChunk;
        try {
          parsed = JSON.parse(jsonStr) as GeminiStreamChunk;
        } catch {
          // 1 event lỗi JSON (hiếm, vd bị cắt sai chỗ dù đã qua logic buffer ở trên) -> bỏ qua event
          // đó, không làm chết cả stream — người dùng mất 1 mẩu text nhỏ còn hơn mất toàn bộ câu trả lời.
          continue;
        }

        const text =
          parsed.candidates?.[0]?.content?.parts
            ?.map((p) => p.text ?? '')
            .join('') ?? '';
        if (text) yield text;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
