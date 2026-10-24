import { z } from 'zod';

import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  GoogleLoginSchema,
} from '../schemas/auth.schema.js';

export type RegisterDto = z.infer<typeof RegisterSchema>;

export type LoginDto = z.infer<typeof LoginSchema>;

export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;

export type GoogleLoginDto = z.infer<typeof GoogleLoginSchema>;
