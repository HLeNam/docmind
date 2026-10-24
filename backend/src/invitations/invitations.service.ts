import * as argon2 from 'argon2';

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrismaSystemService } from '../prisma/prisma-system.service.js';
import { AccessTokenPayload, AuthService } from '../auth/auth.service.js';
import {
  AcceptInvitationDto,
  CreateInvitationDto,
} from './dtos/invitation.dto.js';
import { randomBytes } from 'crypto';
import {
  NotFoundAppException,
  UnprocessableAppException,
  ValidationAppException,
} from '../common/exceptions/app.exception.js';
import { ErrorCode } from '../common/exceptions/error-codes.js';
import { MailService } from '../mail/mail.service.js';

const INVITATION_TTL_DAYS = 7;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    // BYPASSRLS — chỉ dùng để tra Invitation theo token khi CHƯA có tenant context
    // (người được mời chưa đăng nhập, chưa có JWT nào để biết tenant).
    private readonly system: PrismaSystemService,
    private readonly authService: AuthService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Tạo lời mời — caller (Owner/Admin) đã biết chính xác tenant của mình từ JWT.
   * QUAN TRỌNG: dùng inviter.tenantId từ JWT đã verify, KHÔNG dùng :tenantId trên URL —
   * nếu tin theo URL, 1 Admin của tenant A có thể sửa URL để tạo invitation cho tenant B.
   */
  async create(inviter: AccessTokenPayload, dto: CreateInvitationDto) {
    const token = randomBytes(32).toString('hex');

    // Lấy tenant name (để đưa vào nội dung email) ngay trong cùng transaction đã có tenant context,
    // không query thêm lần nào ngoài transaction.
    const { invitation, tenantName } = await this.prisma.runInTenantContext(
      inviter.tenantId,
      async (tx) => {
        const invitation = await tx.invitation.create({
          data: {
            tenantId: inviter.tenantId,
            email: dto.email,
            role: dto.role,
            token,
            invitedById: inviter.membershipId,
            expiresAt: new Date(
              Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
            ),
          },
        });
        const tenant = await tx.tenant.findUniqueOrThrow({
          where: { id: inviter.tenantId },
          select: { name: true },
        });
        return { invitation, tenantName: tenant.name };
      },
    );

    // Identity không có RLS, query riêng ngoài transaction ở trên cũng được, không cần tenant context.
    const inviterIdentity = await this.prisma.identity.findUniqueOrThrow({
      where: { id: inviter.identityId },
      select: { email: true },
    });

    // Gửi email SAU khi đã lưu DB thành công — invitation vẫn tồn tại và dùng được (qua token trả
    // về ở response) kể cả nếu bước gửi mail bên dưới thất bại (MailService tự log, không throw).
    await this.mailService.sendInvitationEmail({
      to: invitation.email,
      tenantName,
      inviterEmail: inviterIdentity.email,
      token: invitation.token,
    });

    return invitation;
  }

  /**
   * Thu hồi lời mời trước khi bị accept/hết hạn — vd gửi nhầm email, đổi ý về role.
   * Chạy trong runInTenantContext(inviter.tenantId) nên RLS tự đảm bảo invitation phải thuộc
   * đúng tenant của người gọi — không cần tự viết thêm check "invitation.tenantId === inviter.tenantId",
   * Postgres tự trả 0 row nếu invitationId thuộc tenant khác, findUniqueOrThrow tự thành NotFound.
   */
  async revoke(inviter: AccessTokenPayload, invitationId: string) {
    return this.prisma.runInTenantContext(inviter.tenantId, async (tx) => {
      const invitation = await tx.invitation.findUnique({
        where: { id: invitationId },
      });
      if (!invitation)
        throw new NotFoundAppException(ErrorCode.INVITATION_NOT_FOUND);
      if (invitation.acceptedAt) {
        throw new UnprocessableAppException(
          ErrorCode.INVITATION_ALREADY_ACCEPTED,
        );
      }
      return tx.invitation.update({
        where: { id: invitationId },
        data: { revokedAt: new Date() },
      });
    });
  }

  /**
   * Xem thông tin invitation trước khi accept — người gọi CHƯA đăng nhập, chưa biết tenant nào.
   * Đúng pattern cross-tenant discovery đã gặp ở AuthService: tra theo token (random, không đoán
   * được, không phải input tuỳ ý kiểu tenantId) qua PrismaSystemService.
   */
  async findByToken(token: string) {
    const invitation = await this.system.invitation.findUnique({
      where: { token },
      include: { tenant: { select: { name: true, slug: true } } },
    });
    if (!invitation)
      throw new NotFoundAppException(ErrorCode.INVITATION_NOT_FOUND);
    this.assertPending(invitation);

    return {
      email: invitation.email,
      role: invitation.role,
      tenantName: invitation.tenant.name,
      expiresAt: invitation.expiresAt,
    };
  }

  async accept(token: string, dto: AcceptInvitationDto) {
    const invitation = await this.system.invitation.findUnique({
      where: { token },
    });
    if (!invitation)
      throw new NotFoundAppException(ErrorCode.INVITATION_NOT_FOUND);
    this.assertPending(invitation);

    let identity = await this.prisma.identity.findUnique({
      where: { email: invitation.email },
    });

    if (!identity) {
      // Email trong invitation chưa có tài khoản nào -> bắt buộc phải có password để tạo mới
      if (!dto.password) {
        throw new ValidationAppException(
          ErrorCode.INVITATION_PASSWORD_REQUIRED,
          {
            password: ['Required because this email has no existing account'],
          },
        );
      }
      const passwordHash = await argon2.hash(dto.password);
      identity = await this.system.$transaction(async (tx) => {
        const newIdentity = await tx.identity.create({
          data: { email: invitation.email },
        });
        await tx.authProvider.create({
          data: {
            identityId: newIdentity.id,
            provider: 'PASSWORD',
            passwordHash,
          },
        });
        return newIdentity;
      });
    }

    // Tạo membership + đánh dấu invitation đã accept cùng lúc, cùng 1 transaction để không bị
    // nửa vời (vd tạo membership xong nhưng invitation vẫn chưa đánh dấu, có thể bị accept lần 2).
    // Dùng this.system vì đây là thao tác trên đúng 1 tenant đã biết (invitation.tenantId),
    // nhưng identity vừa được tạo ở nhánh trên nên dùng luôn system cho nhất quán trong transaction.
    const membership = await this.system.$transaction(async (tx) => {
      const existing = await tx.tenantMembership.findUnique({
        where: {
          tenantId_identityId: {
            tenantId: invitation.tenantId,
            identityId: identity.id,
          },
        },
      });
      if (existing) {
        throw new UnprocessableAppException(
          ErrorCode.INVITATION_ALREADY_MEMBER,
        );
      }

      const created = await tx.tenantMembership.create({
        data: {
          tenantId: invitation.tenantId,
          identityId: identity.id,
          role: invitation.role,
        },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
      return created;
    });

    // Đăng nhập luôn cho người dùng ngay sau khi accept — tránh bắt họ gõ lại password lần nữa.
    return this.authService.issueTokens({
      identityId: identity.id,
      tenantId: membership.tenantId,
      membershipId: membership.id,
      role: membership.role,
    });
  }

  private assertPending(invitation: {
    acceptedAt: Date | null;
    revokedAt: Date | null;
    expiresAt: Date;
  }) {
    // Schema thật của bạn không có field `status`/enum `InvitationStatus` — dùng 2 cột nullable
    // (`acceptedAt`, `revokedAt`, xem mục 5.0) thay cho 1 enum trạng thái tập trung.
    if (invitation.acceptedAt) {
      throw new UnprocessableAppException(
        ErrorCode.INVITATION_ALREADY_ACCEPTED,
      );
    }
    if (invitation.revokedAt) {
      throw new UnprocessableAppException(ErrorCode.INVITATION_REVOKED);
    }
    if (invitation.expiresAt < new Date()) {
      throw new UnprocessableAppException(ErrorCode.INVITATION_EXPIRED);
    }
  }
}
