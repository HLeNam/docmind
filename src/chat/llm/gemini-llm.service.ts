// Provider chính được chọn dùng — cùng lý do đã chốt cho Embedding module (chưa có ngân sách gọi
// API trả phí, Gemini có free tier): dùng REST endpoint streamGenerateContent với alt=sse để nhận
// response dạng Server-Sent Events, parse thủ công từng event (fetch() chuẩn không có helper SSE
// sẵn như EventSource — EventSource cũng không hỗ trợ custom header/POST body cần thiết ở đây).
//
// Model dùng cho CHAT khác với model dùng cho EMBEDDING (GEMINI_EMBEDDING_MODEL ở
// EmbeddingModule) — 2 biến env riêng biệt, đừng nhầm lẫn. GEMINI_API_KEY dùng CHUNG 1 key cho cả 2
// (cùng 1 project trên Google AI Studio), không cần tạo key riêng.
//
// ✅ ĐÃ XÁC NHẬN bằng request thật (10/2026, qua curl -N streaming thật của bạn): response shape
// `candidates[0].content.parts[].text` đúng như code xử lý, stream trả về nhiều event `delta` rời
// rạc đúng thứ tự, câu trả lời trích dẫn đúng theo citation [1] trong systemPrompt. Model mặc định
// `GEMINI_CHAT_MODEL` (bên dưới) đã xác nhận hoạt động — nếu Google đổi tên model free-tier sau này,
// đổi qua env, không cần sửa code.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  ChatMessage,
  LlmProvider,
  LlmUsage,
  StreamChatParams,
} from './llm-provider.interface.js';

interface GeminiStreamChunk {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  // Có ở các chunk cuối (Gemini gửi cộng dồn; lấy giá trị CUỐI CÙNG thấy được).
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
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

    yield* parseSseTextDeltas(
      res.body,
      params.onUsage
        ? (u) => params.onUsage!({ ...u, model: this.model })
        : undefined,
    );
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
  onUsage?: (usage: LlmUsage) => void,
): AsyncGenerator<string> {
  let lastUsage: GeminiStreamChunk['usageMetadata'];
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

        if (parsed.usageMetadata) lastUsage = parsed.usageMetadata;

        const text =
          parsed.candidates?.[0]?.content?.parts
            ?.map((p) => p.text ?? '')
            .join('') ?? '';
        if (text) yield text;
      }
    }

    // Stream kết thúc trọn vẹn -> báo số token. output = total - prompt (gồm cả token "suy nghĩ" mà
    // candidatesTokenCount không tính); thiếu total thì rơi về candidates + thoughts.
    if (onUsage && lastUsage) {
      const input = lastUsage.promptTokenCount ?? 0;
      const output =
        lastUsage.totalTokenCount !== undefined
          ? Math.max(0, lastUsage.totalTokenCount - input)
          : (lastUsage.candidatesTokenCount ?? 0) +
            (lastUsage.thoughtsTokenCount ?? 0);
      onUsage({ inputTokens: input, outputTokens: output });
    }
  } finally {
    reader.releaseLock();
  }
}
