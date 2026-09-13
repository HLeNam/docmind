import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ValidationAppException } from './common/exceptions/app.exception.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { zodSwaggerDocumentOptions } from './common/swagger/zod-schema-converter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

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

  // Chỉ bật Swagger UI ở non-production — tránh lộ toàn bộ API surface ra ngoài
  const nodeEnv = configService.get<string>('NODE_ENV', { infer: true });
  if (nodeEnv !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('DocMind API')
      .setDescription('API documentation cho DocMind backend')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        'access-token', // tên định danh, dùng lại ở @ApiBearerAuth('access-token')
      )
      .addTag('users')
      .build();

    const documentFactory = () =>
      SwaggerModule.createDocument(app, config, zodSwaggerDocumentOptions);

    SwaggerModule.setup('api/docs', app, documentFactory);
  }

  const port = configService.get<number>('PORT', { infer: true }) ?? 3000;
  await app.listen(port);
}
await bootstrap();
