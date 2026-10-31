import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CollectionsService } from './collections.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AccessTokenPayload } from '../auth/auth.service.js';
import {
  CreateCollectionSchema,
  UpdateCollectionSchema,
  CollectionResponseSchema,
} from './schemas/collection.schema.js';
import type {
  CreateCollectionDto,
  UpdateCollectionDto,
} from './dtos/collection.dto.js';
import { ApiZodResponse } from '../common/swagger/api-zod-response.decorator.js';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator.js';
import { z } from 'zod';

@ApiTags('collections')
@ApiBearerAuth('access-token')
@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

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

  @Get(':id')
  @ApiOperation({ summary: 'Get single collection details' })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Collection details',
    schema: CollectionResponseSchema,
  })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'Collection not found.')
  getById(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ) {
    return this.collectionsService.getById(user, id);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch(':id')
  @ApiOperation({ summary: 'Update collection details or custom instructions' })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Collection updated successfully',
    schema: CollectionResponseSchema,
  })
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'Access denied.')
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'Collection not found.')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body({ schema: UpdateCollectionSchema }) dto: UpdateCollectionDto,
  ) {
    return this.collectionsService.update(user, id, dto);
  }

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
