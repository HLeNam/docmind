import { z } from 'zod';

export const PublicQuerySchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, 'query must not be empty')
    .max(2000, 'query is too long (maximum 2000 characters)')
    .describe('Natural language question or search query'),
  collectionId: z
    .string()
    .uuid('collectionId must be a valid UUID')
    .optional()
    .describe('Optional collection ID to narrow down the search scope'),
  topK: z.coerce
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe('Number of top candidate chunks to retrieve'),
});

export const PublicQueryResponseSchema = z.object({
  answer: z
    .string()
    .describe('Synthesized answer generated from relevant document chunks'),
  citations: z.array(
    z.object({
      index: z
        .number()
        .describe('1-based citation index [n] referenced in answer'),
      documentId: z.string().describe('ID of the source document'),
      filename: z.string().describe('Original filename of the source document'),
      chunkIndex: z.number().describe('Chunk index within the document'),
      pageNumber: z
        .number()
        .nullable()
        .describe('1-based page number if available in document'),
      headingContext: z
        .string()
        .nullable()
        .describe('Heading hierarchy context if available'),
      snippet: z
        .string()
        .describe(
          'Original text snippet (truncated up to 300 characters) for verification',
        ),
      score: z
        .number()
        .describe('Relevance score computed via Reciprocal Rank Fusion (RRF)'),
    }),
  ),
});
