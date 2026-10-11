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
import { CollectionsService } from './collections.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AccessTokenPayload } from '../auth/auth.service.js';
import {
  CreateCollectionSchema,
  CollectionResponseSchema,
} from './schemas/collection.schema.js';
import type { CreateCollectionDto } from './dtos/collection.dto.js';
import { ApiZodResponse } from '../common/swagger/api-zod-response.decorator.js';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator.js';
import { z } from 'zod';

@ApiTags('collections')
@ApiBearerAuth('access-token')
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  // Chỉ OWNER/ADMIN được tạo collection — MEMBER chỉ được gán quyền đọc vào collection có sẵn
  // (qua CollectionAccess, Phase 2 chưa có API riêng cho việc gán này — xem "Đã hoãn có chủ đích").
  @Roles('OWNER', 'ADMIN')
  @Post()
  @ApiOperation({ summary: 'Create new collection in current tenant' })
  @ApiZodResponse({
    status: HttpStatus.CREATED,
    description: 'Collection created successfully',
    schema: CollectionResponseSchema,
  })
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'Access denied.')
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body({ schema: CreateCollectionSchema }) dto: CreateCollectionDto,
  ) {
    return this.collectionsService.create(user, dto);
  }

  // Không @Roles() riêng: mọi role đăng nhập được xem danh sách (OWNER/ADMIN thấy tất cả,
  // MEMBER chỉ thấy collection mình được gán — lọc ngay trong CollectionsService.list()).
  @Get()
  @ApiOperation({ summary: 'List collections that caller is allowed to see' })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'List of accessible collections',
    schema: z.array(CollectionResponseSchema),
  })
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.collectionsService.list(user);
  }

  // Chỉ OWNER/ADMIN được xoá — xoá collection kéo theo xoá toàn bộ document bên trong (Cascade),
  // một hành động phá hoại không nên để MEMBER tự làm.
  @Roles('OWNER', 'ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete collection (cascade delete all documents inside)',
  })
  @ApiZodResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Collection deleted successfully',
    schema: z.null(),
  })
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'Access denied.')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'Collection not found.')
  delete(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.collectionsService.delete(user, id);
  }
}
