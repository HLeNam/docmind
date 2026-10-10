// test/gemini-embedding.service.spec.ts
//
// Mock global.fetch — không gọi Gemini thật. Xác nhận request đúng shape (đặc biệt
// `outputDimensionality` và `taskType`) và xử lý đúng response/lỗi. KHÔNG xác nhận được qua unit
// test việc `outputDimensionality` có thực sự được Google tôn trọng ở batchEmbedContents hay
// không (xem cảnh báo trong gemini-embedding.service.ts) — phải tự gọi thật 1 lần và kiểm tra độ
// dài vector trả về.

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { GeminiEmbeddingService } from '../src/documents/processing/gemini-embedding.service.js';

function buildConfigService(): ConfigService {
  const values: Record<string, string | number> = {
    GEMINI_API_KEY: 'test-gemini-key',
    GEMINI_EMBEDDING_MODEL: 'gemini-embedding-001',
    GEMINI_EMBEDDING_DIMENSIONS: 1536,
  };
  return {
    getOrThrow: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('GeminiEmbeddingService', () => {
  let service: GeminiEmbeddingService;
  let fetchMock: Mock;

  beforeEach(() => {
    service = new GeminiEmbeddingService(buildConfigService());
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('should call the correct batchEmbedContents URL with x-goog-api-key header and 1 request item per text', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        embeddings: [{ values: [0.1, 0.2] }, { values: [0.3, 0.4] }],
      }),
    });

    const result = await service.embedBatch(['chunk A', 'chunk B']);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-goog-api-key': 'test-gemini-key',
        }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.requests).toHaveLength(2);
    expect(body.requests[0]).toEqual({
      model: 'models/gemini-embedding-001',
      content: { parts: [{ text: 'chunk A' }] },
      taskType: 'RETRIEVAL_DOCUMENT',
      outputDimensionality: 1536,
    });
    expect(result).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });

  it('should extract the correct values field from each embeddings element and maintain the returned order', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        embeddings: [
          { values: [1, 1] },
          { values: [2, 2] },
          { values: [3, 3] },
        ],
      }),
    });

    const result = await service.embedBatch(['a', 'b', 'c']);
    expect(result).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
  });

  it('should throw an Error with the original status and body when Gemini returns an error (e.g. invalid API key, quota exceeded)', async () => {
    // mockResolvedValue (không phải Once): test gọi embedBatch() 2 lần để assert riêng từng phần
    // của message lỗi.
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Resource has been exhausted',
    });

    await expect(service.embedBatch(['x'])).rejects.toThrow(/429/);
    await expect(service.embedBatch(['x'])).rejects.toThrow(
      /Resource has been exhausted/,
    );
  });
});
