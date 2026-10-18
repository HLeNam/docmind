import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { PublicQueryService } from '../src/public-api/public-query.service.js';
import {
  ForbiddenAppException,
  NotFoundAppException,
} from '../src/common/exceptions/app.exception.js';
import { ErrorCode } from '../src/common/exceptions/error-codes.js';

const chunk = (over: Record<string, unknown> = {}) => ({
  id: 'ch1',
  documentId: 'd1',
  content: 'Nội dung đoạn trích',
  chunkIndex: 3,
  headingContext: '## Mục 1',
  pageNumber: 7,
  filename: 'a.pdf',
  score: 0.03,
  ...over,
});

function key(over: Record<string, unknown> = {}) {
  return {
    apiKeyId: 'k1',
    keyPrefix: 'dm_live_ab12',
    tenantId: 't1',
    collectionId: null as string | null,
    ...over,
  };
}

describe('PublicQueryService', () => {
  let searchInCollections: Mock<(...args: any[]) => Promise<any[]>>;
  let streamChat: Mock<(args: any) => AsyncGenerator<string>>;
  let usage: { record: Mock };
  let findManyCollections: Mock<() => Promise<any[]>>;
  let service: PublicQueryService;

  beforeEach(() => {
    searchInCollections = vi.fn(async () => [chunk()]);
    streamChat = vi.fn(async function* () {
      yield 'Trả lời ';
      yield '[1]';
    });
    findManyCollections = vi.fn(async () => [{ id: 'c1' }, { id: 'c2' }]);
    const prisma: any = {
      runInTenantContext: vi.fn(
        async (_t: string, fn: (tx: unknown) => unknown) =>
          fn({ collection: { findMany: findManyCollections } }),
      ),
    };
    usage = { record: vi.fn() };
    service = new PublicQueryService(
      prisma,
      { searchInCollections } as any,
      { streamChat } as any,
      usage as any,
    );
  });

  it('searches across all tenant collections and returns combined answer and citations with snippets for tenant-wide key', async () => {
    const result = await service.query(key(), { query: 'hỏi gì đó', topK: 5 });

    expect(searchInCollections).toHaveBeenCalledWith(
      't1',
      ['c1', 'c2'],
      'hỏi gì đó',
      5,
    );
    expect(result.answer).toBe('Trả lời [1]');
    expect(result.citations).toEqual([
      {
        index: 1,
        documentId: 'd1',
        filename: 'a.pdf',
        chunkIndex: 3,
        pageNumber: 7,
        headingContext: '## Mục 1',
        snippet: 'Nội dung đoạn trích',
        score: 0.03,
      },
    ]);
  });

  it('truncates citation snippet to maximum 300 characters', async () => {
    searchInCollections.mockResolvedValue([
      chunk({ content: 'x'.repeat(1000) }),
    ]);
    const result = await service.query(key(), { query: 'q', topK: 5 });
    expect(result.citations[0]!.snippet).toHaveLength(300);
  });

  it('sends prompt to LLM with numbered context and question without chat history', async () => {
    await service.query(key(), { query: 'câu hỏi', topK: 5 });
    const arg = streamChat.mock.calls[0]![0];
    expect(arg.systemPrompt).toContain('[1] (a.pdf) Nội dung đoạn trích');
    expect(arg.messages).toEqual([{ role: 'user', content: 'câu hỏi' }]);
  });

  it('records GENERATION usage for key tenant when provider reports token count', async () => {
    streamChat.mockImplementation(async function* (args: any) {
      yield 'ok';
      args.onUsage({ inputTokens: 500, outputTokens: 80 });
    });
    await service.query(key(), { query: 'q', topK: 5 });
    expect(usage.record).toHaveBeenCalledWith({
      tenantId: key().tenantId,
      type: 'GENERATION',
      inputTokens: 500,
      outputTokens: 80,
    });
  });

  it('narrows search to specified collection when tenant-wide key provides valid collectionId', async () => {
    await service.query(key(), { query: 'q', topK: 5, collectionId: 'c2' });
    expect(searchInCollections.mock.calls[0]![1]).toEqual(['c2']);
  });

  it('throws 404 COLLECTION_NOT_FOUND without searching when collectionId does not belong to tenant', async () => {
    const err = await service
      .query(key(), { query: 'q', topK: 5, collectionId: 'lạ' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotFoundAppException);
    expect((err as NotFoundAppException).code).toBe(
      ErrorCode.COLLECTION_NOT_FOUND,
    );
    expect(searchInCollections).not.toHaveBeenCalled();
  });

  it('searches only scoped collection without querying collections list for collection-scoped key', async () => {
    await service.query(key({ collectionId: 'c1' }), { query: 'q', topK: 5 });
    expect(searchInCollections.mock.calls[0]![1]).toEqual(['c1']);
    expect(findManyCollections).not.toHaveBeenCalled();
  });

  it('succeeds when collection-scoped key queries its assigned collection', async () => {
    await service.query(key({ collectionId: 'c1' }), {
      query: 'q',
      topK: 5,
      collectionId: 'c1',
    });
    expect(searchInCollections.mock.calls[0]![1]).toEqual(['c1']);
  });

  it('throws 403 API_KEY_SCOPE_FORBIDDEN without searching or calling LLM when collection-scoped key requests different collection', async () => {
    const err = await service
      .query(key({ collectionId: 'c1' }), {
        query: 'q',
        topK: 5,
        collectionId: 'c2',
      })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ForbiddenAppException);
    expect((err as ForbiddenAppException).code).toBe(
      ErrorCode.API_KEY_SCOPE_FORBIDDEN,
    );
    expect(searchInCollections).not.toHaveBeenCalled();
    expect(streamChat).not.toHaveBeenCalled();
  });

  describe('prepare / streamAnswer (used by /v1/query/stream)', () => {
    it('performs retrieval only without calling LLM in prepare', async () => {
      const prepared = await service.prepare(key(), { query: 'q', topK: 5 });
      expect(searchInCollections).toHaveBeenCalledTimes(1);
      expect(streamChat).not.toHaveBeenCalled();
      expect(prepared.citations).toHaveLength(1);
      expect(prepared.messages).toEqual([{ role: 'user', content: 'q' }]);
    });

    it('throws scope error in prepare before streaming anything', async () => {
      await expect(
        service.prepare(key({ collectionId: 'c1' }), {
          query: 'q',
          topK: 5,
          collectionId: 'c2',
        }),
      ).rejects.toBeInstanceOf(ForbiddenAppException);
    });

    it('yields deltas in the order returned by LLM in streamAnswer', async () => {
      const prepared = await service.prepare(key(), { query: 'q', topK: 5 });
      const deltas: string[] = [];
      for await (const d of service.streamAnswer(prepared)) deltas.push(d);
      expect(deltas).toEqual(['Trả lời ', '[1]']);
    });
  });
});
