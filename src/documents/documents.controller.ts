import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  DocumentsService,
  type UploadedFileLike,
} from './documents.service.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import {
  MAX_DOCUMENT_SIZE_BYTES,
  UploadDocumentMetaSchema,
  DocumentResponseSchema,
  DocumentStatusResponseSchema,
} from './schemas/document.schema.js';
import { ApiZodResponse } from '../common/swagger/api-zod-response.decorator.js';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator.js';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AccessTokenPayload } from '../auth/auth.service.js';

@ApiTags('documents')
@ApiBearerAuth('access-token')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // Đúng bảng phân quyền spec 3.4.2: chỉ OWNER/ADMIN được upload — MEMBER chỉ đọc/chat.
  @Roles('OWNER', 'ADMIN')
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload document to a collection, enqueue async processing job',
  })
  @ApiZodResponse({
    status: HttpStatus.CREATED,
    description: 'Document uploaded and queued for processing',
    schema: DocumentResponseSchema,
  })
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'You do not have permission to upload to this collection.')
  @ApiErrorResponse(HttpStatus.UNPROCESSABLE_ENTITY, 'Invalid file type or file size exceeded.')
  // Dùng MAX_DOCUMENT_SIZE_BYTES (ngưỡng tuyệt đối, lớn nhất trong 2 mức) ở đây — Multer chỉ hỗ
  // trợ 1 con số chung, không phân biệt theo mimetype. Ngưỡng nhỏ hơn cho CSV/XLSX được kiểm tra
  // tinh hơn ở DocumentsService.upload() (đã biết chính xác mimetype lúc đó).
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_DOCUMENT_SIZE_BYTES } }),
  )
  upload(
    @CurrentUser() user: AccessTokenPayload,
    @UploadedFile() file: UploadedFileLike,
    // collectionId truyền qua query thay vì field multipart (StandardSchemaValidationPipe không áp
    // dụng cho multipart body) — nhưng vẫn PHẢI gắn { schema } như mọi route khác, tái dùng field
    // đã khai ở UploadDocumentMetaSchema thay vì để lọt qua không validate.
    @Query('collectionId', {
      schema: UploadDocumentMetaSchema.shape.collectionId,
    })
    collectionId: string,
  ) {
    return this.documentsService.upload(user, collectionId, file);
  }

  @Get()
  @ApiOperation({
    summary:
      'List documents, optionally filter by collection (auto-filtered by access rights)',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'List of documents',
    schema: z.array(DocumentResponseSchema),
  })
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query('collectionId') collectionId?: string,
  ) {
    return this.documentsService.list(user, collectionId);
  }

  @Get(':id/status')
  @ApiOperation({
    summary:
      'Processing status (polling) — or use WebSocket document.progress later',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Document status',
    schema: DocumentStatusResponseSchema,
  })
  @ApiErrorResponse(HttpStatus.NOT_FOUND, 'Document not found or access denied.')
  getStatus(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.documentsService.getStatus(user, id);
  }

  @Roles('OWNER', 'ADMIN')
  @Post(':id/reindex')
  @ApiOperation({ summary: 'Re-index — delete old chunks, re-enqueue processing job' })
  @ApiZodResponse({
    status: HttpStatus.CREATED,
    description: 'Document re-queued for processing',
    schema: z.object({ id: z.string(), status: z.string() }),
  })
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'Access denied.')
  reindex(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.documentsService.reindex(user, id);
  }

  @Roles('OWNER', 'ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete document (hard delete — see notes in DocumentsService)',
  })
  @ApiZodResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Document deleted successfully',
    schema: z.null(),
  })
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'Access denied.')
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.documentsService.remove(user, id);
  }
}
