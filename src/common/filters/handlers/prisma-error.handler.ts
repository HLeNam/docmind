// import { HttpStatus } from '@nestjs/common';
// import { Prisma } from '@prisma/client';
// import type {
//   ExceptionHandler,
//   ExceptionContext,
//   ExceptionHandlerResult,
// } from './exception-handler.interface.js';
// import { mapPrismaError } from '../../exceptions/prisma-exception.mapper.js';

// export class PrismaErrorHandler implements ExceptionHandler {
//   supports(exception: unknown): boolean {
//     return (
//       exception instanceof Prisma.PrismaClientKnownRequestError ||
//       exception instanceof Prisma.PrismaClientValidationError ||
//       exception instanceof Prisma.PrismaClientInitializationError ||
//       exception instanceof Prisma.PrismaClientRustPanicError
//     );
//   }

//   handle(exception: unknown, ctx: ExceptionContext): ExceptionHandlerResult {
//     // Có mã lỗi cụ thể (P2002, P2025...) -> map sang AppException rồi lấy status/code/message
//     if (exception instanceof Prisma.PrismaClientKnownRequestError) {
//       const appException = mapPrismaError(exception);
//       return {
//         status: appException.getStatus(),
//         body: {
//           success: false,
//           error: {
//             code: appException.code,
//             message: appException.message,
//             details: appException.details,
//           },
//           meta: ctx,
//         },
//       };
//     }

//     // Lỗi Prisma nội bộ (cú pháp query sai, mất kết nối DB...) -> luôn ẩn chi tiết, 500
//     return {
//       status: HttpStatus.INTERNAL_SERVER_ERROR,
//       body: {
//         success: false,
//         error: {
//           code: 'INTERNAL_ERROR',
//           message: 'Lỗi kết nối hoặc truy vấn dữ liệu, vui lòng thử lại sau',
//         },
//         meta: ctx,
//       },
//     };
//   }
// }
