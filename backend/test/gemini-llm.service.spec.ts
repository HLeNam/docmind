// 2 nhóm test tách biệt:
// 1. parseSseTextDeltas() — test TRỰC TIẾP logic parse buffer/newline bằng ReadableStream thật
//    (Web Streams API, có sẵn global ở Node 18+, không cần mock) — không cần mock fetch chỉ để test
//    phần này, dễ kiểm tra case "1 dòng data bị cắt làm 2 chunk network" (lý do tách hàm riêng).
// 2. GeminiLlmService.streamChat() — mock global.fetch, chỉ kiểm tra request shape (role mapping,
//    systemInstruction) + lỗi khi response không ok. Dùng lại parseSseTextDeltas thật (không mock),
//    đã test riêng ở nhóm 1 nên không cần test lại logic parse ở đây.
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { GeminiLlmService } from '../src/chat/llm/gemini-llm.service.js';
import { parseSseTextDeltas } from '../src/chat/llm/gemini-llm.service.js';

function sseStreamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i]));
        i++;
      } else {
        controller.close();
      }
    },
  });
}

async function collect(gen: AsyncGenerator<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const piece of gen) out.push(piece);
  return out;
}

function sseEvent(text: string): string {
  return `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`;
}

describe('parseSseTextDeltas', () => {
  it('parses a single SSE event in a single chunk', async () => {
    const stream = sseStreamFromChunks([sseEvent('Xin chào')]);
    expect(await collect(parseSseTextDeltas(stream))).toEqual(['Xin chào']);
  });

  it('parses multiple consecutive SSE events', async () => {
    const stream = sseStreamFromChunks([
      sseEvent('Xin'),
      sseEvent(' chào'),
      sseEvent(' bạn'),
    ]);
    expect(await collect(parseSseTextDeltas(stream))).toEqual([
      'Xin',
      ' chào',
      ' bạn',
    ]);
  });

  it('correctly parses data line split across two network chunks', async () => {
    const full = sseEvent('nội dung bị cắt giữa chừng');
    const cutPoint = Math.floor(full.length / 2);
    const stream = sseStreamFromChunks([
      full.slice(0, cutPoint),
      full.slice(cutPoint),
    ]);
    expect(await collect(parseSseTextDeltas(stream))).toEqual([
      'nội dung bị cắt giữa chừng',
    ]);
  });

  it('ignores non-data lines such as empty lines and SSE comments', async () => {
    const stream = sseStreamFromChunks([
      ':  keep-alive comment\n\n',
      sseEvent('text thật'),
    ]);
    expect(await collect(parseSseTextDeltas(stream))).toEqual(['text thật']);
  });

  it('ignores invalid JSON event without interrupting the stream', async () => {
    const stream = sseStreamFromChunks([
      'data: {không phải json hợp lệ\n\n',
      sseEvent('event sau vẫn OK'),
    ]);
    expect(await collect(parseSseTextDeltas(stream))).toEqual([
      'event sau vẫn OK',
    ]);
  });

  it('does not yield or throw when event has no text', async () => {
    const stream = sseStreamFromChunks([
      'data: {"candidates":[{"finishReason":"STOP"}]}\n\n',
    ]);
    expect(await collect(parseSseTextDeltas(stream))).toEqual([]);
  });
});

function buildConfigService(): ConfigService {
  const values: Record<string, string> = {
    GEMINI_API_KEY: 'gemini-test-key',
    GEMINI_CHAT_MODEL: 'gemini-2.0-flash',
  };
  return {
    getOrThrow: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('GeminiLlmService.streamChat', () => {
  let service: GeminiLlmService;
  let fetchMock: Mock;

  beforeEach(() => {
    service = new GeminiLlmService(buildConfigService());
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('sends correct URL, model, and headers, maps user and assistant roles to user and model, and filters out system role', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      body: sseStreamFromChunks([sseEvent('ok')]),
    });

    await collect(
      service.streamChat({
        systemPrompt: 'Bạn là trợ lý DocMind',
        messages: [
          { role: 'system', content: 'sẽ bị lọc khỏi contents' },
          { role: 'user', content: 'câu hỏi 1' },
          { role: 'assistant', content: 'trả lời 1' },
          { role: 'user', content: 'câu hỏi 2' },
        ],
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-goog-api-key': 'gemini-test-key',
        }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.systemInstruction).toEqual({
      parts: [{ text: 'Bạn là trợ lý DocMind' }],
    });
    expect(body.contents).toEqual([
      { role: 'user', parts: [{ text: 'câu hỏi 1' }] },
      { role: 'model', parts: [{ text: 'trả lời 1' }] },
      { role: 'user', parts: [{ text: 'câu hỏi 2' }] },
    ]);
  });

  it('does not send systemInstruction when systemPrompt is omitted', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      body: sseStreamFromChunks([sseEvent('ok')]),
    });

    await collect(
      service.streamChat({ messages: [{ role: 'user', content: 'hi' }] }),
    );

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.systemInstruction).toBeUndefined();
  });

  it('throws Error with status and original body when response is not ok', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      body: null,
      text: async () => 'Rate limit exceeded',
    });

    await expect(
      collect(
        service.streamChat({ messages: [{ role: 'user', content: 'x' }] }),
      ),
    ).rejects.toThrow(/429/);
  });

  it('yields text deltas in the exact order received', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      body: sseStreamFromChunks([
        sseEvent('Xin'),
        sseEvent(' chào'),
        sseEvent(' bạn'),
      ]),
    });

    const result = await collect(
      service.streamChat({ messages: [{ role: 'user', content: 'hi' }] }),
    );
    expect(result).toEqual(['Xin', ' chào', ' bạn']);
  });
});

describe('Gemini usageMetadata -> onUsage', () => {
  const usageEvent = (usage: Record<string, number>, text = '') =>
    `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }], usageMetadata: usage })}\n\n`;

  it('reports tokens once when stream ends using the last usageMetadata, where output = total - prompt', async () => {
    const onUsage = vi.fn();
    const stream = sseStreamFromChunks([
      usageEvent(
        {
          promptTokenCount: 100,
          candidatesTokenCount: 2,
          totalTokenCount: 102,
        },
        'Xin',
      ),
      usageEvent(
        {
          promptTokenCount: 100,
          candidatesTokenCount: 10,
          thoughtsTokenCount: 40,
          totalTokenCount: 150,
        },
        ' chào',
      ),
    ]);

    expect(await collect(parseSseTextDeltas(stream, onUsage))).toEqual([
      'Xin',
      ' chào',
    ]);

    expect(onUsage).toHaveBeenCalledTimes(1);
    expect(onUsage).toHaveBeenCalledWith({
      inputTokens: 100,
      outputTokens: 50,
    });
  });

  it('calculates output as candidates + thoughts when totalTokenCount is undefined', async () => {
    const onUsage = vi.fn();
    await collect(
      parseSseTextDeltas(
        sseStreamFromChunks([
          usageEvent(
            {
              promptTokenCount: 10,
              candidatesTokenCount: 5,
              thoughtsTokenCount: 3,
            },
            'a',
          ),
        ]),
        onUsage,
      ),
    );
    expect(onUsage).toHaveBeenCalledWith({ inputTokens: 10, outputTokens: 8 });
  });

  it('does not call onUsage when provider does not return usageMetadata', async () => {
    const onUsage = vi.fn();
    await collect(
      parseSseTextDeltas(sseStreamFromChunks([sseEvent('ok')]), onUsage),
    );
    expect(onUsage).not.toHaveBeenCalled();
  });

  it('passes model name to onUsage callback', async () => {
    const onUsage = vi.fn();
    const service = new GeminiLlmService(buildConfigService());
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: sseStreamFromChunks([
        usageEvent({ promptTokenCount: 7, totalTokenCount: 9 }, 'x'),
      ]),
    }) as unknown as typeof fetch;

    await collect(
      service.streamChat({
        messages: [{ role: 'user', content: 'hi' }],
        onUsage,
      }),
    );

    expect(onUsage).toHaveBeenCalledWith({
      inputTokens: 7,
      outputTokens: 2,
      model: 'gemini-2.0-flash',
    });
  });
});
