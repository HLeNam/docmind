export type DocumentStatus = "PENDING" | "PROCESSING" | "INDEXED" | "FAILED";

export interface DocumentResponse {
  id: string;
  tenantId: string;
  collectionId: string;
  filename: string;
  fileUrl: string;
  mimeType: string | null;
  status: DocumentStatus;
  failReason: string | null;
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentStatusResponse {
  id: string;
  collectionId: string;
  filename: string;
  status: DocumentStatus;
  failReason: string | null;
}

export type DocumentProcessingPhase =
  | "extracting"
  | "chunking"
  | "ocr"
  | "embedding"
  | "indexing"
  | "completed"
  | "failed";

export interface DocumentProgressEvent {
  documentId: string;
  percent: number;
  phase: DocumentProcessingPhase;
  message?: string;
}

export const ALLOWED_MIME_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".pptx",
  ".xlsx",
  ".csv",
  ".txt",
  ".md",
] as const;

export const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024; // 50MB
export const MAX_TABULAR_SIZE = 10 * 1024 * 1024; // 10MB

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  pageNumber: number | null;
  headingContext: string | null;
  content: string;
}
