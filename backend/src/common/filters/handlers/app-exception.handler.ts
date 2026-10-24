import type {
  ExceptionHandler,
  ExceptionContext,
  ExceptionHandlerResult,
} from './exception-handler.interface.js';
import { AppException } from '../../exceptions/app.exception.js';

export class AppExceptionHandler implements ExceptionHandler {
  supports(exception: unknown): boolean {
    return exception instanceof AppException;
  }

  handle(
    exception: AppException,
    ctx: ExceptionContext,
  ): ExceptionHandlerResult {
    return {
      status: exception.getStatus(),
      body: {
        success: false,
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
        meta: ctx,
      },
    };
  }
}
