import { applyDecorators } from '@nestjs/common';
import { ApiResponse, SchemaObject } from '@nestjs/swagger';
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
