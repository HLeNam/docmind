import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';

const ERROR_CODE_BY_STATUS: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  500: 'INTERNAL_ERROR',
};

export function ApiErrorResponse(status: number, description?: string) {
  const code = ERROR_CODE_BY_STATUS[status] ?? 'HTTP_ERROR';

  return applyDecorators(
    ApiResponse({
      status,
      description: description ?? code,
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: code },
              message: { type: 'string' },
              details: { type: 'object', nullable: true },
            },
          },
          meta: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    }),
  );
}
