import { z } from 'zod';

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']),
});

export const MemberResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  identityId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER']),
  status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED']),
  joinedAt: z.date(),
});

export const MemberListResponseSchema = z.array(MemberResponseSchema);

export const RemoveMemberResponseSchema = z.object({
  id: z.string().uuid(),
  removed: z.literal(true),
});
