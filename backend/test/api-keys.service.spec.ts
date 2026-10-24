// test/api-keys.service.spec.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiKeysService } from '../src/api-keys/api-keys.service.js';
import { hashApiKey } from '../src/api-keys/api-key.util.js';
import {
  NotFoundAppException,
  UnprocessableAppException,
} from '../src/common/exceptions/app.exception.js';
import { ErrorCode } from '../src/common/exceptions/error-codes.js';

const caller = {
  identityId: 'i1',
  tenantId: 't1',
  membershipId: 'm1',
  role: 'OWNER',
};

describe('ApiKeysService', () => {
  let tx: any;
  let service: ApiKeysService;

  beforeEach(() => {
    tx = {
      collection: { findUnique: vi.fn() },
      apiKey: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    const prisma: any = {
      runInTenantContext: vi.fn(
        async (_tenantId: string, fn: (t: unknown) => unknown) => fn(tx),
      ),
    };
    service = new ApiKeysService(prisma);
  });

  describe('create', () => {
    it('lưu hash (không lưu key gốc) và trả key gốc đúng 1 lần', async () => {
      tx.apiKey.create.mockImplementation(async ({ data }: any) => ({
        id: 'k1',
        name: data.name,
        keyPrefix: data.keyPrefix,
        collectionId: data.collectionId,
        createdAt: new Date(),
        revokedAt: null,
      }));

      const result = await service.create(caller, { name: 'CI key' });

      const saved = tx.apiKey.create.mock.calls[0][0].data;
      expect(saved.tenantId).toBe('t1');
      expect(saved.keyHash).toBe(hashApiKey(result.key));
      expect(JSON.stringify(saved)).not.toContain(result.key);
      expect(saved.collectionId).toBeNull();
      expect(result.key.startsWith('dm_live_')).toBe(true);
      expect(result).not.toHaveProperty('keyHash');
    });

    it('scope theo collection: kiểm tra collection thuộc tenant trước khi tạo', async () => {
      tx.collection.findUnique.mockResolvedValue({ id: 'c1' });
      tx.apiKey.create.mockResolvedValue({ id: 'k1', collectionId: 'c1' });

      await service.create(caller, { name: 'Scoped', collectionId: 'c1' });

      expect(tx.collection.findUnique).toHaveBeenCalledWith({
        where: { id: 'c1' },
        select: { id: true },
      });
      expect(tx.apiKey.create.mock.calls[0][0].data.collectionId).toBe('c1');
    });

    it('collection không tồn tại / thuộc tenant khác (RLS trả null) -> 404, không tạo key', async () => {
      tx.collection.findUnique.mockResolvedValue(null);

      await expect(
        service.create(caller, { name: 'x', collectionId: 'other' }),
      ).rejects.toMatchObject({
        code: ErrorCode.COLLECTION_NOT_FOUND,
      });
      expect(tx.apiKey.create).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('chỉ select field an toàn, mới nhất trước', async () => {
      tx.apiKey.findMany.mockResolvedValue([]);
      await service.list(caller);
      const arg = tx.apiKey.findMany.mock.calls[0][0];
      expect(arg.select).not.toHaveProperty('keyHash');
      expect(arg.orderBy).toEqual({ createdAt: 'desc' });
    });
  });

  describe('revoke', () => {
    it('set revokedAt cho key còn hiệu lực', async () => {
      tx.apiKey.findUnique.mockResolvedValue({ id: 'k1', revokedAt: null });
      tx.apiKey.update.mockResolvedValue({ id: 'k1', revokedAt: new Date() });

      const result = await service.revoke(caller, 'k1');

      expect(tx.apiKey.update.mock.calls[0][0].data.revokedAt).toBeInstanceOf(
        Date,
      );
      expect(result.revokedAt).toBeInstanceOf(Date);
    });

    it('key không tồn tại -> NotFound', async () => {
      tx.apiKey.findUnique.mockResolvedValue(null);
      const err = await service.revoke(caller, 'nope').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(NotFoundAppException);
      expect((err as NotFoundAppException).code).toBe(
        ErrorCode.API_KEY_NOT_FOUND,
      );
    });

    it('key đã revoke rồi -> 422, không update lần nữa', async () => {
      tx.apiKey.findUnique.mockResolvedValue({
        id: 'k1',
        revokedAt: new Date(),
      });
      const err = await service.revoke(caller, 'k1').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(UnprocessableAppException);
      expect((err as UnprocessableAppException).code).toBe(
        ErrorCode.API_KEY_ALREADY_REVOKED,
      );
      expect(tx.apiKey.update).not.toHaveBeenCalled();
    });
  });
});
