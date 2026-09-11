# DocMind — Kế hoạch triển khai

---

## Đã hoàn thành (giai đoạn phân tích & thiết kế)

- Định vị sản phẩm: API-first + self-hosted + nhúng workflow, khác NotebookLM
- Spec chức năng đầy đủ (document management, RAG chat, roles, analytics, API/Slack)
- Use case specification theo actor + nhóm giá trị kinh doanh
- Prisma schema hoàn chỉnh: Identity/AuthProvider/TenantMembership tách biệt, RefreshToken rotation + reuse detection, RLS theo tenant, pgvector + hybrid search index
- 2 migration SQL: pgvector/HNSW/full-text index, RLS policy
- ERD tổng thể

---

## Giai đoạn 1 — Scaffold & Auth (tuần 1-2)

**1.1 Scaffold repo**
- Khởi tạo NestJS project, cấu trúc module theo domain: `auth`, `tenants`, `collections`, `documents`, `chat`, `analytics`
- Docker Compose: Postgres (pgvector image) + Redis
- Setup Prisma, chạy migration đầu tiên + 2 migration đã viết (pgvector, RLS)
- `PrismaService` wrapper: transaction interceptor set `app.current_tenant` mỗi request (bắt buộc để RLS hoạt động — đã ghi chú ở migration)
- Tạo Postgres role riêng cho app (không phải table owner) để RLS có tác dụng thật

**1.2 Auth module**
- Đăng ký/đăng nhập email+password (bcrypt/argon2)
- Google OAuth (verify ID token, link account theo email nếu Identity đã tồn tại)
- Refresh token rotation + reuse detection (theo thiết kế đã bàn)
- Invitation flow: tạo invitation → gửi email (dùng service email đơn giản, vd Resend/SES) → accept → tạo TenantMembership
- JWT payload chứa `identityId`, `tenantId`, `membershipId`, `role`
- Guard kiểm tra role (OWNER/ADMIN/MEMBER) theo route

**Deliverable giai đoạn 1:** đăng ký được, đăng nhập được (2 cách), mời user vào tenant được, có access+refresh token hoạt động đúng chuẩn.

---

## Giai đoạn 2 — Core RAG pipeline (tuần 2-4)

**2.1 Document management**
- Upload API (multipart) → lưu S3-compatible storage (MinIO local cho dev)
- Extract text: pdf-parse (PDF), mammoth (DOCX), plain text/markdown trực tiếp
- Chunking: sliding window ~500 token, overlap 50 token (bắt đầu đơn giản, tinh chỉnh sau)

**2.2 Embedding pipeline**
- BullMQ queue `document.process`
- Worker: extract → chunk → batch embedding (OpenAI `text-embedding-3-small`) → lưu vào `DocumentChunk.embedding`
- Retry + progress tracking qua WebSocket

**2.3 Retrieval & Chat**
- Hybrid search: vector similarity (đã có HNSW index) + full-text (đã có tsvector index) → merge bằng Reciprocal Rank Fusion
- Prompt template + streaming response (SSE)
- Lưu Conversation/Message, citation mapping về DocumentChunk

**Deliverable giai đoạn 2:** upload tài liệu → chat hỏi được, có citation, chạy full local qua Docker Compose. Đây là mốc quan trọng nhất — có demo chạy được để show CV dù chưa xong các phần còn lại.

---

## Giai đoạn 3 — Frontend (song song hoặc sau giai đoạn 2, tuần 3-5)

- React + TanStack Router/Query + Zustand (đúng stack quen thuộc)
- Màn hình: login/register, danh sách collection, upload tài liệu (có progress bar realtime), chat UI (streaming + citation hiển thị rõ nguồn)
- Không cần làm đẹp hoàn chỉnh ở bước này — ưu tiên chạy đúng luồng trước

---

## Giai đoạn 4 — API-first & Slack (tuần 5-6)

- API key management (tạo/thu hồi, scope theo collection)
- Public endpoint `POST /v1/query` — không qua session, auth bằng API key
- Slack App: OAuth install, `/ask` command, map channel ↔ collection, trả lời dạng thread + block kit citation
- Đây là phần **chứng minh định vị khác biệt** so với NotebookLM — ưu tiên làm cho chạy thật, không chỉ mock

---

## Giai đoạn 5 — Production polish (tuần 6-7)

- Analytics dashboard: top câu hỏi, knowledge gap, usage/cost theo tenant
- CI/CD: GitHub Actions (lint, test, build, deploy)
- Deploy thật: Railway/Fly.io (bản demo online) — song song chuẩn bị Docker Compose bundle cho self-hosted
- Observability cơ bản: structured logging, `/health` endpoint, Bull Board cho theo dõi queue

---

## Giai đoạn 6 — Stretch (nếu còn thời gian)

- Google Drive/Notion auto-sync
- Feedback loop (thumbs up/down → điều chỉnh retrieval threshold)
- Helm chart cho Kubernetes
- Mobile app (Expo) — tra cứu nhanh

---

## Đã hoãn có chủ đích (không phải thiếu sót thiết kế)

Những điểm này **cố tình chưa đưa vào schema/spec hiện tại**, vì thêm sớm sẽ đoán mò và dễ sai — làm khi có dữ liệu/nhu cầu thật sẽ chính xác hơn nhiều:

- **Document version history** — chỉ cần nếu thực tế thấy user re-upload tài liệu thường xuyên và cần rollback. Thêm sau bằng 1 bảng `DocumentVersion` không phá vỡ schema hiện tại.
- **Tinh chỉnh HNSW index (m, ef_construction)** — giá trị hiện tại (m=16, ef_construction=64) là baseline hợp lý, chỉ nên đo lại và tinh chỉnh khi có dataset thật (hàng chục nghìn chunk trở lên), đo trên dataset giả sẽ cho số liệu sai lệch.
- **Denormalize tenant_id vào DocumentChunk/Message** — hiện dùng subquery cho RLS ở các bảng này, chấp nhận được ở quy mô vừa. Chỉ đáng denormalize khi đo được subquery là bottleneck thật.
- **Policy engine phức tạp hơn (OPA/Casbin)** — RBAC + ACL hiện tại đủ dùng, chỉ nâng cấp nếu luật phân quyền phức tạp hơn nhiều (vd: phân quyền theo điều kiện động).
- **Reranking model riêng (Cohere rerank)** — hybrid search (vector + full-text + RRF) đã đủ tốt cho demo; reranking là tối ưu thêm, không phải yêu cầu bắt buộc.

---

## Ưu tiên nếu thời gian gấp

Nếu deadline gấp (vd: cần có gì đó trong CV sớm), thứ tự cắt giảm hợp lý:
1. Bỏ giai đoạn 6 (stretch) hoàn toàn
2. Bỏ Docker Compose self-hosted bundle, chỉ giữ bản deploy cloud
3. Rút gọn giai đoạn 5 xuống chỉ CI/CD cơ bản, bỏ analytics dashboard chi tiết
4. **Không được cắt giai đoạn 4 (API/Slack)** — đây là phần định vị khác biệt, cắt sẽ mất luôn lý do dự án này đáng làm thay vì dùng NotebookLM
