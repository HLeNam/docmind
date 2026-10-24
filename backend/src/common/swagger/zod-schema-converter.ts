import type { SwaggerDocumentOptions } from '@nestjs/swagger';
import { createSchema } from 'zod-openapi';

export const zodSwaggerDocumentOptions: SwaggerDocumentOptions = {
  standardSchemaConverter: (schema, { schemaType }) => {
    const converted = createSchema(schema as never, {
      io: schemaType, // 'input' = dữ liệu client gửi lên, 'output' = dữ liệu sau khi Zod parse/transform
      openapiVersion: '3.0.0',
    });
    return { schema: converted.schema, components: converted.components };
  },
};
