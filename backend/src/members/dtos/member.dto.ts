import type { z } from 'zod';
import type { UpdateMemberRoleSchema } from '../schemas/member.schema.js';

export type UpdateMemberRoleDto = z.infer<typeof UpdateMemberRoleSchema>;
