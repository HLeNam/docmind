import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import { ApiKeyGuard } from '../src/api-keys/api-key.guard.js';
import { generateApiKey } from '../src/api-keys/api-key.util.js';
import { UnauthorizedAppException } from '../src/common/exceptions/app.exception.js';
import { ErrorCode } from '../src/common/exceptions/error-codes.js';

function contextWith(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  let findUnique: Mock<(args: any) => Promise<any>>;
  let guard: ApiKeyGuard;

  beforeEach(() => {
    findUnique = vi.fn();
    guard = new ApiKeyGuard({ apiKey: { findUnique } } as any);
  });

  async function codeOf(
    request: Record<string, unknown>,
  ): Promise<string | undefined> {
    const err = await guard
      .canActivate(contextWith(request))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnauthorizedAppException);
    return (err as UnauthorizedAppException).code;
  }

  it('thiếu header Authorization -> API_KEY_MISSING', async () => {
    expect(await codeOf({ headers: {} })).toBe(ErrorCode.API_KEY_MISSING);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('sai scheme (Basic ...) -> API_KEY_MISSING', async () => {
    expect(await codeOf({ headers: { authorization: 'Basic abc' } })).toBe(
      ErrorCode.API_KEY_MISSING,
    );
  });

  it('gửi nhầm JWT (không có prefix dm_live_) -> API_KEY_INVALID, không tra DB', async () => {
    expect(
      await codeOf({
        headers: { authorization: 'Bearer eyJhbGciOi.jwt.token' },
      }),
    ).toBe(ErrorCode.API_KEY_INVALID);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('key đúng dạng nhưng không có trong DB -> API_KEY_INVALID', async () => {
    findUnique.mockResolvedValue(null);
    const { raw } = generateApiKey();
    expect(await codeOf({ headers: { authorization: `Bearer ${raw}` } })).toBe(
      ErrorCode.API_KEY_INVALID,
    );
  });

  it('key đã revoke -> API_KEY_REVOKED', async () => {
    findUnique.mockResolvedValue({
      id: 'k1',
      keyPrefix: 'dm_live_ab12',
      tenantId: 't1',
      collectionId: null,
      revokedAt: new Date(),
    });
    const { raw } = generateApiKey();
    expect(await codeOf({ headers: { authorization: `Bearer ${raw}` } })).toBe(
      ErrorCode.API_KEY_REVOKED,
    );
  });

  it('key hợp lệ -> tra bằng hash (không phải key gốc), gắn principal + tenantId vào request', async () => {
    const { raw, keyHash } = generateApiKey();
    findUnique.mockResolvedValue({
      id: 'k1',
      keyPrefix: 'dm_live_ab12',
      tenantId: 't1',
      collectionId: 'c1',
      revokedAt: null,
    });
    const request: Record<string, any> = {
      headers: { authorization: `bearer ${raw}` },
    };

    await expect(guard.canActivate(contextWith(request))).resolves.toBe(true);

    expect(findUnique.mock.calls[0]![0].where).toEqual({ keyHash });
    expect(request.apiKey).toEqual({
      apiKeyId: 'k1',
      keyPrefix: 'dm_live_ab12',
      tenantId: 't1',
      collectionId: 'c1',
    });
    expect(request.tenantId).toBe('t1');
  });
});
