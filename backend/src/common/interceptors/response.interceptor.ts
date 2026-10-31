import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { map, Observable } from 'rxjs';
import type { SuccessResponse } from '../types/response.js';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  SuccessResponse<T> | StreamableFile
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<SuccessResponse<T> | StreamableFile> {
    const request = context.switchToHttp().getRequest();
    const requestId =
      (request.headers['x-request-id'] as string) || randomUUID();

    return next.handle().pipe(
      map((data) => {
        // StreamableFile (tệp nhị phân stream) không bọc trong JSON envelope
        if (data instanceof StreamableFile) {
          return data;
        }

        return {
          success: true as const,
          data,
          meta: {
            requestId,
            timestamp: new Date().toISOString(),
          },
        };
      }),
    );
  }
}
