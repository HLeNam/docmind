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
import { CreateCollectionSchema } from './schemas/collection.schema.js';
import type { CreateCollectionDto } from './dtos/collection.dto.js';

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
  delete(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.collectionsService.delete(user, id);
  }
}
