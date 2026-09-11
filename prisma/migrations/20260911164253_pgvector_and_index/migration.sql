-- Tạo index HNSW cho cột embedding
CREATE INDEX IF NOT EXISTS document_chunk_embedding_hnsw_idx
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Index phụ để full-text search (hybrid search)
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS content_tsv tsvector;

-- Sử dụng trigger thay vì GENERATED COLUMN để Prisma không báo lỗi "DROP EXPRESSION"
CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
ON document_chunks FOR EACH ROW EXECUTE FUNCTION
tsvector_update_trigger(content_tsv, 'pg_catalog.simple', content);

CREATE INDEX IF NOT EXISTS document_chunk_content_tsv_idx
  ON document_chunks
  USING gin (content_tsv);
