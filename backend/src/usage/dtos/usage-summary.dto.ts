import { z } from 'zod';
import {
  UsageSummaryQuerySchema,
  UsageSummaryResponseSchema,
} from '../schemas/usage-summary.schema.js';

export type UsageSummaryQueryDto = z.infer<typeof UsageSummaryQuerySchema>;

export type UsageSummary = z.infer<typeof UsageSummaryResponseSchema>;
