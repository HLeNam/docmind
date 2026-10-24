import { z } from 'zod';

export const CreateInvitationSchema = z.object({
  email: z.string().email('Email is not valid'),
  // Không cho mời thẳng role OWNER qua invitation — OWNER chỉ có được lúc register (tạo tenant).
  role: z.enum(['ADMIN', 'MEMBER']),
});

export const AcceptInvitationSchema = z.object({
  // Bắt buộc nếu email trong invitation CHƯA có tài khoản nào — dùng để tạo Identity mới.
  // Nếu email đã có tài khoản rồi thì bỏ qua field này (không tạo lại password).
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .optional(),
});

export const InvitationResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string().email(),
  role: z.string(),
  token: z.string(),
  invitedById: z.string().uuid(),
  acceptedAt: z.date().nullable(),
  revokedAt: z.date().nullable(),
  expiresAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const InvitationInfoResponseSchema = z.object({
  email: z.string().email(),
  role: z.string(),
  tenantName: z.string(),
  expiresAt: z.date(),
});
