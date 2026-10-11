// test/retrieval.service.spec.ts
//
// Mock PrismaService.runInTenantContext (chạy thẳng callback với 1 tx giả có $queryRaw mock sẵn),
// CollectionsService.listAccessibleCollectionIds, và EmbeddingProvider.embedBatch — không gọi
// Postgres/embedding API thật. Test tập trung vào LOGIC NGHIỆP VỤ xung quanh câu SQL (lọc quyền
// theo collection, map kết quả), không assert nội dung chuỗi SQL bên trong tagged template (nên để
// test tích hợp chạy với Postgres thật xác nhận cú pháp — xem RETRIEVAL_MODULE_NOTES.md).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RetrievalService } from '../src/retrieval/retrieval.service.js';
import type { AccessTokenPayload } from '../src/auth/auth.service.js';

function buildService(overrides?: {
  accessibleCollectionIds?: string[];
  queryRawResult?: unknown[];
}) {
  const queryRawResult = overrides?.queryRawResult ?? [];
  const tx = { $queryRaw: vi.fn().mockResolvedValue(queryRawResult) };
  const prisma = {
    runInTenantContext: vi.fn(
      (_tenantId: string, fn: (tx: unknown) => unknown) => fn(tx),
    ),
  };
  const collectionsService = {
    listAccessibleCollectionIds: vi
      .fn()
      .mockResolvedValue(
        overrides?.accessibleCollectionIds ?? ['col-1', 'col-2'],
      ),
  };
  const embedding = {
    embedBatch: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
  };

  const service = new RetrievalService(
    prisma as never,
    collectionsService as never,
    embedding as never,
  );
  return { service, prisma, tx, collectionsService, embedding };
}

const CALLER: AccessTokenPayload = {
  identityId: 'identity-1',
  tenantId: 'tenant-1',
  membershipId: 'member-1',
  role: 'MEMBER',
};

describe('RetrievalService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully performs hybrid search: embeds query, runs raw SQL in tenant context, and maps score to number', async () => {
    const row = {
      id: 'chunk-1',
      documentId: 'doc-1',
      content: 'chunk content',
      chunkIndex: 0,
      headingContext: null,
      pageNumber: null,
      filename: 'a.pdf',
      score: '0.0328', // Postgres driver may return numeric as string
    };
    const { service, prisma, tx, embedding } = buildService({
      queryRawResult: [row],
    });

    const result = await service.search(CALLER, {
      query: 'hello docmind',
      topK: 10,
    });

    expect(embedding.embedBatch).toHaveBeenCalledWith(['hello docmind']);
    expect(prisma.runInTenantContext).toHaveBeenCalledWith(
      'tenant-1',
      expect.any(Function),
    );
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toEqual([{ ...row, score: 0.0328 }]);
  });

  it('returns empty array immediately without embedding or querying DB when no collections are accessible', async () => {
    const { service, embedding, tx } = buildService({
      accessibleCollectionIds: [],
    });

    const result = await service.search(CALLER, { query: 'x', topK: 10 });

    expect(result).toEqual([]);
    expect(embedding.embedBatch).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns empty array when specified collectionId is not accessible', async () => {
    const { service, embedding, tx } = buildService({
      accessibleCollectionIds: ['col-1'],
    });

    const result = await service.search(CALLER, {
      query: 'x',
      topK: 10,
      collectionId: 'c0000000-0000-0000-0000-000000000099',
    });

    expect(result).toEqual([]);
    expect(embedding.embedBatch).not.toHaveBeenCalled();
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('proceeds with search when specified collectionId is accessible', async () => {
    const { service, tx } = buildService({
      accessibleCollectionIds: ['col-1', 'col-2'],
    });

    const result = await service.search(CALLER, {
      query: 'x',
      topK: 5,
      collectionId: 'col-2',
    });

    expect(result).toEqual([]);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('passes query string through to embedding provider as expected', async () => {
    const { service, embedding } = buildService();

    await service.search(CALLER, { query: 'a', topK: 10 });

    expect(embedding.embedBatch).toHaveBeenCalledWith(['a']);
  });
});
