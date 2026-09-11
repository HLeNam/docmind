import { HttpStatus, Logger } from '@nestjs/common';
import type {
  ExceptionHandler,
  ExceptionContext,
  ExceptionHandlerResult,
} from './exception-handler.interface.js';

// Handler này luôn supports() = true, dùng làm fallback cuối cùng
export class UnknownErrorHandler implements ExceptionHandler {
  private readonly logger = new Logger('UnhandledException');

  supports(): boolean {
    return true;
  }

  handle(exception: unknown, ctx: ExceptionContext): ExceptionHandlerResult {
    this.logger.error(
      `Unhandled exception [${ctx.requestId}]`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Đã có lỗi xảy ra, vui lòng thử lại sau',
        },
        meta: ctx,
      },
    };
  }
}
