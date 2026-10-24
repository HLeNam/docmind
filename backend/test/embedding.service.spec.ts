// test/embedding.service.spec.ts
//
// Mock global.fetch — không gọi OpenAI thật. Chỉ xác nhận OpenAiEmbeddingService gửi đúng
// request (model/input/Authorization header) và xử lý đúng response/lỗi, không test chất lượng
// embedding thật (việc đó không kiểm bằng unit test được).

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { OpenAiEmbeddingService } from '../src/documents/processing/embedding.service.js';

function buildConfigService(): ConfigService {
  const values: Record<string, string> = {
    OPENAI_API_KEY: 'sk-test-key',
    EMBEDDING_MODEL: 'text-embedding-3-small',
  };
  return {
    getOrThrow: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('OpenAiEmbeddingService', () => {
  let service: OpenAiEmbeddingService;
  let fetchMock: Mock;

  beforeEach(() => {
    service = new OpenAiEmbeddingService(buildConfigService());
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('should send the correct model, input, and Authorization header to the OpenAI embeddings endpoint', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2], index: 0 }] }),
    });

    await service.embedBatch(['hello world']);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer sk-test-key',
        }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body).toEqual({
      model: 'text-embedding-3-small',
      input: ['hello world'],
    });
  });

  it('should re-sort the results to match the original input order if the API returns them out of order', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { embedding: [9, 9], index: 1 }, // cố tình trả lộn thứ tự
          { embedding: [1, 1], index: 0 },
        ],
      }),
    });

    const result = await service.embedBatch(['chunk A', 'chunk B']);

    // kết quả[0] phải tương ứng input[0] ('chunk A' -> index 0 -> [1,1]), không phải thứ tự API trả về.
    expect(result).toEqual([
      [1, 1],
      [9, 9],
    ]);
  });

  it('should throw an Error containing the original status and body when OpenAI returns an error (e.g., 401/429) for easier debugging', async () => {
    // mockResolvedValue (không phải Once): test gọi embedBatch() 2 lần bên dưới để assert riêng
    // từng phần của message lỗi, cả 2 lần đều cần fetch trả cùng 1 response lỗi này.
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'Rate limit exceeded',
    });

    await expect(service.embedBatch(['x'])).rejects.toThrow(/429/);
    await expect(service.embedBatch(['x'])).rejects.toThrow(
      /Rate limit exceeded/,
    );
  });
});
