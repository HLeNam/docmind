import { HttpException, HttpStatus } from '@nestjs/common';
import type {
  ExceptionHandler,
  ExceptionContext,
  ExceptionHandlerResult,
} from './exception-handler.interface.js';

export class HttpExceptionHandler implements ExceptionHandler {
  supports(exception: unknown): boolean {
    return exception instanceof HttpException;
  }

  handle(
    exception: HttpException,
    ctx: ExceptionContext,
  ): ExceptionHandlerResult {
    const status = exception.getStatus();
    const res = exception.getResponse();
    const message =
      typeof res === 'string' ? res : (res as any).message || exception.message;

    return {
      status,
      body: {
        success: false,
        error: {
          code: HttpStatus[status] ?? 'HTTP_ERROR',
          message: Array.isArray(message) ? message.join(', ') : message,
        },
        meta: ctx,
      },
    };
  }
}
