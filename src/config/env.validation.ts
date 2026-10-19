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

  GOOGLE_CLIENT_ID: z.string().min(1),

  MAIL_PROVIDER: z.enum(['resend', 'smtp', 'brevo']),
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

  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('us-east-1'), // MinIO không thật sự dùng region, nhưng SDK yêu cầu có giá trị
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default(true), // true cho MinIO local; AWS S3 thật thì set false

  REDIS_URL: z.string().url(),

  EMBEDDING_PROVIDER: z
    .enum(['openai', 'gemini', 'jina', 'ollama'])
    .default('openai'),
  JINA_API_KEY: z.string().optional(),
  JINA_EMBEDDING_MODEL: z.string().default('jina-embeddings-v4'),
  JINA_EMBEDDING_DIMENSIONS: z.coerce.number().default(1536),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_EMBEDDING_MODEL: z.string().default('gemini-embedding-001'),
  GEMINI_EMBEDDING_DIMENSIONS: z.coerce.number().default(1536),
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_EMBEDDING_MODEL: z.string().default('nomic-embed-text'),

  LLM_PROVIDER: z.enum(['gemini']).default('gemini'),
  GEMINI_CHAT_MODEL: z.string().default('gemini-3.8-flash'),

  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(), // dùng ở 4.5
  SLACK_REDIRECT_URI: z.string().url().optional(),
  SLACK_TOKEN_ENCRYPTION_KEY: z.string().optional(), // base64 của 32 byte: openssl rand -base64 32
  SLACK_TOKEN_ENCRYPTION_KEYS_OLD: z.string().optional(),
});

export type EnvSchema = z.infer<typeof envSchema>;
