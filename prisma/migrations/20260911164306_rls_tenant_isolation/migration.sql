-- Bảng có tenant_id trực tiếp
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

-- Bảng qua subquery tới bảng cha
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON document_chunks USING (document_id IN (SELECT id FROM documents WHERE tenant_id = current_setting('app.current_tenant', true)));

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON messages USING (conversation_id IN (SELECT id FROM conversations WHERE tenant_id = current_setting('app.current_tenant', true)));

ALTER TABLE collection_accesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_accesses FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON collection_accesses USING (collection_id IN (SELECT id FROM collections WHERE tenant_id = current_setting('app.current_tenant', true)));

ALTER TABLE slack_channel_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_channel_mappings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON slack_channel_mappings USING (collection_id IN (SELECT id FROM collections WHERE tenant_id = current_setting('app.current_tenant', true)));
