import { Injectable } from '@nestjs/common';
import { randomUUID, createHash } from 'node:crypto';
import { PrismaSystemService } from '../prisma/prisma-system.service.js';
import { UnauthorizedAppException } from '../common/exceptions/app.exception.js';
import { ErrorCode } from '../common/exceptions/error-codes.js';

const REFRESH_TOKEN_TTL_DAYS = 30;

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Thông tin thiết bị/nguồn gốc request — dùng để điền vào userAgent/ipAddress cho audit trail. */
export interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaSystemService) {}

  /** Phát hành refresh token mới, bắt đầu 1 family mới (dùng khi login). */
  async issue(
    identityId: string,
    meta?: RequestMeta,
  ): Promise<{ raw: string; familyId: string }> {
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
        userAgent: meta?.userAgent,
        ipAddress: meta?.ipAddress,
      },
    });
    return { raw, familyId };
  }

  /**
   * Rotate: verify token cũ, revoke nó, phát hành token mới cùng familyId.
   * Nếu token đưa vào đã bị revoke trước đó -> reuse detected -> revoke cả family, throw.
   */
  async rotate(
    rawToken: string,
    meta?: RequestMeta,
  ): Promise<{ raw: string; identityId: string }> {
    const tokenHash = hashToken(rawToken);
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!existing) {
      throw new UnauthorizedAppException(ErrorCode.AUTH_REFRESH_TOKEN_INVALID);
    }

    if (existing.revokedAt) {
      // Reuse detected: token này đã bị dùng/rotate trước đó nhưng vẫn có người gửi lại
      // -> khả năng cao token đã bị đánh cắp -> revoke toàn bộ family, buộc logout mọi thiết bị
      await this.revokeFamily(existing.familyId);
      throw new UnauthorizedAppException(ErrorCode.AUTH_REFRESH_TOKEN_REUSED);
    }

    if (existing.expiresAt < new Date()) {
      throw new UnauthorizedAppException(ErrorCode.AUTH_REFRESH_TOKEN_EXPIRED);
    }

    const raw = randomUUID() + randomUUID();
    const newTokenHash = hashToken(raw);

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: existing.id },
        // replacedByTokenHash trỏ tới token kế tiếp -> nếu sau này phát hiện reuse, truy được
        // chính xác chuỗi token nào đã bị lộ/dùng lại, không chỉ biết "gia đình này bị revoke".
        data: { revokedAt: new Date(), replacedByTokenHash: newTokenHash },
      }),
      this.prisma.refreshToken.create({
        data: {
          identityId: existing.identityId,
          familyId: existing.familyId,
          tokenHash: newTokenHash,
          expiresAt: new Date(
            Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
          ),
          userAgent: meta?.userAgent,
          ipAddress: meta?.ipAddress,
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
