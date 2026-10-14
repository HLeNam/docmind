// Mock global.fetch — không gọi Jina thật. Xác nhận request đúng shape (model v4, dimensions,
// task) và response (schema giống OpenAI: data[{embedding, index}]) được sort/parse đúng.

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { JinaEmbeddingService } from '../src/documents/processing/jina-embedding.service.js';

function buildConfigService(): ConfigService {
  const values: Record<string, string | number> = {
    JINA_API_KEY: 'jina-test-key',
    JINA_EMBEDDING_MODEL: 'jina-embeddings-v4',
    JINA_EMBEDDING_DIMENSIONS: 1536,
  };
  return {
    getOrThrow: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('JinaEmbeddingService', () => {
  let service: JinaEmbeddingService;
  let fetchMock: Mock;

  beforeEach(() => {
    service = new JinaEmbeddingService(buildConfigService());
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('sends correct model, dimensions, task, and Authorization to /v1/embeddings', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.1, 0.2], index: 0 }] }),
    });

    await service.embedBatch(['hello world']);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.jina.ai/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer jina-test-key',
        }),
      }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body).toEqual({
      model: 'jina-embeddings-v4',
      input: ['hello world'],
      dimensions: 1536,
      normalized: true,
      embedding_type: 'float',
      task: 'retrieval.passage',
    });
  });

  it('sorts response items by index to match original input ordering when unordered', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { embedding: [9, 9], index: 1 },
          { embedding: [1, 1], index: 0 },
        ],
      }),
    });

    const result = await service.embedBatch(['chunk A', 'chunk B']);
    expect(result).toEqual([
      [1, 1],
      [9, 9],
    ]);
  });

  it("uses retrieval.query task when mode is query", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ embedding: [0.5, 0.6], index: 0 }] }),
    });

    await service.embedBatch(['câu hỏi user'], 'query');

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.task).toBe('retrieval.query');
  });

  it('throws descriptive Error containing status and response body when Jina returns an error', async () => {
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
