import { z } from 'zod';

import {
  AcceptInvitationSchema,
  CreateInvitationSchema,
} from '../schemas/invitation.schema.js';

export type CreateInvitationDto = z.infer<typeof CreateInvitationSchema>;

export type AcceptInvitationDto = z.infer<typeof AcceptInvitationSchema>;
