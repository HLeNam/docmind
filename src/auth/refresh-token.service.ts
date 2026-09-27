import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID, createHash } from 'node:crypto';
import { PrismaSystemService } from '../prisma/prisma-system.service.js';

const REFRESH_TOKEN_TTL_DAYS = 30;

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaSystemService) {}

  /** Phát hành refresh token mới, bắt đầu 1 family mới (dùng khi login). */
  async issue(identityId: string): Promise<{ raw: string; familyId: string }> {
    const raw = randomUUID() + randomUUID(); // đủ entropy, không cần thư viện riêng
    const familyId = randomUUID();
    await this.prisma.refreshToken.create({
      data: {
        identityId,
        familyId,
        tokenHash: hashToken(raw),
        expiresAt: new Date(
          Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
        ),
      },
    });
    return { raw, familyId };
  }

  /**
   * Rotate: verify token cũ, revoke nó, phát hành token mới cùng familyId.
   * Nếu token đưa vào đã bị revoke trước đó -> reuse detected -> revoke cả family, throw.
   */
  async rotate(rawToken: string): Promise<{ raw: string; identityId: string }> {
    const tokenHash = hashToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!existing) {
      throw new UnauthorizedException('Refresh token not valid');
    }

    if (existing.revokedAt) {
      // Reuse detected: token này đã bị dùng/rotate trước đó nhưng vẫn có người gửi lại
      // -> khả năng cao token đã bị đánh cắp -> revoke toàn bộ family, buộc logout mọi thiết bị
      await this.revokeFamily(existing.familyId);
      throw new UnauthorizedException(
        'Refresh token used — please login again',
      );
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const raw = randomUUID() + randomUUID();
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          identityId: existing.identityId,
          familyId: existing.familyId,
          tokenHash: hashToken(raw),
          expiresAt: new Date(
            Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
          ),
        },
      }),
    ]);

    return { raw, identityId: existing.identityId };
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Logout 1 thiết bị — chỉ revoke đúng token hiện tại, không đụng cả family. */
  async revokeOne(rawToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
