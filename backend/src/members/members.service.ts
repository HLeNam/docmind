import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AccessTokenPayload } from '../auth/auth.service.js';
import type { UpdateMemberRoleDto } from './dtos/member.dto.js';
import {
  ForbiddenAppException,
  NotFoundAppException,
  UnprocessableAppException,
} from '../common/exceptions/app.exception.js';
import { ErrorCode } from '../common/exceptions/error-codes.js';

@Injectable()
export class MembersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Danh sách thành viên của tenant hiện tại.
   * Chạy trong runInTenantContext để đảm bảo tenant isolation.
   */
  async list(caller: AccessTokenPayload) {
    return this.prisma.runInTenantContext(caller.tenantId, async (tx) => {
      const memberships = await tx.tenantMembership.findMany({
        where: { tenantId: caller.tenantId },
        include: {
          identity: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      });

      return memberships.map((m) => ({
        id: m.id,
        tenantId: m.tenantId,
        identityId: m.identityId,
        email: m.identity.email,
        displayName: m.identity.displayName,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt,
      }));
    });
  }

  /**
   * Thay đổi vai trò (ADMIN <-> MEMBER) của 1 thành viên.
   * Chỉ OWNER/ADMIN được gọi.
   */
  async updateRole(
    caller: AccessTokenPayload,
    memberId: string,
    dto: UpdateMemberRoleDto,
  ) {
    return this.prisma.runInTenantContext(caller.tenantId, async (tx) => {
      const target = await tx.tenantMembership.findUnique({
        where: { id: memberId },
        include: {
          identity: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      });

      if (!target || target.tenantId !== caller.tenantId) {
        throw new NotFoundAppException(ErrorCode.MEMBER_NOT_FOUND);
      }

      // Nếu target đang là OWNER
      if (target.role === 'OWNER') {
        if (caller.role !== 'OWNER') {
          throw new ForbiddenAppException(ErrorCode.CANNOT_MODIFY_OWNER);
        }
        const ownerCount = await tx.tenantMembership.count({
          where: { tenantId: caller.tenantId, role: 'OWNER' },
        });
        if (ownerCount <= 1) {
          throw new UnprocessableAppException(ErrorCode.CANNOT_DEMOTE_LAST_OWNER);
        }
      }

      // ADMIN không được phép hạ vai trò của ADMIN khác
      if (
        caller.role === 'ADMIN' &&
        target.role === 'ADMIN' &&
        caller.membershipId !== target.id
      ) {
        throw new ForbiddenAppException(ErrorCode.FORBIDDEN);
      }

      const updated = await tx.tenantMembership.update({
        where: { id: memberId },
        data: { role: dto.role },
        include: {
          identity: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      });

      return {
        id: updated.id,
        tenantId: updated.tenantId,
        identityId: updated.identityId,
        email: updated.identity.email,
        displayName: updated.identity.displayName,
        role: updated.role,
        status: updated.status,
        joinedAt: updated.joinedAt,
      };
    });
  }

  /**
   * Xóa một thành viên khỏi workspace.
   * Chỉ OWNER/ADMIN được gọi.
   */
  async remove(caller: AccessTokenPayload, memberId: string) {
    return this.prisma.runInTenantContext(caller.tenantId, async (tx) => {
      const target = await tx.tenantMembership.findUnique({
        where: { id: memberId },
      });

      if (!target || target.tenantId !== caller.tenantId) {
        throw new NotFoundAppException(ErrorCode.MEMBER_NOT_FOUND);
      }

      if (target.role === 'OWNER') {
        if (caller.role !== 'OWNER') {
          throw new ForbiddenAppException(ErrorCode.CANNOT_MODIFY_OWNER);
        }
        const ownerCount = await tx.tenantMembership.count({
          where: { tenantId: caller.tenantId, role: 'OWNER' },
        });
        if (ownerCount <= 1) {
          throw new UnprocessableAppException(ErrorCode.CANNOT_REMOVE_LAST_OWNER);
        }
      }

      if (
        caller.role === 'ADMIN' &&
        target.role === 'ADMIN' &&
        caller.membershipId !== target.id
      ) {
        throw new ForbiddenAppException(ErrorCode.FORBIDDEN);
      }

      await tx.tenantMembership.delete({
        where: { id: memberId },
      });

      return {
        id: memberId,
        removed: true as const,
      };
    });
  }
}
