import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ApiZodResponse } from '../common/swagger/api-zod-response.decorator.js';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator.js';
import type { AccessTokenPayload } from '../auth/auth.service.js';
import { MembersService } from './members.service.js';
import {
  MemberListResponseSchema,
  MemberResponseSchema,
  RemoveMemberResponseSchema,
  UpdateMemberRoleSchema,
} from './schemas/member.schema.js';
import type { UpdateMemberRoleDto } from './dtos/member.dto.js';

@ApiTags('members')
@ApiBearerAuth('access-token')
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  @ApiOperation({
    summary: 'List all members in the current workspace',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'List of members in workspace',
    schema: MemberListResponseSchema,
  })
  @ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Unauthorized')
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.membersService.list(user);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch(':id')
  @ApiOperation({
    summary: 'Update member role (OWNER/ADMIN only)',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Updated member details',
    schema: MemberResponseSchema,
  })
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'Insufficient permissions')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'Member not found')
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Cannot demote the last owner of the workspace',
  )
  updateRole(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') memberId: string,
    @Body({ schema: UpdateMemberRoleSchema }) dto: UpdateMemberRoleDto,
  ) {
    return this.membersService.updateRole(user, memberId, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Delete(':id')
  @ApiOperation({
    summary: 'Remove member from workspace (OWNER/ADMIN only)',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Member removed successfully',
    schema: RemoveMemberResponseSchema,
  })
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'Insufficient permissions')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'Member not found')
  @ApiErrorResponse(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'Cannot remove the last owner of the workspace',
  )
  remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') memberId: string,
  ) {
    return this.membersService.remove(user, memberId);
  }
}
