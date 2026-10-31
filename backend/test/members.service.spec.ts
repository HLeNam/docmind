import { describe, expect, it, vi } from 'vitest';
import { MembersService } from '../src/members/members.service.js';
import type { AccessTokenPayload } from '../src/auth/auth.service.js';
import {
  ForbiddenAppException,
  NotFoundAppException,
  UnprocessableAppException,
} from '../src/common/exceptions/app.exception.js';

const OWNER_CALLER: AccessTokenPayload = {
  identityId: 'id-owner',
  tenantId: 'tenant-1',
  membershipId: 'mem-owner',
  role: 'OWNER',
};

const ADMIN_CALLER: AccessTokenPayload = {
  identityId: 'id-admin',
  tenantId: 'tenant-1',
  membershipId: 'mem-admin',
  role: 'ADMIN',
};

function buildService() {
  const tx = {
    tenantMembership: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  const prisma = {
    runInTenantContext: vi.fn(async (_tenantId, callback) => callback(tx)),
  };

  const service = new MembersService(prisma as any);
  return { service, tx, prisma };
}

describe('MembersService', () => {
  describe('list', () => {
    it('returns formatted members belonging to the tenant', async () => {
      const { service, tx, prisma } = buildService();
      const mockMembers = [
        {
          id: 'mem-1',
          tenantId: 'tenant-1',
          identityId: 'id-1',
          role: 'OWNER',
          status: 'ACTIVE',
          joinedAt: new Date('2026-01-01'),
          identity: {
            id: 'id-1',
            email: 'owner@docmind.local',
            displayName: 'Owner User',
          },
        },
      ];
      tx.tenantMembership.findMany.mockResolvedValue(mockMembers);

      const result = await service.list(OWNER_CALLER);

      expect(prisma.runInTenantContext).toHaveBeenCalledWith('tenant-1', expect.any(Function));
      expect(result).toEqual([
        {
          id: 'mem-1',
          tenantId: 'tenant-1',
          identityId: 'id-1',
          email: 'owner@docmind.local',
          displayName: 'Owner User',
          role: 'OWNER',
          status: 'ACTIVE',
          joinedAt: new Date('2026-01-01'),
        },
      ]);
    });
  });

  describe('updateRole', () => {
    it('updates role successfully when valid', async () => {
      const { service, tx } = buildService();
      tx.tenantMembership.findUnique.mockResolvedValue({
        id: 'mem-2',
        tenantId: 'tenant-1',
        role: 'MEMBER',
        identity: { id: 'id-2', email: 'user@docmind.local', displayName: 'User' },
      });
      tx.tenantMembership.update.mockResolvedValue({
        id: 'mem-2',
        tenantId: 'tenant-1',
        identityId: 'id-2',
        role: 'ADMIN',
        status: 'ACTIVE',
        joinedAt: new Date('2026-02-01'),
        identity: { id: 'id-2', email: 'user@docmind.local', displayName: 'User' },
      });

      const result = await service.updateRole(OWNER_CALLER, 'mem-2', { role: 'ADMIN' });

      expect(tx.tenantMembership.update).toHaveBeenCalledWith({
        where: { id: 'mem-2' },
        data: { role: 'ADMIN' },
        include: {
          identity: {
            select: { id: true, email: true, displayName: true },
          },
        },
      });
      expect(result.role).toBe('ADMIN');
    });

    it('throws NotFoundAppException if member not found', async () => {
      const { service, tx } = buildService();
      tx.tenantMembership.findUnique.mockResolvedValue(null);

      await expect(
        service.updateRole(OWNER_CALLER, 'non-existent', { role: 'ADMIN' }),
      ).rejects.toThrow(NotFoundAppException);
    });

    it('throws ForbiddenAppException if non-owner tries to demote an owner', async () => {
      const { service, tx } = buildService();
      tx.tenantMembership.findUnique.mockResolvedValue({
        id: 'mem-owner',
        tenantId: 'tenant-1',
        role: 'OWNER',
        identity: { id: 'id-1', email: 'owner@docmind.local' },
      });

      await expect(
        service.updateRole(ADMIN_CALLER, 'mem-owner', { role: 'ADMIN' }),
      ).rejects.toThrow(ForbiddenAppException);
    });

    it('throws UnprocessableAppException if trying to demote the last owner', async () => {
      const { service, tx } = buildService();
      tx.tenantMembership.findUnique.mockResolvedValue({
        id: 'mem-owner',
        tenantId: 'tenant-1',
        role: 'OWNER',
        identity: { id: 'id-1', email: 'owner@docmind.local' },
      });
      tx.tenantMembership.count.mockResolvedValue(1);

      await expect(
        service.updateRole(OWNER_CALLER, 'mem-owner', { role: 'ADMIN' }),
      ).rejects.toThrow(UnprocessableAppException);
    });
  });

  describe('remove', () => {
    it('removes member successfully', async () => {
      const { service, tx } = buildService();
      tx.tenantMembership.findUnique.mockResolvedValue({
        id: 'mem-3',
        tenantId: 'tenant-1',
        role: 'MEMBER',
      });
      tx.tenantMembership.delete.mockResolvedValue({ id: 'mem-3' });

      const result = await service.remove(OWNER_CALLER, 'mem-3');

      expect(tx.tenantMembership.delete).toHaveBeenCalledWith({
        where: { id: 'mem-3' },
      });
      expect(result).toEqual({ id: 'mem-3', removed: true });
    });

    it('throws UnprocessableAppException if removing last owner', async () => {
      const { service, tx } = buildService();
      tx.tenantMembership.findUnique.mockResolvedValue({
        id: 'mem-owner',
        tenantId: 'tenant-1',
        role: 'OWNER',
      });
      tx.tenantMembership.count.mockResolvedValue(1);

      await expect(service.remove(OWNER_CALLER, 'mem-owner')).rejects.toThrow(
        UnprocessableAppException,
      );
    });
  });
});
