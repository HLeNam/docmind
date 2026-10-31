import { z } from 'zod';

// Multipart form nên metadata (collectionId) đến dưới dạng field string trong multipart/form-data,
// không validate qua Zod pipe của JSON body như các route khác — validate thủ công trong service.
export const UploadDocumentMetaSchema = z.object({
  collectionId: z.string().min(1, 'collectionId must not be empty'),
});

// Hỗ trợ PDF/DOCX/PPTX/XLSX/CSV/TXT/MD — 1 công ty thực tế luôn có slide thuyết trình và bảng tính
// nhiều không kém gì Word/PDF. Legacy binary (.doc, .xls, .ppt cũ) CHƯA hỗ trợ — xem "Đã hoãn có chủ đích".
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'text/csv',
  'text/plain',
  'text/markdown',
] as const;

// Tách 1 giới hạn chung thành 2 mức — tài liệu văn bản và dữ liệu dạng bảng có đặc tính rất khác
// nhau khi đi qua pipeline chunk/embed (xem lý do chi tiết ở MAX_TABULAR_SIZE_BYTES bên dưới).
const TABULAR_MIME_TYPES = new Set<string>([
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

// 50MB — tài liệu enterprise (sổ tay nhân sự, hợp đồng dài, slide nhiều hình) có thể khá nặng.
export const MAX_DOCUMENT_SIZE_BYTES = 50 * 1024 * 1024;

// 10MB — nhỏ hơn hẳn, KHÔNG phải vì CSV/XLSX kém quan trọng mà vì chunking hiện tại chỉ cắt theo
// token tuyến tính, không hiểu hàng/cột. 1 bảng vài chục nghìn dòng qua cách này tạo ra hàng loạt
// chunk là số liệu rời rạc, vô nghĩa khi tìm bằng ngữ nghĩa (vector search) — vừa tốn tiền embedding
// vừa cho retrieval kém. Giới hạn nhỏ buộc chỉ upload bảng tra cứu/tham chiếu (rate card, glossary,
// bảng mapping...), không phải data dump lớn. Xem "Đã hoãn có chủ đích".
export const MAX_TABULAR_SIZE_BYTES = 10 * 1024 * 1024;

export function getMaxSizeForMimeType(mimeType: string): number {
  return TABULAR_MIME_TYPES.has(mimeType)
    ? MAX_TABULAR_SIZE_BYTES
    : MAX_DOCUMENT_SIZE_BYTES;
}

export const DocumentResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  collectionId: z.string().uuid(),
  filename: z.string(),
  fileUrl: z.string(),
  mimeType: z.string().nullable(),
  status: z.enum(['PENDING', 'PROCESSING', 'INDEXED', 'FAILED']),
  failReason: z.string().nullable(),
  uploadedById: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const DocumentStatusResponseSchema = z.object({
  id: z.string().uuid(),
  collectionId: z.string().uuid(),
  filename: z.string(),
  status: z.enum(['PENDING', 'PROCESSING', 'INDEXED', 'FAILED']),
  failReason: z.string().nullable(),
});

export const DocumentChunkResponseSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  chunkIndex: z.number().int(),
  pageNumber: z.number().int().nullable(),
  headingContext: z.string().nullable(),
  content: z.string(),
});
