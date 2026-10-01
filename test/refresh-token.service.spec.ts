// test/refresh-token.service.spec.ts
//
// Test rotation + reuse detection cho RefreshTokenService — phần này trước đó (phase1-plan.md
// mục "Ngày 7-8") chỉ ghi "Viết test: rotate 3 lần liên tiếp thành công; dùng lại token đã rotate
// -> phải bị revoke cả family" nhưng chưa có file test thật. File này lấp đúng khoảng trống đó.
//
// Giả định: refresh-token.service.ts đã áp dụng bản refactor error-code ở mục 6.3
// (docmind-phase1-implementation.md) — ném UnauthorizedAppException với `code` cụ thể
// (AUTH_REFRESH_TOKEN_INVALID / AUTH_REFRESH_TOKEN_REUSED / AUTH_REFRESH_TOKEN_EXPIRED)
// thay vì UnauthorizedException trơn của Nest. Nếu bạn CHƯA áp dụng bản refactor đó, đổi các
// assertion `.rejects.toMatchObject({ code: ... })` bên dưới thành kiểm tra theo message tiếng Việt
// gốc (vd 'Refresh token không hợp lệ').
//
// Identity/AuthProvider/RefreshToken KHÔNG có RLS (xem migration.sql mục 5), nên test này chỉ cần
// PrismaService (role docmind_app) là đủ, không cần PrismaSystemService.

import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { RefreshTokenService } from '../src/auth/refresh-token.service.js';
import { ErrorCode } from '../src/common/exceptions/error-codes.js';

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

describe('RefreshTokenService — rotation & reuse detection', () => {
  let prisma: PrismaService;
  let refreshTokenService: RefreshTokenService;
  let identityId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
      providers: [RefreshTokenService],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    refreshTokenService = moduleRef.get(RefreshTokenService);

    const identity = await prisma.identity.create({
      data: { email: `refresh-token-test-${Date.now()}@test.docmind.local` },
    });
    identityId = identity.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rotate 3 times consecutively successfully, generating a new different token each time, with the same familyId', async () => {
    const { raw: raw0, familyId } = await refreshTokenService.issue(identityId);

    const { raw: raw1 } = await refreshTokenService.rotate(raw0);
    expect(raw1).not.toBe(raw0);

    const { raw: raw2 } = await refreshTokenService.rotate(raw1);
    expect(raw2).not.toBe(raw1);

    const { raw: raw3 } = await refreshTokenService.rotate(raw2);
    expect(raw3).not.toBe(raw2);

    // token mới nhất vẫn thuộc đúng familyId ban đầu và chưa bị revoke
    const latest = await prisma.refreshToken.findFirst({
      where: { identityId, familyId },
      orderBy: { createdAt: 'desc' },
    });
    expect(latest).not.toBeNull();
    expect(latest!.revokedAt).toBeNull();
    expect(latest!.tokenHash).toBe(hashToken(raw3));

    // raw3 vẫn dùng bình thường được tiếp (chưa hề bị đụng tới)
    const { raw: raw4 } = await refreshTokenService.rotate(raw3);
    expect(raw4).not.toBe(raw3);
  });

  it('reuse rotated token -> revoke ENTIRE FAMILY, family can no longer be used', async () => {
    const { raw: raw0, familyId } = await refreshTokenService.issue(identityId);
    const { raw: raw1 } = await refreshTokenService.rotate(raw0);
    // raw0 giờ đã revoked (vừa dùng để đổi lấy raw1)

    // dùng lại raw0 (đã revoke) -> reuse detected
    await expect(refreshTokenService.rotate(raw0)).rejects.toMatchObject({
      code: ErrorCode.AUTH_REFRESH_TOKEN_REUSED,
    });

    // hệ quả: raw1 (sinh ra SAU raw0, cùng family, bản thân chưa hề bị dùng lại) giờ cũng bị
    // revoke theo vì revokeFamily() đã quét toàn bộ family — đây chính là hành vi "logout mọi
    // thiết bị thuộc family" khi phát hiện dấu hiệu token bị đánh cắp.
    await expect(refreshTokenService.rotate(raw1)).rejects.toMatchObject({
      code: ErrorCode.AUTH_REFRESH_TOKEN_REUSED,
    });

    // xác nhận trực tiếp trong DB: mọi token thuộc familyId này đều đã bị revoke
    const tokensInFamily = await prisma.refreshToken.findMany({
      where: { familyId },
    });
    expect(tokensInFamily.length).toBeGreaterThanOrEqual(2);
    expect(tokensInFamily.every((t) => t.revokedAt !== null)).toBe(true);
  });

  it('replacedByTokenHash correctly points to the next token in the family (audit trail)', async () => {
    const { raw: raw0 } = await refreshTokenService.issue(identityId);
    const { raw: raw1 } = await refreshTokenService.rotate(raw0);

    const revoked = await prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(raw0) },
    });
    expect(revoked.replacedByTokenHash).toBe(hashToken(raw1));
  });

  it('non-existent token (any random string) -> "invalid" error, NOT reuse', async () => {
    await expect(
      refreshTokenService.rotate(randomUUID()),
    ).rejects.toMatchObject({
      code: ErrorCode.AUTH_REFRESH_TOKEN_INVALID,
    });
  });

  it('expired token (but not yet revoked) -> "expired" error, cannot rotate', async () => {
    const { raw } = await refreshTokenService.issue(identityId);

    // Giả lập hết hạn bằng cách chỉnh thẳng expiresAt trong DB về quá khứ — RefreshTokenService
    // không có API public để set TTL âm, đây là cách hợp lý để test nhánh else-if expiresAt.
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(raw) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(refreshTokenService.rotate(raw)).rejects.toMatchObject({
      code: ErrorCode.AUTH_REFRESH_TOKEN_EXPIRED,
    });
  });

  it('revokeOne() (used for logout) only revokes exactly 1 token, does not touch other tokens in the same family', async () => {
    const { raw: raw0, familyId } = await refreshTokenService.issue(identityId);
    const { raw: raw1 } = await refreshTokenService.rotate(raw0);

    // logout ở 1 thiết bị khác trong cùng phiên đăng nhập là chưa từng xảy ra trong phase 1
    // (mỗi lần issue() là 1 family riêng, tương ứng 1 thiết bị) — test này xác nhận revokeOne()
    // không vô tình lan ra cả family như revokeFamily() vẫn làm khi phát hiện reuse.
    const { raw: raw2, familyId: familyId2 } =
      await refreshTokenService.issue(identityId);
    await refreshTokenService.revokeOne(raw2);

    const family2Tokens = await prisma.refreshToken.findMany({
      where: { familyId: familyId2 },
    });
    expect(family2Tokens).toHaveLength(1);
    expect(family2Tokens[0]!.revokedAt).not.toBeNull();

    // family gốc (familyId, chứa raw1 còn sống) không bị ảnh hưởng gì bởi revokeOne() ở family khác
    const { raw: raw3 } = await refreshTokenService.rotate(raw1);
    expect(raw3).not.toBe(raw1);
    void familyId;
  });
});
