import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ApiZodResponse } from '../common/swagger/api-zod-response.decorator.js';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator.js';
import type { AccessTokenPayload } from '../auth/auth.service.js';
import { UsageSummaryService } from './usage-summary.service.js';
import {
  UsageSummaryQuerySchema,
  UsageSummaryResponseSchema,
} from './schemas/usage-summary.schema.js';
import { type UsageSummaryQueryDto } from './dtos/usage-summary.dto.js';

// Số liệu tiêu thụ/chi phí của cả tenant -> chỉ OWNER/ADMIN (như API key). JwtAuthGuard + RolesGuard là global.
@ApiTags('usage')
@ApiBearerAuth('access-token')
@Roles('OWNER', 'ADMIN')
@Controller('usage')
export class UsageController {
  constructor(private readonly summaryService: UsageSummaryService) {}

  @Get('summary')
  @ApiOperation({
    summary:
      'Aggregated token usage and cost for the tenant by type (GENERATION/EMBEDDING) and UTC date. Defaults to last 30 days, max 366 days. Gemini embedding tokens are estimated.',
  })
  @ApiZodResponse({
    status: 200,
    description: 'Aggregated usage summary',
    schema: UsageSummaryResponseSchema,
  })
  @ApiErrorResponse(
    400,
    'Invalid from/to date format, from > to, or range exceeds 366 days',
  )
  @ApiErrorResponse(403, 'Forbidden (OWNER/ADMIN only)')
  summary(
    @CurrentUser() user: AccessTokenPayload,
    @Query({ schema: UsageSummaryQuerySchema }) query: UsageSummaryQueryDto,
  ) {
    return this.summaryService.summary(user, query);
  }
}
