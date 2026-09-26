import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ErrorMessage } from './error-codes.js';

export abstract class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
    public readonly details?: unknown,
  ) {
    super(message, status);
  }
}

function resolveMessageAndCode(
  codeOrMessage: string,
  defaultCode: ErrorCode,
  explicitCode?: string,
): { message: string; code: string } {
  const isKnownCode = codeOrMessage in ErrorMessage;
  const code = explicitCode || (isKnownCode ? codeOrMessage : defaultCode);
  const message = isKnownCode
    ? ErrorMessage[codeOrMessage as ErrorCode]
    : codeOrMessage;
  return { message, code };
}

export class ValidationAppException extends AppException {
  constructor(codeOrMessage: string = ErrorCode.VALIDATION_ERROR, details?: unknown, explicitCode?: string) {
    const { message, code } = resolveMessageAndCode(codeOrMessage, ErrorCode.VALIDATION_ERROR, explicitCode);
    super(code, message, HttpStatus.BAD_REQUEST, details);
  }
}

export class UnauthorizedAppException extends AppException {
  constructor(codeOrMessage: string = ErrorCode.UNAUTHORIZED, explicitCode?: string) {
    const { message, code } = resolveMessageAndCode(codeOrMessage, ErrorCode.UNAUTHORIZED, explicitCode);
    super(code, message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenAppException extends AppException {
  constructor(codeOrMessage: string = ErrorCode.FORBIDDEN, explicitCode?: string) {
    const { message, code } = resolveMessageAndCode(codeOrMessage, ErrorCode.FORBIDDEN, explicitCode);
    super(code, message, HttpStatus.FORBIDDEN);
  }
}

export class NotFoundAppException extends AppException {
  constructor(codeOrMessage: string = ErrorCode.NOT_FOUND, explicitCode?: string) {
    const { message, code } = resolveMessageAndCode(codeOrMessage, ErrorCode.NOT_FOUND, explicitCode);
    super(code, message, HttpStatus.NOT_FOUND);
  }
}

export class ConflictAppException extends AppException {
  constructor(codeOrMessage: string = ErrorCode.CONFLICT, details?: unknown, explicitCode?: string) {
    const { message, code } = resolveMessageAndCode(codeOrMessage, ErrorCode.CONFLICT, explicitCode);
    super(code, message, HttpStatus.CONFLICT, details);
  }
}

export class UnprocessableAppException extends AppException {
  constructor(codeOrMessage: string = ErrorCode.UNPROCESSABLE_ENTITY, details?: unknown, explicitCode?: string) {
    const { message, code } = resolveMessageAndCode(codeOrMessage, ErrorCode.UNPROCESSABLE_ENTITY, explicitCode);
    super(code, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

export class InternalAppException extends AppException {
  constructor(codeOrMessage: string = ErrorCode.INTERNAL_ERROR, explicitCode?: string) {
    const { message, code } = resolveMessageAndCode(codeOrMessage, ErrorCode.INTERNAL_ERROR, explicitCode);
    super(code, message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
