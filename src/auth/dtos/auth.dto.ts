import { z } from 'zod';

import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
} from '../schemas/auth.schema.js';

export type RegisterDto = z.infer<typeof RegisterSchema>;

export type LoginDto = z.infer<typeof LoginSchema>;

export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;
