import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { ExceptionHandler } from './handlers/index.js';
import {
  PrismaErrorHandler,
  AppExceptionHandler,
  HttpExceptionHandler,
  UnknownErrorHandler,
} from './handlers/index.js';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  // Thứ tự quan trọng: handler cụ thể hơn đứng trước, UnknownErrorHandler luôn ở cuối
  private readonly handlers: ExceptionHandler[] = [
    new PrismaErrorHandler(),
    new AppExceptionHandler(),
    new HttpExceptionHandler(),
    new UnknownErrorHandler(), // fallback — supports() luôn true
  ];

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const context = {
      requestId: (request.headers['x-request-id'] as string) || randomUUID(),
      timestamp: new Date().toISOString(),
    };

    const handler = this.handlers.find((h) => h.supports(exception));
    const { status, body } = handler!.handle(exception, context);

    response.status(status).json(body);
  }
}
