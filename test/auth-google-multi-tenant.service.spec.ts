// test/auth-google-multi-tenant.service.spec.ts
//
// Unit test cho khoản nợ đã sửa: loginWithGoogle() trước đó luôn lấy activeMemberships[0], giờ
// phải cư xử giống hệt login() bằng password — trả requiresTenantSelection khi có nhiều membership
// và chưa chỉ định tenantSlug.
//
// Cố tình KHÔNG dùng Postgres/pgvector thật và KHÔNG gọi Google thật: tự new AuthService với toàn
// bộ dependency là jest mock, để test chạy được ngay cả khi chưa có hạ tầng (không cần docker compose
// up, không cần GOOGLE_CLIENT_ID thật). Test DB-dependent (RLS, migration...) vẫn nằm ở các file khác.

import { AuthService } from '../src/auth/auth.service.js';
import { ErrorCode } from '../src/common/exceptions/error-codes.js';

describe('AuthService.loginWithGoogle — multi-tenant handling', () => {
  const identity = {
    id: 'identity-1',
    email: 'multi@test.com',
    displayName: null,
    emailVerifiedAt: null,
  };
  const membershipA = {
    id: 'mem-a',
    tenantId: 'tenant-a',
    identityId: identity.id,
    role: 'MEMBER',
    status: 'ACTIVE',
  };
  const membershipB = {
    id: 'mem-b',
    tenantId: 'tenant-b',
    identityId: identity.id,
    role: 'ADMIN',
    status: 'ACTIVE',
  };

  function buildService(activeMemberships: Array<typeof membershipA>) {
    const prisma = {
      authProvider: {
        // existingProvider tìm thấy -> nhánh "đã từng login Google rồi", không tạo mới gì cả
        findUnique: vi.fn().mockResolvedValue({ identityId: identity.id }),
      },
      identity: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(identity),
        findUnique: vi.fn(),
      },
    } as any;

    const system = {
      tenantMembership: {
        findMany: vi.fn().mockResolvedValue(activeMemberships),
      },
      tenant: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(),
    } as any;

    const jwtService = {
      sign: vi.fn().mockReturnValue('signed.jwt.token'),
    } as any;

    const refreshTokenService = {
      issue: vi
        .fn()
        .mockResolvedValue({ raw: 'raw-refresh-token', familyId: 'family-1' }),
    } as any;

    const googleVerifier = {
      verify: vi
        .fn()
        .mockResolvedValue({
          sub: 'google-sub-1',
          email: identity.email,
          emailVerified: true,
        }),
    } as any;

    const service = new AuthService(
      prisma,
      system,
      jwtService,
      googleVerifier,
      refreshTokenService,
    );
    return {
      service,
      prisma,
      system,
      jwtService,
      refreshTokenService,
      googleVerifier,
    };
  }

  it('multiple memberships + NO tenantSlug provided -> return requiresTenantSelection, DO NOT issue token', async () => {
    const { service, refreshTokenService } = buildService([
      membershipA,
      membershipB,
    ]);

    const result = await service.loginWithGoogle('fake-id-token');

    expect(result).toEqual({
      requiresTenantSelection: true,
      tenants: [
        { tenantId: 'tenant-a', role: 'MEMBER' },
        { tenantId: 'tenant-b', role: 'ADMIN' },
      ],
    });
    // Đây là assertion quan trọng nhất của bộ test này: KHÔNG được lỡ tay phát token khi chưa
    // biết chọn tenant nào — đúng hành vi đã sửa, khác hẳn bug cũ (luôn lấy phần tử đầu tiên).
    expect(refreshTokenService.issue).not.toHaveBeenCalled();
  });

  it('multiple memberships + WITH matching tenantSlug -> issue token directly to the selected tenant', async () => {
    const { service, system, refreshTokenService } = buildService([
      membershipA,
      membershipB,
    ]);
    system.tenant.findUnique.mockResolvedValue({
      id: 'tenant-b',
      slug: 'tenant-b-slug',
    });

    const result = await service.loginWithGoogle(
      'fake-id-token',
      'tenant-b-slug',
    );

    expect(result).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });
    expect(refreshTokenService.issue).toHaveBeenCalledWith(
      identity.id,
      undefined,
    );
  });

  it('tenantSlug does not match any membership -> AUTH_TENANT_MISMATCH, do not issue token', async () => {
    const { service, system, refreshTokenService } = buildService([
      membershipA,
    ]);
    system.tenant.findUnique.mockResolvedValue({
      id: 'tenant-khac',
      slug: 'tenant-khac',
    });

    await expect(
      service.loginWithGoogle('fake-id-token', 'tenant-khac'),
    ).rejects.toMatchObject({
      code: ErrorCode.AUTH_TENANT_MISMATCH,
    });
    expect(refreshTokenService.issue).not.toHaveBeenCalled();
  });

  it('only 1 membership -> issue token directly even without tenantSlug, do not return requiresTenantSelection', async () => {
    const { service } = buildService([membershipA]);

    const result = await service.loginWithGoogle('fake-id-token');

    expect(result).not.toHaveProperty('requiresTenantSelection');
    expect(result).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });
  });

  it('no ACTIVE membership -> AUTH_NO_TENANT_MEMBERSHIP (same as login() with password)', async () => {
    const { service } = buildService([]);

    await expect(
      service.loginWithGoogle('fake-id-token'),
    ).rejects.toMatchObject({
      code: ErrorCode.AUTH_NO_TENANT_MEMBERSHIP,
    });
  });
});
