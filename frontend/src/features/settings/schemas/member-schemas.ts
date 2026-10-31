import { z } from "zod";

export const memberRoleSchema = z.enum(["OWNER", "ADMIN", "MEMBER"]);
export type MemberRole = z.infer<typeof memberRoleSchema>;

export const memberStatusSchema = z.enum(["INVITED", "ACTIVE", "SUSPENDED"]);
export type MemberStatus = z.infer<typeof memberStatusSchema>;

export const updateMemberRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"], {
    errorMap: () => ({ message: "Vai trò phải là ADMIN hoặc MEMBER" }),
  }),
});
export type UpdateMemberRoleFormData = z.infer<typeof updateMemberRoleSchema>;

export const memberItemSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  identityId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  role: memberRoleSchema,
  status: memberStatusSchema,
  joinedAt: z.string(),
});
export type MemberItem = z.infer<typeof memberItemSchema>;

export const removeMemberResponseSchema = z.object({
  id: z.string().uuid(),
  removed: z.literal(true),
});
export type RemoveMemberResponse = z.infer<typeof removeMemberResponseSchema>;
