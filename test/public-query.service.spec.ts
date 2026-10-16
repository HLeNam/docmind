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
    service = new PublicQueryService(
      prisma,
      { searchInCollections } as any,
      { streamChat } as any,
    );
  });

  it('key toàn tenant: search trên mọi collection của tenant, trả answer gộp + citation có snippet', async () => {
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

  it('snippet bị cắt tối đa 300 ký tự', async () => {
    searchInCollections.mockResolvedValue([
      chunk({ content: 'x'.repeat(1000) }),
    ]);
    const result = await service.query(key(), { query: 'q', topK: 5 });
    expect(result.citations[0]!.snippet).toHaveLength(300);
  });

  it('prompt gửi LLM chứa context đã đánh số và câu hỏi, không có lịch sử hội thoại', async () => {
    await service.query(key(), { query: 'câu hỏi', topK: 5 });
    const arg = streamChat.mock.calls[0]![0];
    expect(arg.systemPrompt).toContain('[1] (a.pdf) Nội dung đoạn trích');
    expect(arg.messages).toEqual([{ role: 'user', content: 'câu hỏi' }]);
  });

  it('key toàn tenant + collectionId hợp lệ: thu hẹp về đúng collection đó', async () => {
    await service.query(key(), { query: 'q', topK: 5, collectionId: 'c2' });
    expect(searchInCollections.mock.calls[0]![1]).toEqual(['c2']);
  });

  it('key toàn tenant + collectionId không thuộc tenant -> 404, không search', async () => {
    const err = await service
      .query(key(), { query: 'q', topK: 5, collectionId: 'lạ' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NotFoundAppException);
    expect((err as NotFoundAppException).code).toBe(
      ErrorCode.COLLECTION_NOT_FOUND,
    );
    expect(searchInCollections).not.toHaveBeenCalled();
  });

  it('key scope 1 collection: chỉ search đúng collection đó, không cần query DB danh sách collection', async () => {
    await service.query(key({ collectionId: 'c1' }), { query: 'q', topK: 5 });
    expect(searchInCollections.mock.calls[0]![1]).toEqual(['c1']);
    expect(findManyCollections).not.toHaveBeenCalled();
  });

  it('key scope 1 collection + xin đúng collection đó -> OK', async () => {
    await service.query(key({ collectionId: 'c1' }), {
      query: 'q',
      topK: 5,
      collectionId: 'c1',
    });
    expect(searchInCollections.mock.calls[0]![1]).toEqual(['c1']);
  });

  it('key scope 1 collection + xin collection khác -> 403 API_KEY_SCOPE_FORBIDDEN, không search, không gọi LLM', async () => {
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

  describe('prepare / streamAnswer (dùng cho /v1/query/stream)', () => {
    it('prepare chỉ retrieval, KHÔNG gọi LLM', async () => {
      const prepared = await service.prepare(key(), { query: 'q', topK: 5 });
      expect(searchInCollections).toHaveBeenCalledTimes(1);
      expect(streamChat).not.toHaveBeenCalled();
      expect(prepared.citations).toHaveLength(1);
      expect(prepared.messages).toEqual([{ role: 'user', content: 'q' }]);
    });

    it('prepare ném lỗi scope trước khi có gì để stream', async () => {
      await expect(
        service.prepare(key({ collectionId: 'c1' }), {
          query: 'q',
          topK: 5,
          collectionId: 'c2',
        }),
      ).rejects.toBeInstanceOf(ForbiddenAppException);
    });

    it('streamAnswer yield từng mẩu theo thứ tự LLM trả', async () => {
      const prepared = await service.prepare(key(), { query: 'q', topK: 5 });
      const deltas: string[] = [];
      for await (const d of service.streamAnswer(prepared)) deltas.push(d);
      expect(deltas).toEqual(['Trả lời ', '[1]']);
    });
  });
});
