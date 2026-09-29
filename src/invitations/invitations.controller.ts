import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InvitationsService } from './invitations.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AccessTokenPayload } from '../auth/auth.service.js';
import type {
  AcceptInvitationDto,
  CreateInvitationDto,
} from './dtos/invitation.dto.js';
import {
  AcceptInvitationSchema,
  CreateInvitationSchema,
  InvitationResponseSchema,
  InvitationInfoResponseSchema,
} from './schemas/invitation.schema.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ApiZodResponse } from '../common/swagger/api-zod-response.decorator.js';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator.js';
import { TokensResponseSchema } from '../auth/schemas/auth.schema.js';

@ApiTags('invitations')
@Controller()
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  // KHÔNG @Public() — mặc định đã bị JwtAuthGuard chặn (mục 4.4), cộng thêm @Roles() chỉ cho
  // OWNER/ADMIN. :tenantId trên URL chỉ mang tính REST-ful, service luôn dùng tenantId từ JWT của
  // người gọi, không tin theo URL — xem ghi chú bảo mật trong InvitationsService.create().
  @Roles('OWNER', 'ADMIN')
  @ApiBearerAuth('access-token')
  @Post('tenants/:tenantId/invitations')
  @ApiOperation({
    summary: 'Create an invitation for the current organization (OWNER/ADMIN only)',
  })
  @ApiZodResponse({
    status: HttpStatus.CREATED,
    description: 'Invitation created successfully.',
    schema: InvitationResponseSchema,
  })
  @ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Unauthorized access.')
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'Insufficient permissions.')
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body({ schema: CreateInvitationSchema }) dto: CreateInvitationDto,
  ) {
    return this.invitationsService.create(user, dto);
  }

  // Cùng lý do bỏ qua :tenantId trên URL như create() — invitationId đủ để định danh, tenant
  // được xác định lại từ JWT bên trong service qua runInTenantContext.
  @Roles('OWNER', 'ADMIN')
  @ApiBearerAuth('access-token')
  @Delete('tenants/:tenantId/invitations/:invitationId')
  @ApiOperation({
    summary: 'Revoke a pending invitation (OWNER/ADMIN only)',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Invitation revoked successfully.',
    schema: InvitationResponseSchema,
  })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'Invitation not found.')
  @ApiErrorResponse(HttpStatus.UNPROCESSABLE_ENTITY, 'Invitation has already been accepted and cannot be revoked.')
  revoke(
    @CurrentUser() user: AccessTokenPayload,
    @Param('invitationId') invitationId: string,
  ) {
    return this.invitationsService.revoke(user, invitationId);
  }

  @Public()
  @Get('invitations/:token')
  @ApiOperation({
    summary: 'Get invitation details before accepting (no authentication required)',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Returns basic information about the invitation.',
    schema: InvitationInfoResponseSchema,
  })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'Invitation not found.')
  @ApiErrorResponse(HttpStatus.UNPROCESSABLE_ENTITY, 'Invitation has expired, been revoked, or already accepted.')
  findByToken(@Param('token') token: string) {
    return this.invitationsService.findByToken(token);
  }

  @Public()
  @Post('invitations/:token/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Accept invitation — creates a new account if needed, and returns login tokens',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Invitation accepted successfully. Returns access and refresh tokens.',
    schema: TokensResponseSchema,
  })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'Invitation not found.')
  @ApiErrorResponse(HttpStatus.UNPROCESSABLE_ENTITY, 'Invitation is invalid (expired/revoked/used) or user is already a member.')
  @ApiErrorResponse(HttpStatus.BAD_REQUEST, 'Password is required for new accounts.')
  accept(
    @Param('token') token: string,
    @Body({ schema: AcceptInvitationSchema }) dto: AcceptInvitationDto,
  ) {
    return this.invitationsService.accept(token, dto);
  }
}
