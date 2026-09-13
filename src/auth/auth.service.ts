import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaSystemService } from '../prisma/prisma-system.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import {
  ConflictAppException,
  UnprocessableAppException,
} from '../common/exceptions/app.exception.js';
import type { RegisterDto, LoginDto } from './dtos/auth.dto.js';

export interface AccessTokenPayload {
  identityId: string;
  tenantId: string;
  membershipId: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaSystemService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  /** Register luôn tạo Tenant mới + Membership OWNER — khác với accept invitation (chỉ thêm membership vào tenant có sẵn). */
  async register(dto: RegisterDto) {
    const existingIdentity = await this.prisma.identity.findUnique({
      where: { email: dto.email },
    });
    if (existingIdentity) {
      throw new ConflictAppException('Email already used');
    }

    const passwordHash = await argon2.hash(dto.password);
    const slug =
      this.slugify(dto.tenantName) +
      '-' +
      Math.random().toString(36).slice(2, 8);

    // 4 bảng liên quan phải tạo cùng lúc hoặc không tạo gì cả -> $transaction
    const { identity, tenant, membership } = await this.prisma.$transaction(
      async (tx) => {
        const identity = await tx.identity.create({
          data: { email: dto.email },
        });
        await tx.authProvider.create({
          data: { identityId: identity.id, provider: 'PASSWORD', passwordHash },
        });
        const tenant = await tx.tenant.create({
          data: { name: dto.tenantName, slug },
        });
        const membership = await tx.tenantMembership.create({
          data: { tenantId: tenant.id, identityId: identity.id, role: 'OWNER' },
        });
        return { identity, tenant, membership };
      },
    );

    return this.issueTokens({
      identityId: identity.id,
      tenantId: tenant.id,
      membershipId: membership.id,
      role: membership.role,
    });
  }

  async login(dto: LoginDto) {
    const identity = await this.prisma.identity.findUnique({
      where: { email: dto.email },
      include: { authProviders: true, memberships: true },
    });
    if (!identity) {
      throw new UnauthorizedException('Email or password not valid');
    }

    const passwordProvider = identity.authProviders.find(
      (p) => p.provider === 'PASSWORD',
    );
    if (
      !passwordProvider?.passwordHash ||
      !(await argon2.verify(passwordProvider.passwordHash, dto.password))
    ) {
      throw new UnauthorizedException('Email or password not valid');
    }

    const activeMemberships = identity.memberships.filter(
      (m) => m.status === 'ACTIVE',
    );
    if (activeMemberships.length === 0) {
      throw new UnprocessableAppException(
        'Account does not belong to any organization',
      );
    }

    let membership = activeMemberships[0];
    if (dto.tenantSlug) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { slug: dto.tenantSlug },
      });
      const match = activeMemberships.find((m) => m.tenantId === tenant?.id);
      if (!match)
        throw new UnauthorizedException('Not member of this organization');
      membership = match;
    } else if (activeMemberships.length > 1) {
      // nhiều tenant, FE chưa chọn -> trả danh sách để FE hiển thị picker, không phát token vội
      return {
        requiresTenantSelection: true,
        tenants: activeMemberships.map((m) => ({
          tenantId: m.tenantId,
          role: m.role,
        })),
      };
    }

    return this.issueTokens({
      identityId: identity.id,
      tenantId: membership.tenantId,
      membershipId: membership.id,
      role: membership.role,
    });
  }

  async refresh(rawRefreshToken: string) {
    const { raw, identityId } =
      await this.refreshTokenService.rotate(rawRefreshToken);
    // access token mới cần lại đủ tenantId/membershipId/role -> phải tra lại membership hiện tại
    // (đơn giản nhất: yêu cầu FE cũng gửi kèm tenantId nếu multi-tenant; ở đây lấy membership đầu tiên active)
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { identityId, status: 'ACTIVE' },
    });
    if (!membership)
      throw new UnauthorizedException('Not find valid membership');

    const accessToken = this.signAccessToken({
      identityId,
      tenantId: membership.tenantId,
      membershipId: membership.id,
      role: membership.role,
    });
    return { accessToken, refreshToken: raw };
  }

  async logout(rawRefreshToken: string) {
    await this.refreshTokenService.revokeOne(rawRefreshToken);
  }

  private async issueTokens(payload: AccessTokenPayload) {
    const accessToken = this.signAccessToken(payload);
    const { raw: refreshToken } = await this.refreshTokenService.issue(
      payload.identityId,
    );
    return { accessToken, refreshToken };
  }

  private signAccessToken(payload: AccessTokenPayload): string {
    return this.jwtService.sign(payload, { expiresIn: '15m' });
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
}
