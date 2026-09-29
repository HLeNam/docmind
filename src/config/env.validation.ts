import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test', 'provision'])
    .default('development'),

  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1),
  APP_DATABASE_URL: z.string().min(1),
  SYSTEM_DATABASE_URL: z.string().min(1),
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.coerce.number().int().positive().default(5432),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_NAME: z.string().min(1),

  JWT_SECRET: z.string().min(16),
  JWT_EXPIRES_IN: z.string().default('1d'),

  MAIL_PROVIDER: z.enum(['resend', 'smtp']),
  MAIL_FROM: z.string().min(1, 'MAIL_FROM must be provided'), // vd "DocMind <noreply@domain.com>"
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),

  // Chỉ bắt buộc có giá trị nếu MAIL_PROVIDER=resend
  RESEND_API_KEY: z.string().optional(),

  // Chỉ bắt buộc có giá trị nếu MAIL_PROVIDER=smtp (Gmail free / Mailtrap / Ethereal đều dùng chung 5 biến này)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z.coerce.boolean().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),

  // Chỉ bắt buộc có giá trị nếu MAIL_PROVIDER=brevo
  BREVO_API_KEY: z.string().optional(),
});

export type EnvSchema = z.infer<typeof envSchema>;
