-- Recreate protected indices dropped by prisma diff
CREATE INDEX IF NOT EXISTS document_chunk_embedding_hnsw_idx
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS document_chunk_content_tsv_idx
  ON document_chunks
  USING gin (content_tsv);
