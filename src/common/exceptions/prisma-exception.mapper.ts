// import { Prisma } from '@prisma/client';
// import {
//   AppException,
//   ConflictAppException,
//   NotFoundAppException,
//   ValidationAppException,
//   InternalAppException,
// } from './app.exception.js';

// /**
//  * Map các mã lỗi phổ biến của Prisma sang AppException tương ứng.
//  * Tham khảo đầy đủ mã lỗi: https://www.prisma.io/docs/orm/reference/error-reference
//  */
// export function mapPrismaError(
//   exception: Prisma.PrismaClientKnownRequestError,
// ): AppException {
//   switch (exception.code) {
//     // Unique constraint violation — vd trùng email, trùng username
//     case 'P2002': {
//       const target =
//         (exception.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
//       return new ConflictAppException(`Data already exists: ${target}`, {
//         [target]: [`Value already exists`],
//       });
//     }

//     // Record không tồn tại — vd update/delete record đã bị xoá
//     case 'P2025':
//       return new NotFoundAppException('Data not found');

//     // Foreign key constraint — vd xoá record đang bị record khác tham chiếu
//     case 'P2003':
//       return new ValidationAppException(
//         'Data is being referenced, cannot perform action',
//         {
//           field: (exception.meta?.field_name as string) ?? undefined,
//         },
//       );

//     // Required field bị thiếu khi insert/update qua raw query
//     case 'P2011':
//       return new ValidationAppException('Required field is missing', {
//         field: exception.meta?.target,
//       });

//     // Giá trị vượt quá độ dài cột cho phép
//     case 'P2000':
//       return new ValidationAppException('Value exceeds allowed length', {
//         column: exception.meta?.column_name,
//       });

//     default:
//       // Các mã lỗi Prisma khác chưa map riêng — vẫn ẩn chi tiết, trả 500 chung
//       return new InternalAppException(
//         'Data operation error, please try again later',
//       );
//   }
// }
