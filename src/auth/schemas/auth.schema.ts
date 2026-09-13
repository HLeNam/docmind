import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email('Email not valid'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  tenantName: z.string().min(1, 'Tenant name cannot be empty'),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  // optional: nếu 1 identity có nhiều membership, FE gửi kèm slug để login thẳng vào 1 tenant
  tenantSlug: z.string().optional(),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});
