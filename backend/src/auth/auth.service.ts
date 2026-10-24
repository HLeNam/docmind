import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaSystemService } from '../prisma/prisma-system.service.js';
import { RefreshTokenService, RequestMeta } from './refresh-token.service.js';
import {
  ConflictAppException,
  UnauthorizedAppException,
  UnprocessableAppException,
} from '../common/exceptions/app.exception.js';
import { ErrorCode } from '../common/exceptions/error-codes.js';
import type { RegisterDto, LoginDto } from './dtos/auth.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { GoogleTokenVerifierService } from './google-token-verifier.service.js';

export interface AccessTokenPayload {
  identityId: string;
  tenantId: string;
  membershipId: string;
  role: string;
}

export interface TenantSelectionResult {
  requiresTenantSelection: true;
  tenants: Array<{ tenantId: string; role: string }>;
}

export interface TokenPairResult {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    // BYPASSRLS — CHỈ dùng cho truy vấn cross-tenant hợp lệ trong auth flow (chưa biết tenant cụ thể),
    // luôn tự lọc theo identityId đã xác thực trước đó, không bao giờ nhận tenantId/filter tuỳ ý từ client.
    private readonly system: PrismaSystemService,
    private readonly jwtService: JwtService,
    private readonly googleVerifier: GoogleTokenVerifierService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  /** Register luôn tạo Tenant mới + Membership OWNER — khác với accept invitation (chỉ thêm membership vào tenant có sẵn). */
  async register(dto: RegisterDto, meta?: RequestMeta) {
    const existingIdentity = await this.prisma.identity.findUnique({
      where: { email: dto.email },
    });
    if (existingIdentity) {
      throw new ConflictAppException(ErrorCode.AUTH_EMAIL_TAKEN);
    }

    const passwordHash = await argon2.hash(dto.password);
    const slug =
      this.slugify(dto.tenantName) +
      '-' +
      Math.random().toString(36).slice(2, 8);

    // 4 bảng liên quan phải tạo cùng lúc hoặc không tạo gì cả -> $transaction.
    // Dùng this.system (BYPASSRLS) ở đây vì Tenant/TenantMembership chưa tồn tại lúc bắt đầu transaction —
    // chưa có app.current_tenant nào hợp lệ để set, PrismaService thường sẽ bị RLS chặn ngay câu insert đầu tiên.
    const { identity, tenant, membership } = await this.system.$transaction(
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

    return this.issueTokens(
      {
        identityId: identity.id,
        tenantId: tenant.id,
        membershipId: membership.id,
        role: membership.role,
      },
      meta,
    );
  }

  async login(dto: LoginDto, meta?: RequestMeta) {
    const identity = await this.prisma.identity.findUnique({
      where: { email: dto.email },
      include: { authProviders: true }, // KHÔNG include memberships ở đây — bị RLS lọc rỗng, xem cảnh báo phía trên
    });
    if (!identity) {
      throw new UnauthorizedAppException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    const passwordProvider = identity.authProviders.find(
      (p) => p.provider === 'PASSWORD',
    );
    if (
      !passwordProvider?.passwordHash ||
      !(await argon2.verify(passwordProvider.passwordHash, dto.password))
    ) {
      throw new UnauthorizedAppException(ErrorCode.AUTH_INVALID_CREDENTIALS);
    }

    return this.resolveTenantAndIssueTokens(identity.id, dto.tenantSlug, meta);
  }

  async refresh(rawRefreshToken: string, meta?: RequestMeta) {
    const { raw, identityId } = await this.refreshTokenService.rotate(
      rawRefreshToken,
      meta,
    );
    // access token mới cần lại đủ tenantId/membershipId/role -> phải tra lại membership hiện tại.
    // Cross-tenant discovery giống login() — identityId đã được xác thực hợp lệ qua rotate() ở trên,
    // nên dùng this.system ở đây là an toàn, không phải lỗ hổng.
    const membership = await this.system.tenantMembership.findFirst({
      where: { identityId, status: 'ACTIVE' },
    });
    if (!membership)
      throw new UnauthorizedAppException(ErrorCode.AUTH_NO_ACTIVE_MEMBERSHIP);

    const accessToken = this.signAccessToken({
      identityId,
      tenantId: membership.tenantId,
      membershipId: membership.id,
      role: membership.role,
    });
    return { accessToken, refreshToken: raw };
  }

  /**
   * Đăng nhập/đăng ký qua Google — verify ID token trước, sau đó link/tạo Identity.
   * Thứ tự tra cứu: (1) đã từng login Google chưa (theo provider+sub) -> (2) đã có Identity theo
   * email chưa (từng đăng ký password) -> link thêm AuthProvider GOOGLE -> (3) hoàn toàn mới -> tạo
   * Identity + Tenant + Membership OWNER, giống hệt register().
   */
  async loginWithGoogle(
    idToken: string,
    tenantSlug?: string,
    meta?: RequestMeta,
  ) {
    const profile = await this.googleVerifier.verify(idToken);

    const existingProvider = await this.prisma.authProvider.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'GOOGLE',
          providerAccountId: profile.sub,
        },
      },
    });

    let identity = existingProvider
      ? await this.prisma.identity.findUniqueOrThrow({
          where: { id: existingProvider.identityId },
        })
      : await this.prisma.identity.findUnique({
          where: { email: profile.email },
        });

    if (!identity) {
      // Chưa từng có tài khoản nào (chưa Google, chưa password) -> tạo mới toàn bộ, giống register().
      // Dùng this.system (BYPASSRLS) vì Tenant/TenantMembership chưa tồn tại lúc bắt đầu transaction.
      // displayName lấy từ Google profile.name (đã verify chữ ký) — field có sẵn trong schema,
      // register() bằng password không có nguồn nào để điền nên bỏ trống, để user tự cập nhật sau.
      const tenantName = profile.email.split('@')[0];
      const slug =
        this.slugify(tenantName) + '-' + Math.random().toString(36).slice(2, 8);

      const created = await this.system.$transaction(async (tx) => {
        const newIdentity = await tx.identity.create({
          data: {
            email: profile.email,
            displayName: profile.name,
            emailVerifiedAt: profile.emailVerified ? new Date() : null,
          },
        });
        await tx.authProvider.create({
          data: {
            identityId: newIdentity.id,
            provider: 'GOOGLE',
            providerAccountId: profile.sub,
          },
        });
        const tenant = await tx.tenant.create({
          data: { name: tenantName, slug },
        });
        const membership = await tx.tenantMembership.create({
          data: {
            tenantId: tenant.id,
            identityId: newIdentity.id,
            role: 'OWNER',
          },
        });
        return { identity: newIdentity, tenant, membership };
      });

      return this.issueTokens(
        {
          identityId: created.identity.id,
          tenantId: created.tenant.id,
          membershipId: created.membership.id,
          role: created.membership.role,
        },
        meta,
      );
    }

    if (!existingProvider) {
      // Identity đã tồn tại (từng đăng ký bằng password) nhưng chưa link Google -> link thêm, không tạo Identity mới.
      // Không tin tưởng email trong idToken thay cho việc verify — googleVerifier.verify() ở trên đã verify
      // chữ ký + audience của Google, nên email này đáng tin, hợp lệ để link account theo email.
      await this.prisma.authProvider.create({
        data: {
          identityId: identity.id,
          provider: 'GOOGLE',
          providerAccountId: profile.sub,
        },
      });
    }

    // Identity đã tồn tại từ trước (có thể có 1 hoặc nhiều membership) -> dùng chung đúng 1 logic
    // "cross-tenant discovery + chọn tenant" với login() bằng password, không tự viết lại lần nữa.
    return this.resolveTenantAndIssueTokens(identity.id, tenantSlug, meta);
  }

  /**
   * GET /auth/me — trả data mới nhất từ DB, không chỉ decode lại JWT payload,
   * vì role/tenant/status có thể đã đổi giữa lúc access token còn hạn (15 phút) và lúc gọi.
   * payload.tenantId lấy từ JWT đã verify (đáng tin), nên dùng runInTenantContext bình thường,
   * KHÔNG cần this.system ở đây — khác với login()/refresh() vì ở đây đã biết chính xác tenant nào.
   */
  async getMe(payload: AccessTokenPayload) {
    const identity = await this.prisma.identity.findUniqueOrThrow({
      where: { id: payload.identityId },
      select: {
        id: true,
        email: true,
        displayName: true,
        emailVerifiedAt: true,
      },
    });

    const membership = await this.prisma.runInTenantContext(
      payload.tenantId,
      (tx) =>
        tx.tenantMembership.findUniqueOrThrow({
          where: { id: payload.membershipId },
          include: {
            tenant: {
              select: { id: true, name: true, slug: true, plan: true },
            },
          },
        }),
    );

    return {
      identity,
      tenant: membership.tenant,
      membership: {
        id: membership.id,
        role: membership.role,
        status: membership.status,
      },
    };
  }

  async logout(rawRefreshToken: string) {
    await this.refreshTokenService.revokeOne(rawRefreshToken);
  }

  async issueTokens(payload: AccessTokenPayload, meta?: RequestMeta) {
    const accessToken = this.signAccessToken(payload);
    const { raw: refreshToken } = await this.refreshTokenService.issue(
      payload.identityId,
      meta,
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

  /**
   * Dùng chung cho login() và loginWithGoogle(): identity đã xác thực xong (password hoặc Google),
   * giờ tra xem thuộc những tenant nào và quyết định phát token thẳng hay yêu cầu FE cho chọn tenant.
   * - 0 membership active -> lỗi "chưa thuộc tổ chức nào"
   * - có tenantSlug -> phải khớp đúng 1 trong các membership, sai thì 401
   * - không có tenantSlug + chỉ 1 membership -> phát token thẳng
   * - không có tenantSlug + nhiều membership -> trả requiresTenantSelection, KHÔNG phát token vội
   */
  private async resolveTenantAndIssueTokens(
    identityId: string,
    tenantSlug: string | undefined,
    meta?: RequestMeta,
  ): Promise<TokenPairResult | TenantSelectionResult> {
    // Cross-tenant discovery hợp lệ: identity đã xác thực xong (password hoặc Google) mới được
    // phép hỏi "identity này thuộc những tenant nào" — luôn qua this.system (BYPASSRLS), vì
    // app.current_tenant chưa set (chưa biết tenant nào) nên PrismaService thường sẽ bị RLS lọc rỗng.
    const activeMemberships = await this.system.tenantMembership.findMany({
      where: { identityId, status: 'ACTIVE' },
    });
    if (activeMemberships.length === 0) {
      throw new UnprocessableAppException(
        'Account is not a member of any organization',
        undefined,
        ErrorCode.AUTH_NO_TENANT_MEMBERSHIP,
      );
    }

    let membership = activeMemberships[0]!;
    if (tenantSlug) {
      const tenant = await this.system.tenant.findUnique({
        where: { slug: tenantSlug },
      });
      const match = activeMemberships.find((m) => m.tenantId === tenant?.id);
      if (!match) {
        throw new UnauthorizedAppException(
          'Not a member of this organization',
          ErrorCode.AUTH_TENANT_MISMATCH,
        );
      }
      membership = match;
    } else if (activeMemberships.length > 1) {
      // nhiều tenant, chưa chọn -> trả danh sách để FE hiển thị picker, không phát token vội
      return {
        requiresTenantSelection: true,
        tenants: activeMemberships.map((m) => ({
          tenantId: m.tenantId,
          role: m.role,
        })),
      };
    }

    return this.issueTokens(
      {
        identityId,
        tenantId: membership.tenantId,
        membershipId: membership.id,
        role: membership.role,
      },
      meta,
    );
  }
}
