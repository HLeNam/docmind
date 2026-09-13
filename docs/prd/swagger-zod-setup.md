# Setup OpenAPI (Swagger) cho NestJS — tích hợp Zod (Standard Schema)

Stack: NestJS 12, `@nestjs/platform-express`, ESM, Zod + `StandardSchemaValidationPipe` đã setup trước đó.

## 0. Cài đặt

```bash
npm i @nestjs/swagger
npm i -D zod-openapi
```

`zod-openapi` là converter chuyển Zod schema sang OpenAPI schema — cần thiết vì Zod chưa tự implement chuẩn `~standard.jsonSchema` mà `@nestjs/swagger` mong đợi.

---

## 1. Converter — nối Zod schema có sẵn với Swagger

Vì các route của bạn đã gắn `{ schema: CreateUserSchema }` ngay tại decorator (`@Body()`, `@Query()`, `@Param()`) từ lúc setup validate, converter này sẽ đọc lại đúng schema đó để sinh tài liệu — không cần định nghĩa lại gì thêm.

```typescript
// src/common/swagger/zod-schema-converter.ts
import type { SwaggerDocumentOptions } from '@nestjs/swagger';
import { createSchema } from 'zod-openapi';

export const zodSwaggerDocumentOptions: SwaggerDocumentOptions = {
  standardSchemaConverter: (schema, { schemaType }) => {
    const converted = createSchema(schema as never, {
      io: schemaType, // 'input' = dữ liệu client gửi lên, 'output' = dữ liệu sau khi Zod parse/transform
      openapiVersion: '3.0.0',
    });
    // ép kiểu vì standardSchemaConverter khai báo trả `schema: unknown`,
    // không strict như @ApiResponse nên không gặp lỗi type ở đây
    return { schema: converted.schema, components: converted.components };
  },
};
```

> Nếu sau này bạn dùng thêm Valibot song song với Zod, xem phần "Supporting several libraries at once" trong [tài liệu gốc](https://docs.nestjs.com/openapi/introduction#standard-schema-zod-valibot) — chỉ cần branch theo `schema['~standard'].vendor` trong cùng 1 converter.

---

## 2. `DocumentBuilder` + wiring vào `main.ts`

```typescript
// src/main.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { ValidationAppException } from './common/exceptions/app.exception.js';
import { zodSwaggerDocumentOptions } from './common/swagger/zod-schema-converter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.useGlobalPipes(
    new StandardSchemaValidationPipe({
      transform: true,
      exceptionFactory: (issues) => {
        const details: Record<string, string[]> = {};
        for (const issue of issues) {
          const field = issue.path?.length ? issue.path.map(String).join('.') : 'root';
          (details[field] ??= []).push(issue.message);
        }
        return new ValidationAppException('Validation failed', details);
      },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor(), new ResponseInterceptor());

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

  await app.listen(configService.get<number>('PORT', { infer: true }) ?? 3000);
}

bootstrap();
```

Truy cập `http://localhost:3000/api/docs` để xem Swagger UI, `http://localhost:3000/api/docs-json` để lấy JSON spec.

---

## 3. Controller — không cần sửa gì, tự động lên tài liệu

Vì `create()` đã gắn `{ schema: CreateUserSchema }` từ lúc setup validate, Swagger tự đọc đúng schema đó:

```typescript
// src/users/users.controller.ts — giữ nguyên như đã setup, không cần thêm gì
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CreateUserSchema, type CreateUserDto } from './dto/user.schema.js';
import { UsersService } from './users.service.js';

const ListUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách user, có phân trang' })
  list(@Query({ schema: ListUsersQuerySchema }) query: z.infer<typeof ListUsersQuerySchema>) {
    return this.usersService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin 1 user theo id' })
  findOne(@Param('id', { schema: z.coerce.number().int().positive() }) id: number) {
    return this.usersService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Đăng ký user mới' })
  create(@Body({ schema: CreateUserSchema }) dto: CreateUserDto) {
    return this.usersService.register(dto);
  }

  @Get('me')
  @ApiBearerAuth('access-token') // khớp tên đã đặt ở .addBearerAuth() trong main.ts
  @ApiOperation({ summary: 'Thông tin user đang đăng nhập' })
  getProfile() {
    // ...
  }
}
```

`@ApiTags`, `@ApiOperation`, `@ApiBearerAuth` là decorator **tuỳ chọn** — chỉ để tài liệu dễ đọc hơn (nhóm route, mô tả, đánh dấu route cần token). Phần schema request body/query/param thì **tự động** lấy từ Zod, không cần khai lại.

---

## 4. Response schema — mô tả đúng shape thật đã bọc qua `ResponseInterceptor`

Response thật trả về client không phải là object thô, mà đã được `ResponseInterceptor` bọc vào `SuccessResponse<T>` (`{ success, data, meta }`), và lỗi được `GlobalExceptionFilter` bọc vào `ErrorResponse` (`{ success, error, meta }`). Nếu khai `@ApiResponse` thủ công từng route sẽ phải lặp lại phần bọc này liên tục — nên viết 2 decorator tái sử dụng, chỉ cần truyền vào schema của phần `data` (cho response thành công) hoặc `status` (cho response lỗi).

### 4.1. `ApiZodResponse` — tự bọc schema `data` vào `SuccessResponse<T>`

```typescript
// src/common/swagger/api-zod-response.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface.js';
import { createSchema } from 'zod-openapi';
import { z, type ZodType } from 'zod';

interface ApiZodResponseOptions {
  status?: number;
  description?: string;
  schema: ZodType;
  isArray?: boolean;
}

export function ApiZodResponse({
  status = 200,
  description,
  schema,
  isArray = false,
}: ApiZodResponseOptions) {
  const dataSchema = isArray ? z.array(schema) : schema;

  // khớp chính xác shape của SuccessResponse<T> trong response.ts đã có
  const envelopeSchema = z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.object({
      requestId: z.string(),
      timestamp: z.string(),
    }),
  });

  const converted = createSchema(envelopeSchema, {
    io: 'output',
    openapiVersion: '3.0.0',
  });

  return applyDecorators(
    ApiResponse({
      status,
      description,
      // zod-openapi trả về type union có cả `boolean` (theo spec OpenAPI 3.1),
      // nhưng @nestjs/swagger chỉ nhận SchemaObject — ép kiểu vì schema thật
      // luôn là object, không bao giờ là boolean trong trường hợp dùng ở đây
      schema: converted.schema as SchemaObject,
    }),
  );
}
```

> Nếu import `SchemaObject` từ đường dẫn `dist/interfaces/...` báo lỗi resolve (tuỳ version `@nestjs/swagger`), dùng cách đơn giản hơn: `schema: converted.schema as any` — vẫn an toàn vì đây chỉ là ép kiểu cho TypeScript, không ảnh hưởng runtime.

### 4.2. `ApiErrorResponse` — mô tả sẵn `ErrorResponse` theo mã lỗi chuẩn

Khớp với `code` mà `AppException` hierarchy (đã setup ở phần error handling) tự sinh ra theo từng status — không cần định nghĩa lại schema lỗi ở từng route.

```typescript
// src/common/swagger/api-error-response.decorator.ts
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
```

### 4.3. Dùng trong controller — chỉ truyền schema `data`, không phải lo phần bọc

```typescript
// src/users/users.controller.ts
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ApiZodResponse } from '../common/swagger/api-zod-response.decorator.js';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator.js';
import { CreateUserSchema, type CreateUserDto } from './dto/user.schema.js';
import { UsersService } from './users.service.js';

// schema mô tả data trả về — có thể tách ra file riêng nếu dùng lại ở nhiều nơi (vd auth trả cùng shape user)
const UserResponseSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string().nullable(),
  createdAt: z.string(),
});

const ListUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách user, có phân trang' })
  @ApiZodResponse({ status: 200, description: 'Danh sách user', schema: UserResponseSchema, isArray: true })
  list(@Query({ schema: ListUsersQuerySchema }) query: z.infer<typeof ListUsersQuerySchema>) {
    return this.usersService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy thông tin 1 user theo id' })
  @ApiZodResponse({ status: 200, description: 'Thông tin user', schema: UserResponseSchema })
  @ApiErrorResponse(404, 'Không tìm thấy user')
  findOne(@Param('id', { schema: z.coerce.number().int().positive() }) id: number) {
    return this.usersService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Đăng ký user mới' })
  @ApiZodResponse({ status: 201, description: 'User vừa tạo', schema: UserResponseSchema })
  @ApiErrorResponse(400, 'Sai định dạng email/password')
  @ApiErrorResponse(409, 'Email đã tồn tại')
  create(@Body({ schema: CreateUserSchema }) dto: CreateUserDto) {
    return this.usersService.register(dto);
  }
}
```

Kết quả trong Swagger UI: mỗi route hiển thị đúng response thành công (đã bọc `success/data/meta`) **và** liệt kê rõ các mã lỗi có thể xảy ra kèm ví dụ `code` cụ thể — người dùng API (FE dev hoặc bên thứ 3) không cần đọc code backend mới biết được response thật trông như thế nào.

> Vẫn có 1 điểm trùng lặp nhỏ khó tránh: `UserResponseSchema` và cấu trúc field thật trả về từ `usersService` (vd từ Prisma) không được TypeScript ép buộc khớp nhau tự động — Swagger chỉ mô tả *ý định*, không validate runtime response. Nếu muốn chặt hơn, có thể dùng chung 1 schema cho cả việc `.parse()` output trước khi return (thêm 1 lớp serialize), nhưng thường không cần thiết ở mức API nội bộ/CRUD cơ bản.

---

## 5. Checklist

- [ ] Mọi route input đã gắn `{ schema }` từ setup validate trước đó → tự động lên Swagger, không cần làm gì thêm
- [ ] `standardSchemaConverter` chỉ cần khai **1 lần** trong `zod-schema-converter.ts`, dùng chung cho toàn app
- [ ] Swagger UI **tắt ở production** (`NODE_ENV === 'production'`) — tránh lộ toàn bộ danh sách endpoint, request/response shape ra internet
- [ ] Route cần xác thực → thêm `@ApiBearerAuth('access-token')`, tên phải khớp với tên đặt ở `.addBearerAuth(..., 'access-token')` trong `main.ts`
- [ ] Route trả response thành công → dùng `@ApiZodResponse({ schema: ... })` thay vì viết `@ApiResponse` tay, tự bọc đúng `SuccessResponse<T>`
- [ ] Route có thể lỗi → liệt kê từng `@ApiErrorResponse(status, description)` tương ứng với `AppException` mà service có thể ném ra
- [ ] Muốn ẩn hẳn cả JSON/YAML spec ở production (không chỉ ẩn UI) → dùng `SwaggerCustomOptions.raw: false` thay vì chỉ bọc `if (nodeEnv !== 'production')` quanh toàn bộ `setup()`
