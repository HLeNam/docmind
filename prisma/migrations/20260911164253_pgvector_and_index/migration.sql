-- ============ 1. Extension pgvector ============
CREATE EXTENSION IF NOT EXISTS vector;

-- ============ 2. HNSW index cho vector similarity search ============
-- m=16, ef_construction=64 là baseline hợp lý cho quy mô demo — xem "Đã hoãn có chủ đích" trong roadmap
CREATE INDEX IF NOT EXISTS document_chunk_embedding_hnsw_idx
  ON document_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ============ 3. Full-text index cho hybrid search ============
-- Dùng trigger thay vì GENERATED COLUMN để tránh Prisma báo lỗi "DROP EXPRESSION" khi diff migration.
-- content_tsv đã khai Unsupported("tsvector") trong schema.prisma nên Prisma biết cột tồn tại
-- nhưng không cố quản lý giá trị của nó.
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS content_tsv tsvector;

-- Lưu ý: dùng 'pg_catalog.simple' (không stem, không loại bỏ stopword) — phù hợp nếu nội dung
-- đa ngôn ngữ / tiếng Việt. Nếu tài liệu chủ yếu tiếng Anh, đổi 'simple' -> 'english' để có
-- stemming tốt hơn (vd "running" khớp được "run").
CREATE TRIGGER tsvectorupdate BEFORE INSERT OR UPDATE
ON document_chunks FOR EACH ROW EXECUTE FUNCTION
tsvector_update_trigger(content_tsv, 'pg_catalog.simple', content);

CREATE INDEX IF NOT EXISTS document_chunk_content_tsv_idx
  ON document_chunks
  USING gin (content_tsv);