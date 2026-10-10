// test/ollama-embedding.service.spec.ts
//
// Mock global.fetch — không cần Ollama thật chạy để unit test. Test tích hợp thật (chạy Ollama
// local, pull model, gọi thật) nên làm thủ công 1 lần sau khi cài đặt, không đưa vào CI (CI không
// có Ollama cài sẵn).

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { OllamaEmbeddingService } from '../src/documents/processing/ollama-embedding.service.js';

function buildConfigService(): ConfigService {
  const values: Record<string, string> = {
    OLLAMA_BASE_URL: 'http://localhost:11434',
    OLLAMA_EMBEDDING_MODEL: 'nomic-embed-text',
  };
  return {
    getOrThrow: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('OllamaEmbeddingService', () => {
  let service: OllamaEmbeddingService;
  let fetchMock: Mock;

  beforeEach(() => {
    service = new OllamaEmbeddingService(buildConfigService());
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('should call the correct /api/embed endpoint with model + input (array for batching) and no Authorization header for local execution', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        embeddings: [
          [0.1, 0.2],
          [0.3, 0.4],
        ],
      }),
    });

    const result = await service.embedBatch(['chunk A', 'chunk B']);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:11434/api/embed',
      expect.objectContaining({ method: 'POST' }),
    );
    const callArgs = fetchMock.mock.calls[0]![1];
    expect(callArgs.headers).not.toHaveProperty('Authorization');
    const body = JSON.parse(callArgs.body);
    expect(body).toEqual({
      model: 'nomic-embed-text',
      input: ['chunk A', 'chunk B'],
    });
    expect(result).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });

  it('should return embeddings in the exact order as the input without needing a sort (unlike OpenAI)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        embeddings: [
          [1, 1],
          [2, 2],
          [3, 3],
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

  it('should throw an Error with a troubleshooting suggestion when Ollama is not running or the model is not pulled', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'model "nomic-embed-text" not found',
    });

    await expect(service.embedBatch(['x'])).rejects.toThrow(
      /ollama pull nomic-embed-text/,
    );
  });
});
