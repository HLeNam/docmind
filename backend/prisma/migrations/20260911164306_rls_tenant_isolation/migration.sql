-- ============ 1. Role runtime cho app — KHÔNG phải table owner ============
-- Bắt buộc: nếu app kết nối bằng chính owner (docmind_owner) hoặc superuser, RLS sẽ bị BYPASS HOÀN TOÀN
-- (superuser luôn bypass RLS bất kể FORCE ROW LEVEL SECURITY; owner cũng bypass trừ khi có FORCE,
-- và ngay cả với FORCE thì tách role riêng vẫn là best practice để không lỡ tay dùng nhầm connection).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'docmind_app') THEN
    CREATE ROLE docmind_app LOGIN PASSWORD 'change_me_in_env';
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO docmind_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO docmind_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO docmind_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO docmind_app;

-- ============ 2. Role riêng cho truy vấn admin/xuyên-tenant hợp lệ (vd Super Admin xem toàn hệ thống) ============
-- KHÔNG dùng "SET LOCAL row_security = off" để bypass — GUC này chỉ khiến query bị RLS chặn báo lỗi
-- thay vì âm thầm lọc, nó KHÔNG bypass RLS cho role thường. Cách đúng: cấp BYPASSRLS cho role riêng này.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'docmind_system') THEN
    CREATE ROLE docmind_system LOGIN PASSWORD 'change_me_in_env' BYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO docmind_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO docmind_system;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO docmind_system;

-- ============ 3. Bảng có tenant_id trực tiếp ============
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenants USING (id = current_setting('app.current_tenant', true));

ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_memberships USING (tenant_id = current_setting('app.current_tenant', true));

ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON collections USING (tenant_id = current_setting('app.current_tenant', true));

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON documents USING (tenant_id = current_setting('app.current_tenant', true));

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON conversations USING (tenant_id = current_setting('app.current_tenant', true));

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON api_keys USING (tenant_id = current_setting('app.current_tenant', true));

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON usage_logs USING (tenant_id = current_setting('app.current_tenant', true));

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON invitations USING (tenant_id = current_setting('app.current_tenant', true));

ALTER TABLE slack_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_integrations FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON slack_integrations USING (tenant_id = current_setting('app.current_tenant', true));

-- ============ 4. Bảng con — không có tenant_id trực tiếp, subquery join lên bảng cha ============
-- Chấp nhận subquery ở quy mô vừa (xem "Đã hoãn có chủ đích": denormalize sau nếu đo được là bottleneck)
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON document_chunks USING (
  document_id IN (SELECT id FROM documents WHERE tenant_id = current_setting('app.current_tenant', true))
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON messages USING (
  conversation_id IN (SELECT id FROM conversations WHERE tenant_id = current_setting('app.current_tenant', true))
);

-- ⚠️ THIẾU trong bản gốc bạn gửi — Feedback map ra bảng "feedbacks" (số nhiều), chưa có RLS,
-- nghĩa là rating của mọi tenant đang lộ ra hết. Thêm mới:
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON feedbacks USING (
  membership_id IN (SELECT id FROM tenant_memberships WHERE tenant_id = current_setting('app.current_tenant', true))
);

-- Đổi tên bảng đúng theo @@map("collection_accesses") (số nhiều) trong schema.prisma
ALTER TABLE collection_accesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_accesses FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON collection_accesses USING (
  collection_id IN (SELECT id FROM collections WHERE tenant_id = current_setting('app.current_tenant', true))
);

ALTER TABLE slack_channel_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_channel_mappings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON slack_channel_mappings USING (
  collection_id IN (SELECT id FROM collections WHERE tenant_id = current_setting('app.current_tenant', true))
);

-- ============ 5. Identity/AuthProvider/RefreshToken/PasswordResetToken KHÔNG bật RLS ============
-- Lý do: các bảng này không thuộc về 1 tenant cụ thể (1 Identity có thể ở nhiều tenant),
-- cô lập ở đây xử lý bằng application logic (chỉ query theo identityId lấy từ JWT đã verify),
-- không phải bằng tenant_id — bật RLS tenant ở đây là sai mô hình.