import { HttpStatus } from '@nestjs/common';
import { AppException } from '../exceptions/app.exception.js';
import { ErrorCode } from '../exceptions/error-codes.js';

export class TooManyRequestsAppException extends AppException {
  constructor(retryAfterSeconds: number) {
    super(
      ErrorCode.RATE_LIMITED,
      `Rate limit exceeded, retry in ${retryAfterSeconds}s`,
      HttpStatus.TOO_MANY_REQUESTS,
      { retryAfterSeconds },
    );
  }
}
