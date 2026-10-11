// test/gemini-llm.service.spec.ts
//
// Mock global.fetch — không gọi Gemini API thật.
// Kiểm tra cấu trúc request (headers, systemInstruction, contents mapping) và parse SSE text deltas.
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { ConfigService } from '@nestjs/config';
import {
  GeminiLlmService,
  parseSseTextDeltas,
} from '../src/chat/llm/gemini-llm.service.js';

function buildConfigService(): ConfigService {
  const values: Record<string, string> = {
    GEMINI_API_KEY: 'test-gemini-key',
    GEMINI_CHAT_MODEL: 'gemini-2.5-flash',
  };
  return {
    getOrThrow: (key: string) => values[key],
  } as unknown as ConfigService;
}

function createStreamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe('GeminiLlmService', () => {
  let service: GeminiLlmService;
  let fetchMock: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GeminiLlmService(buildConfigService());
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('should call streamGenerateContent with correct URL, headers, and body mapping', async () => {
    const ssePayload =
      'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n\n' +
      'data: {"candidates":[{"content":{"parts":[{"text":" world!"}]}}]}\n\n';

    fetchMock.mockResolvedValueOnce({
      ok: true,
      body: createStreamFromChunks([ssePayload]),
    });

    const results: string[] = [];
    for await (const delta of service.streamChat({
      systemPrompt: 'You are an AI assistant',
      messages: [
        { role: 'system', content: 'ignore this message in contents array' },
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello there' },
        { role: 'user', content: 'How are you?' },
      ],
    })) {
      results.push(delta);
    }

    expect(fetchMock).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': 'test-gemini-key',
        },
      }),
    );

    const callBody = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(callBody.systemInstruction).toEqual({
      parts: [{ text: 'You are an AI assistant' }],
    });
    expect(callBody.contents).toEqual([
      { role: 'user', parts: [{ text: 'Hi' }] },
      { role: 'model', parts: [{ text: 'Hello there' }] },
      { role: 'user', parts: [{ text: 'How are you?' }] },
    ]);
    expect(results).toEqual(['Hello', ' world!']);
  });

  it('should omit systemInstruction when systemPrompt is undefined', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      body: createStreamFromChunks([
        'data: {"candidates":[{"content":{"parts":[{"text":"OK"}]}}]}\n\n',
      ]),
    });

    const results: string[] = [];
    for await (const delta of service.streamChat({
      messages: [{ role: 'user', content: 'Ping' }],
    })) {
      results.push(delta);
    }

    const callBody = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(callBody.systemInstruction).toBeUndefined();
    expect(results).toEqual(['OK']);
  });

  it('should throw clear error when response is not ok', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'API key not valid',
    });

    const stream = service.streamChat({
      messages: [{ role: 'user', content: 'Hi' }],
    });

    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of stream) {
        // iterate to trigger fetch
      }
    }).rejects.toThrow('Gemini chat request failed (400): API key not valid');
  });
});

describe('parseSseTextDeltas', () => {
  it('should parse chunks split across network buffers', async () => {
    const chunk1 = 'data: {"candidates":[{"content":{"parts":[{"text":"Hel';
    const chunk2 = 'lo"}]}}]}\n\ndata: {"candidates":[{"content":{"parts":[{"text":" world"}]}}]}\n\n';

    const stream = createStreamFromChunks([chunk1, chunk2]);
    const results: string[] = [];
    for await (const text of parseSseTextDeltas(stream)) {
      results.push(text);
    }

    expect(results).toEqual(['Hello', ' world']);
  });

  it('should ignore malformed JSON lines without breaking the stream', async () => {
    const data =
      'data: {broken json}\n\n' +
      'data: {"candidates":[{"content":{"parts":[{"text":"Valid"}]}}]}\n\n';

    const stream = createStreamFromChunks([data]);
    const results: string[] = [];
    for await (const text of parseSseTextDeltas(stream)) {
      results.push(text);
    }

    expect(results).toEqual(['Valid']);
  });

  it('should ignore lines not starting with data:', async () => {
    const data =
      ': keep-alive\n\n' +
      'event: message\n\n' +
      'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]}}]}\n\n';

    const stream = createStreamFromChunks([data]);
    const results: string[] = [];
    for await (const text of parseSseTextDeltas(stream)) {
      results.push(text);
    }

    expect(results).toEqual(['Hello']);
  });
});
