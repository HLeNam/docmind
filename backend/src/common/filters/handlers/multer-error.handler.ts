// Điểm mở rộng Phase 1 đã dự trù sẵn: "Thêm loại lỗi mới... tạo 1 handler mới trong
// filters/handlers/, nhớ đặt TRƯỚC UnknownErrorHandler". Không có handler này thì MulterError
// (vd file vượt quá fileSize khai trong FileInterceptor) rơi vào UnknownErrorHandler, trả 500
// chung chung thay vì 422 rõ nghĩa cho FE hiển thị đúng thông báo.
import { HttpStatus } from '@nestjs/common';
import { MulterError } from 'multer';
import type {
  ExceptionHandler,
  ExceptionContext,
  ExceptionHandlerResult,
} from './exception-handler.interface.js';

export class MulterErrorHandler implements ExceptionHandler {
  supports(exception: unknown): boolean {
    return exception instanceof MulterError;
  }

  handle(
    exception: MulterError,
    ctx: ExceptionContext,
  ): ExceptionHandlerResult {
    const message =
      exception.code === 'LIMIT_FILE_SIZE'
        ? 'File exceeds maximum allowed size'
        : `Upload error: ${exception.message}`;

    return {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      body: {
        success: false,
        error: { code: 'UNPROCESSABLE_ENTITY', message },
        meta: ctx,
      },
    };
  }
}
