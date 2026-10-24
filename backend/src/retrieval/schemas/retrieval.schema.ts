// src/retrieval/schemas/retrieval.schema.ts
import { z } from 'zod';

export const RetrievalSearchSchema = z.object({
  query: z
    .string()
    .min(1, 'Query must not be empty')
    .max(2000, 'Query is too long (maximum 2000 characters)'),
  // Không truyền -> search trên TOÀN BỘ collection mà caller có quyền đọc (xem RetrievalService).
  collectionId: z
    .string()
    .uuid('collectionId must be a valid UUID')
    .optional(),
  topK: z.coerce.number().int().min(1).max(50).default(10),
});

export const RetrievedChunkResponseSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  content: z.string(),
  chunkIndex: z.number().int(),
  headingContext: z.string().nullable(),
  pageNumber: z.number().int().nullable(),
  filename: z.string(),
  score: z.number(),
});

export const RetrievedChunksResponseSchema = z.array(RetrievedChunkResponseSchema);
