# Bộ chuẩn hoá Validation / Error / Response cho NestJS (backend-only) bằng Zod

Stack: NestJS 12, Zod v4, `"type": "module"` (ESM — mọi import nội bộ cần đuôi `.js`).

## 0. Cài đặt

Không cần cài thêm package validate nào — từ NestJS 12, `StandardSchemaValidationPipe` đã có sẵn trong `@nestjs/common`, hỗ trợ mọi thư viện tuân theo [Standard Schema](https://standardschema.dev/) (Zod, Valibot, ArkType...). Chỉ cần Zod:

```bash
npm i zod
```

> Nếu project bạn đang dùng bản NestJS < 12, `StandardSchemaValidationPipe` chưa tồn tại — khi đó cần quay lại dùng package `nestjs-zod` như cách cũ.

## Cấu trúc thư mục

```
src/
├── common/
│   ├── types/
│   │   └── response.ts
│   ├── exceptions/
│   │   ├── app.exception.ts
│   │   └── prisma-exception.mapper.ts
│   ├── filters/
│   │   ├── handlers/
│   │   │   ├── exception-handler.interface.ts
│   │   │   ├── prisma-error.handler.ts
│   │   │   ├── app-exception.handler.ts
│   │   │   ├── http-exception.handler.ts
│   │   │   ├── unknown-error.handler.ts
│   │   │   └── index.ts
│   │   └── global-exception.filter.ts
│   └── interceptors/
│       ├── response.interceptor.ts
│       └── logging.interceptor.ts
├── users/
│   ├── dto/
│   │   └── user.schema.ts
│   ├── users.controller.ts
│   └── users.service.ts
├── app.module.ts
└── main.ts
```

---

## 1. Zod schema + DTO (đặt trong từng module, không cần package riêng)

Không cần `createZodDto()` hay class DTO nữa — `StandardSchemaValidationPipe` nhận schema trực tiếp qua option ở decorator (`@Body({ schema })`, `@Query({ schema })`, `@Param(name, { schema })`), nên schema chỉ cần export ra và dùng `z.infer` để lấy type.

```typescript
// src/users/dto/user.schema.ts
import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email('Email không đúng định dạng'),
  password: z
    .string()
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
    .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất 1 chữ hoa')
    .regex(/[0-9]/, 'Mật khẩu phải có ít nhất 1 số'),
  name: z.string().min(1, 'Tên không được để trống').max(100),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;

// cross-field validation
export const RegisterSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'], // bắt buộc, để biết gắn lỗi vào đúng field
  });

export type RegisterDto = z.infer<typeof RegisterSchema>;
```

> Quy tắc bắt buộc: **mọi route nhận input đều phải gắn `{ schema: ... }` ở decorator** (`@Body()`, `@Query()`, `@Param()`). Nếu quên gắn schema, pipe sẽ **bỏ qua hoàn toàn**, không validate gì — đây là lỗi hay gặp nhất khi mới đổi sang cách này.

---

## 2. Response type chuẩn hoá

```typescript
// src/common/types/response.ts
export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    requestId: string;
    timestamp: string;
  };
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: string;
  };
}
```

---

## 3. Exception hierarchy

```typescript
// src/common/exceptions/app.exception.ts
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
  constructor(message = 'Chưa đăng nhập hoặc token không hợp lệ') {
    super('UNAUTHORIZED', message, HttpStatus.UNAUTHORIZED);
  }
}

// 403 — không đủ quyền
export class ForbiddenAppException extends AppException {
  readonly code = 'FORBIDDEN';
  constructor(message = 'Không có quyền thực hiện hành động này') {
    super('FORBIDDEN', message, HttpStatus.FORBIDDEN);
  }
}

// 404 — không tìm thấy resource
export class NotFoundAppException extends AppException {
  readonly code = 'NOT_FOUND';
  constructor(message = 'Không tìm thấy dữ liệu') {
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
    super('UNPROCESSABLE_ENTITY', message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}

// 500 — lỗi hệ thống không lường trước
export class InternalAppException extends AppException {
  readonly code = 'INTERNAL_ERROR';
  constructor(message = 'Đã có lỗi xảy ra, vui lòng thử lại sau') {
    super('INTERNAL_ERROR', message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
```

Dùng trong service:

```typescript
// src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { UnprocessableAppException } from '../common/exceptions/app.exception.js';
import type { CreateUserDto } from './dto/user.schema.js';

@Injectable()
export class UsersService {
  async register(dto: CreateUserDto) {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw new UnprocessableAppException('Email đã được sử dụng', {
        email: ['Email này đã tồn tại trong hệ thống'],
      });
    }
    // ...
  }
}
```

---

## 3.5. Map lỗi Prisma sang `AppException`

Prisma ném ra các class lỗi riêng (`PrismaClientKnownRequestError`, `PrismaClientValidationError`...), không phải `HttpException` hay `ZodError`, nên nếu không xử lý riêng, chúng sẽ rơi vào nhánh "lỗi không xác định" → luôn trả 500, kể cả với case đáng lẽ là 409/404.

```bash
npm i @prisma/client
```

```typescript
// src/common/exceptions/prisma-exception.mapper.ts
import { Prisma } from '@prisma/client';
import {
  AppException,
  ConflictAppException,
  NotFoundAppException,
  ValidationAppException,
  InternalAppException,
} from './app.exception.js';

/**
 * Map các mã lỗi phổ biến của Prisma sang AppException tương ứng.
 * Tham khảo đầy đủ mã lỗi: https://www.prisma.io/docs/orm/reference/error-reference
 */
export function mapPrismaError(exception: Prisma.PrismaClientKnownRequestError): AppException {
  switch (exception.code) {
    // Unique constraint violation — vd trùng email, trùng username
    case 'P2002': {
      const target = (exception.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
      return new ConflictAppException(`Dữ liệu đã tồn tại: ${target}`, {
        [target]: [`Giá trị này đã được sử dụng`],
      });
    }

    // Record không tồn tại — vd update/delete record đã bị xoá
    case 'P2025':
      return new NotFoundAppException('Không tìm thấy dữ liệu để thao tác');

    // Foreign key constraint — vd xoá record đang bị record khác tham chiếu
    case 'P2003':
      return new ValidationAppException('Dữ liệu đang được tham chiếu, không thể thao tác', {
        field: (exception.meta?.field_name as string) ?? undefined,
      });

    // Required field bị thiếu khi insert/update qua raw query
    case 'P2011':
      return new ValidationAppException('Thiếu trường dữ liệu bắt buộc', {
        field: exception.meta?.target,
      });

    // Giá trị vượt quá độ dài cột cho phép
    case 'P2000':
      return new ValidationAppException('Giá trị vượt quá độ dài cho phép', {
        column: exception.meta?.column_name,
      });

    default:
      // Các mã lỗi Prisma khác chưa map riêng — vẫn ẩn chi tiết, trả 500 chung
      return new InternalAppException('Lỗi thao tác dữ liệu, vui lòng thử lại sau');
  }
}
```

---

## 4. Global Exception Filter — tách theo strategy pattern

Thay vì 1 file filter dài với nhiều nhánh `if/else if`, tách mỗi loại lỗi thành 1 handler riêng, dùng chung 1 interface. Thêm loại lỗi mới sau này (vd JWT expired, multer upload error...) chỉ cần thêm 1 file mới, không sửa file cũ.

```
src/common/filters/
├── handlers/
│   ├── exception-handler.interface.ts
│   ├── prisma-error.handler.ts
│   ├── app-exception.handler.ts
│   ├── http-exception.handler.ts
│   ├── unknown-error.handler.ts
│   └── index.ts
└── global-exception.filter.ts
```

> Không còn `zod-error.handler.ts` — với `StandardSchemaValidationPipe`, lỗi validate được `exceptionFactory` (xem mục 8) chuyển thẳng thành `ValidationAppException`, nên `AppExceptionHandler` xử lý luôn được, không cần bắt riêng `ZodError` nữa.

### 4.1. Interface chung

```typescript
// src/common/filters/handlers/exception-handler.interface.ts
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
```

### 4.2. Từng handler riêng biệt

```typescript
// src/common/filters/handlers/prisma-error.handler.ts
import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ExceptionHandler, ExceptionContext, ExceptionHandlerResult } from './exception-handler.interface.js';
import { mapPrismaError } from '../../exceptions/prisma-exception.mapper.js';

export class PrismaErrorHandler implements ExceptionHandler {
  supports(exception: unknown): boolean {
    return (
      exception instanceof Prisma.PrismaClientKnownRequestError ||
      exception instanceof Prisma.PrismaClientValidationError ||
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientRustPanicError
    );
  }

  handle(exception: unknown, ctx: ExceptionContext): ExceptionHandlerResult {
    // Có mã lỗi cụ thể (P2002, P2025...) -> map sang AppException rồi lấy status/code/message
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const appException = mapPrismaError(exception);
      return {
        status: appException.getStatus(),
        body: {
          success: false,
          error: {
            code: appException.code,
            message: appException.message,
            details: appException.details,
          },
          meta: ctx,
        },
      };
    }

    // Lỗi Prisma nội bộ (cú pháp query sai, mất kết nối DB...) -> luôn ẩn chi tiết, 500
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Lỗi kết nối hoặc truy vấn dữ liệu, vui lòng thử lại sau',
        },
        meta: ctx,
      },
    };
  }
}
```

```typescript
// src/common/filters/handlers/app-exception.handler.ts
import type { ExceptionHandler, ExceptionContext, ExceptionHandlerResult } from './exception-handler.interface.js';
import { AppException } from '../../exceptions/app.exception.js';

export class AppExceptionHandler implements ExceptionHandler {
  supports(exception: unknown): boolean {
    return exception instanceof AppException;
  }

  handle(exception: AppException, ctx: ExceptionContext): ExceptionHandlerResult {
    return {
      status: exception.getStatus(),
      body: {
        success: false,
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
        },
        meta: ctx,
      },
    };
  }
}
```

```typescript
// src/common/filters/handlers/http-exception.handler.ts
import { HttpException, HttpStatus } from '@nestjs/common';
import type { ExceptionHandler, ExceptionContext, ExceptionHandlerResult } from './exception-handler.interface.js';

export class HttpExceptionHandler implements ExceptionHandler {
  supports(exception: unknown): boolean {
    return exception instanceof HttpException;
  }

  handle(exception: HttpException, ctx: ExceptionContext): ExceptionHandlerResult {
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
```

```typescript
// src/common/filters/handlers/unknown-error.handler.ts
import { HttpStatus, Logger } from '@nestjs/common';
import type { ExceptionHandler, ExceptionContext, ExceptionHandlerResult } from './exception-handler.interface.js';

// Handler này luôn supports() = true, dùng làm fallback cuối cùng
export class UnknownErrorHandler implements ExceptionHandler {
  private readonly logger = new Logger('UnhandledException');

  supports(): boolean {
    return true;
  }

  handle(exception: unknown, ctx: ExceptionContext): ExceptionHandlerResult {
    this.logger.error(
      `Unhandled exception [${ctx.requestId}]`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Đã có lỗi xảy ra, vui lòng thử lại sau',
        },
        meta: ctx,
      },
    };
  }
}
```

```typescript
// src/common/filters/handlers/index.ts
export * from './exception-handler.interface.js';
export * from './prisma-error.handler.js';
export * from './app-exception.handler.js';
export * from './http-exception.handler.js';
export * from './unknown-error.handler.js';
```

### 4.3. `GlobalExceptionFilter` — giờ chỉ còn nhiệm vụ điều phối

```typescript
// src/common/filters/global-exception.filter.ts
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
```

Muốn thêm loại lỗi mới — ví dụ lỗi từ `multer` khi upload file quá dung lượng — chỉ cần:

1. Tạo `src/common/filters/handlers/multer-error.handler.ts` implement `ExceptionHandler`
2. Export ở `handlers/index.ts`
3. Thêm vào mảng `handlers` trong `GlobalExceptionFilter` — nhớ đặt **trước** `UnknownErrorHandler`

Không cần đụng vào bất kỳ handler nào khác đã có.


---

## 5. Response Interceptor (bọc response thành công)

```typescript
// src/common/interceptors/response.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { map, Observable } from 'rxjs';
import type { SuccessResponse } from '../types/response.js';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, SuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<SuccessResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const requestId = (request.headers['x-request-id'] as string) || randomUUID();

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
        },
      })),
    );
  }
}
```

---

## 6. Logging Interceptor

```typescript
// src/common/interceptors/logging.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const { method, originalUrl } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(`${method} ${originalUrl} - ${Date.now() - start}ms`);
        },
        error: (err) => {
          this.logger.warn(
            `${method} ${originalUrl} - ${Date.now() - start}ms - ${err.message}`,
          );
        },
      }),
    );
  }
}
```

---

## 7. Validate `@Body()` / `@Query()` / `@Param()` — gắn schema ngay tại decorator

`StandardSchemaValidationPipe` (built-in từ NestJS 12) nhận schema qua option thứ 2 của decorator, dùng chung cho cả `@Body()`, `@Query()`, `@Param()` — không cần viết pipe riêng cho từng loại nữa.

```typescript
// src/users/users.controller.ts
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { CreateUserSchema, type CreateUserDto } from './dto/user.schema.js';
import { UsersService } from './users.service.js';

const ListUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(@Query({ schema: ListUsersQuerySchema }) query: z.infer<typeof ListUsersQuerySchema>) {
    return this.usersService.list(query);
  }

  @Get(':id')
  findOne(@Param('id', { schema: z.coerce.number().int().positive() }) id: number) {
    return this.usersService.findOne(id);
  }

  @Post()
  create(@Body({ schema: CreateUserSchema }) dto: CreateUserDto) {
    // dto ở đây đã được validate + transform xong bởi global StandardSchemaValidationPipe
    return this.usersService.register(dto);
  }
}
```

> Global pipe (đăng ký ở mục 8) tự áp dụng cho mọi route có gắn `schema` — không cần khai `@UsePipes()` thủ công ở từng route.

---

## 8. Wiring vào `main.ts`

Điểm quan trọng nhất khi chuyển sang `StandardSchemaValidationPipe`: dùng `exceptionFactory` để gom lỗi Zod thành `ValidationAppException` sẵn có, giữ nguyên format `ErrorResponse` đã chuẩn hoá — không cần `ZodErrorHandler` riêng trong filter nữa.

```typescript
// src/main.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { ValidationAppException } from './common/exceptions/app.exception.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new StandardSchemaValidationPipe({
      transform: true, // để coerce (vd z.coerce.number()) trả đúng type
      exceptionFactory: (issues) => {
        // gom issues thành cùng shape { field: string[] } như cũ để FE xử lý đồng nhất
        const details: Record<string, string[]> = {};
        for (const issue of issues) {
          const field = issue.path?.length ? issue.path.map(String).join('.') : 'root';
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
  app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseInterceptor());

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
```

> `issues` là mảng chuẩn theo Standard Schema spec, mỗi phần tử có `message` và `path`. Vì pipe hỗ trợ nhiều thư viện (Zod/Valibot/ArkType) nên tên field trong `issues` là chung, không phải riêng của Zod — nên `console.log(issues)` thử 1 lần khi mới cài để chắc chắn đúng shape trước khi build logic gom `details`, tránh sai lệch giữa các version.

---

## 9. Ví dụ response thực tế

**Thành công:**

```json
{
  "success": true,
  "data": { "id": "u_123", "email": "a@b.com" },
  "meta": { "requestId": "b5e2...", "timestamp": "2026-09-09T10:00:00.000Z" }
}
```

**Lỗi 400 (Zod validate field):**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "email": ["Email không đúng định dạng"],
      "password": ["Mật khẩu phải có ít nhất 1 chữ hoa"]
    }
  },
  "meta": { "requestId": "b5e2...", "timestamp": "2026-09-09T10:00:00.000Z" }
}
```

**Lỗi 422 (business rule):**

```json
{
  "success": false,
  "error": {
    "code": "UNPROCESSABLE_ENTITY",
    "message": "Email đã được sử dụng",
    "details": { "email": ["Email này đã tồn tại trong hệ thống"] }
  },
  "meta": { "requestId": "b5e2...", "timestamp": "2026-09-09T10:00:00.000Z" }
}
```

---

## 10. Bảng ghi nhớ khi nào dùng exception nào

| Tình huống | Status | Cách throw |
|---|---|---|
| Sai type/format field | 400 | Tự động qua Zod schema (`.email()`, `.min()`, `.regex()`) |
| Cross-field trong 1 request | 400 | `.refine()` / `.superRefine()` trong schema |
| Đúng format nhưng vi phạm business rule (cần query DB) | 422 | `throw new UnprocessableAppException(...)` trong service |
| Trùng dữ liệu unique | 409 | `throw new ConflictAppException(...)` |
| Chưa đăng nhập | 401 | Guard hoặc `throw new UnauthorizedAppException(...)` |
| Không đủ quyền | 403 | Guard hoặc `throw new ForbiddenAppException(...)` |
| Không tìm thấy resource | 404 | `throw new NotFoundAppException(...)` |
| Lỗi hệ thống không lường trước | 500 | Không cần throw thủ công — `GlobalExceptionFilter` tự bắt và ẩn chi tiết |
| Trùng unique key ở DB (Prisma `P2002`) | 409 | Không cần throw thủ công — `mapPrismaError()` tự convert |
| Update/delete record không tồn tại (Prisma `P2025`) | 404 | Không cần throw thủ công — `mapPrismaError()` tự convert |
| Vi phạm foreign key (Prisma `P2003`) | 400 | Không cần throw thủ công — `mapPrismaError()` tự convert |

## 11. Checklist khi thêm module mới

- [ ] Schema Zod đặt trong `dto/*.schema.ts` của từng module, export cả schema lẫn `z.infer` type
- [ ] Mọi route nhận input **bắt buộc** gắn `{ schema: ... }` ở `@Body()`/`@Query()`/`@Param()` — quên gắn thì pipe bỏ qua hoàn toàn, không validate gì
- [ ] Lỗi business logic ném qua `AppException` con tương ứng, không throw `Error` trần
- [ ] Không cần gọi `.parse()` thủ công trong controller — pipe đã tự làm
- [ ] Không catch riêng lẻ lỗi Prisma trong từng service (trùng key, not found...) — để rơi tự nhiên lên `GlobalExceptionFilter`, trừ khi cần custom message theo ngữ cảnh nghiệp vụ cụ thể (vd phân biệt "email trùng" và "username trùng" dù cùng bảng)
- [ ] Thêm loại lỗi mới (JWT expired, multer upload...) → tạo 1 handler mới trong `filters/handlers/`, không sửa handler cũ, nhớ thêm **trước** `UnknownErrorHandler` trong mảng `handlers` của filter
