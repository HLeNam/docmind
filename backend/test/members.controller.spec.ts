import { describe, expect, it, vi } from 'vitest';
import { MembersController } from '../src/members/members.controller.js';
import type { AccessTokenPayload } from '../src/auth/auth.service.js';

const CALLER: AccessTokenPayload = {
  identityId: 'id-1',
  tenantId: 'tenant-1',
  membershipId: 'mem-1',
  role: 'OWNER',
};

describe('MembersController', () => {
  it('list delegates to membersService.list', async () => {
    const mockMembers = [{ id: 'm1', email: 'test@docmind.local' }];
    const svc = {
      list: vi.fn(async () => mockMembers),
    };
    const controller = new MembersController(svc as any);

    const result = await controller.list(CALLER);

    expect(svc.list).toHaveBeenCalledWith(CALLER);
    expect(result).toBe(mockMembers);
  });

  it('updateRole delegates to membersService.updateRole', async () => {
    const svc = {
      updateRole: vi.fn(async () => ({ id: 'm1', role: 'ADMIN' })),
    };
    const controller = new MembersController(svc as any);

    const result = await controller.updateRole(CALLER, 'm1', { role: 'ADMIN' });

    expect(svc.updateRole).toHaveBeenCalledWith(CALLER, 'm1', { role: 'ADMIN' });
    expect(result).toEqual({ id: 'm1', role: 'ADMIN' });
  });

  it('remove delegates to membersService.remove', async () => {
    const svc = {
      remove: vi.fn(async () => ({ id: 'm1', removed: true })),
    };
    const controller = new MembersController(svc as any);

    const result = await controller.remove(CALLER, 'm1');

    expect(svc.remove).toHaveBeenCalledWith(CALLER, 'm1');
    expect(result).toEqual({ id: 'm1', removed: true });
  });
});
