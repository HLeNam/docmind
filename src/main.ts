import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ValidationAppException } from './common/exceptions/app.exception.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new StandardSchemaValidationPipe({
      transform: true, // để coerce (vd z.coerce.number()) trả đúng type
      exceptionFactory: (issues) => {
        // gom issues thành cùng shape { field: string[] } như cũ để FE xử lý đồng nhất
        const details: Record<string, string[]> = {};
        for (const issue of issues) {
          const field = issue.path?.length
            ? issue.path.map(String).join('.')
            : 'root';
          (details[field] ??= []).push(issue.message);
        }
        // ném ra AppException đã có sẵn -> AppExceptionHandler xử lý luôn,
        // không cần ZodErrorHandler riêng nữa
        return new ValidationAppException('Validation failed', details);
      },
    }),
  );

  // thứ tự: pipe validate trước -> filter bắt lỗi -> interceptor log -> interceptor bọc response
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseInterceptor(),
  );

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
