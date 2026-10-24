// Số token embedding: provider nào báo thật thì lấy số thật (Jina/Ollama/OpenAI), Gemini không báo -> ước lượng.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JinaEmbeddingService } from '../src/documents/processing/jina-embedding.service.js';
import { OllamaEmbeddingService } from '../src/documents/processing/ollama-embedding.service.js';
import { GeminiEmbeddingService } from '../src/documents/processing/gemini-embedding.service.js';
import {
  ESTIMATED_CHARS_PER_TOKEN,
  UsageService,
  estimateTokens,
} from '../src/usage/usage.service.js';

const realFetch = global.fetch;
afterEach(() => {
  global.fetch = realFetch;
});

function mockFetchJson(body: unknown) {
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => body,
    text: async () => '',
  })) as unknown as typeof fetch;
}

const config = (values: Record<string, unknown>) =>
  ({ getOrThrow: (k: string) => values[k] }) as any;

describe('embedding providers report token usage via onUsage', () => {
  it('reports usage.total_tokens for Jina provider', async () => {
    mockFetchJson({
      data: [{ embedding: [1, 2], index: 0 }],
      usage: { total_tokens: 17 },
    });
    const svc = new JinaEmbeddingService(
      config({
        JINA_API_KEY: 'k',
        JINA_EMBEDDING_MODEL: 'm',
        JINA_EMBEDDING_DIMENSIONS: 2,
      }),
    );
    const onUsage = vi.fn();
    const out = await svc.embedBatch(['xin chào'], 'document', onUsage);
    expect(out).toEqual([[1, 2]]);
    expect(onUsage).toHaveBeenCalledWith(17);
  });

  it('does not invoke onUsage when Jina response omits usage', async () => {
    mockFetchJson({ data: [{ embedding: [1, 2], index: 0 }] });
    const svc = new JinaEmbeddingService(
      config({
        JINA_API_KEY: 'k',
        JINA_EMBEDDING_MODEL: 'm',
        JINA_EMBEDDING_DIMENSIONS: 2,
      }),
    );
    const onUsage = vi.fn();
    await svc.embedBatch(['a'], 'query', onUsage);
    expect(onUsage).not.toHaveBeenCalled();
  });

  it('reports prompt_eval_count for Ollama provider', async () => {
    mockFetchJson({ embeddings: [[0.1, 0.2]], prompt_eval_count: 9 });
    const svc = new OllamaEmbeddingService(
      config({
        OLLAMA_BASE_URL: 'http://localhost:11434',
        OLLAMA_EMBEDDING_MODEL: 'nomic',
      }),
    );
    const onUsage = vi.fn();
    await svc.embedBatch(['a'], 'document', onUsage);
    expect(onUsage).toHaveBeenCalledWith(9);
  });

  it('does not invoke onUsage for Gemini because its API does not return tokens', async () => {
    mockFetchJson({ embeddings: [{ values: [0.1, 0.2] }] });
    const svc = new GeminiEmbeddingService(
      config({
        GEMINI_API_KEY: 'k',
        GEMINI_EMBEDDING_MODEL: 'm',
        GEMINI_EMBEDDING_DIMENSIONS: 2,
      }),
    );
    const onUsage = vi.fn();
    await svc.embedBatch(['a'], 'document', onUsage as any);
    expect(onUsage).not.toHaveBeenCalled();
  });
});

describe('UsageService.recordEmbedding', () => {
  function build() {
    const create = vi.fn(async (_a: unknown) => ({}));
    const prisma = {
      runInTenantContext: vi.fn(
        async (_t: string, fn: (tx: unknown) => unknown) =>
          fn({ usageLog: { create } }),
      ),
    };
    return {
      service: new UsageService(prisma as any, { get: () => undefined } as any),
      create,
    };
  }
  const flush = () => new Promise((r) => setImmediate(r));

  it('estimates tokens as total characters divided by ESTIMATED_CHARS_PER_TOKEN rounded up', () => {
    expect(ESTIMATED_CHARS_PER_TOKEN).toBe(3);
    expect(estimateTokens(['abcdef', 'ghi'])).toBe(3); // 9 characters / 3
    expect(estimateTokens(['abcd'])).toBe(2); // 4/3 -> 2
    expect(estimateTokens([])).toBe(0);
  });

  it('uses reportedTokens when provided', async () => {
    const { service, create } = build();
    service.recordEmbedding({
      tenantId: 't1',
      texts: ['xxxxxxxxxxxx'],
      reportedTokens: 5,
    });
    await flush();
    expect((create.mock.calls[0]![0] as any).data).toMatchObject({
      tenantId: 't1',
      type: 'EMBEDDING',
      tokens: 5,
    });
  });

  it('estimates tokens from texts when reportedTokens is omitted', async () => {
    const { service, create } = build();
    service.recordEmbedding({ tenantId: 't1', texts: ['x'.repeat(30)] });
    await flush();
    expect((create.mock.calls[0]![0] as any).data).toMatchObject({
      type: 'EMBEDDING',
      tokens: 10,
    });
  });
});
