import { HttpStatus } from '@nestjs/common';
import type { ErrorResponse } from '../../types/response.js';

export interface ExceptionContext {
  requestId: string;
  timestamp: string;
}

export interface ExceptionHandlerResult {
  status: HttpStatus;
  body: ErrorResponse;
}

export interface ExceptionHandler {
  /** Trả về true nếu handler này xử lý được loại exception này */
  supports(exception: unknown): boolean;

  /** Xử lý và trả về status + body chuẩn hoá */
  handle(exception: unknown, ctx: ExceptionContext): ExceptionHandlerResult;
}
