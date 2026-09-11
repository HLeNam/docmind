import { HttpException, HttpStatus } from '@nestjs/common';

export abstract class AppException extends HttpException {
  abstract readonly code: string;

  constructor(
    code: string,
    message: string,
    status: HttpStatus,
    public readonly details?: unknown,
  ) {
    super(message, status);
  }
}

// 400 — dùng khi bạn muốn tự throw validation error thủ công ngoài luồng Zod
export class ValidationAppException extends AppException {
  readonly code = 'VALIDATION_ERROR';
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, HttpStatus.BAD_REQUEST, details);
  }
}

// 401 — chưa xác thực
export class UnauthorizedAppException extends AppException {
  readonly code = 'UNAUTHORIZED';
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, HttpStatus.UNAUTHORIZED);
  }
}

// 403 — không đủ quyền
export class ForbiddenAppException extends AppException {
  readonly code = 'FORBIDDEN';
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, HttpStatus.FORBIDDEN);
  }
}

// 404 — không tìm thấy resource
export class NotFoundAppException extends AppException {
  readonly code = 'NOT_FOUND';
  constructor(message = 'Not found') {
    super('NOT_FOUND', message, HttpStatus.NOT_FOUND);
  }
}

// 409 — xung đột dữ liệu (vd trùng unique key)
export class ConflictAppException extends AppException {
  readonly code = 'CONFLICT';
  constructor(message: string, details?: unknown) {
    super('CONFLICT', message, HttpStatus.CONFLICT, details);
  }
}

// 422 — đúng format nhưng vi phạm business rule (cần check DB/service)
export class UnprocessableAppException extends AppException {
  readonly code = 'UNPROCESSABLE_ENTITY';
  constructor(message: string, details?: unknown) {
    super(
      'UNPROCESSABLE_ENTITY',
      message,
      HttpStatus.UNPROCESSABLE_ENTITY,
      details,
    );
  }
}

// 500 — lỗi hệ thống không lường trước
export class InternalAppException extends AppException {
  readonly code = 'INTERNAL_ERROR';
  constructor(message = 'Internal server error') {
    super('INTERNAL_ERROR', message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
