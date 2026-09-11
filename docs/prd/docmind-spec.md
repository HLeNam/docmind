# DocMind — RAG-based Enterprise Knowledge Infrastructure
## Đặc tả chi tiết (Technical & Functional Specification)

---

## 0. Định vị sản phẩm — Vì sao không chỉ là "NotebookLM clone"

**Vấn đề:** Google NotebookLM (nay là Gemini Notebook) đã giải quyết rất tốt bài toán "chat với tài liệu" ở cấp độ cá nhân/nhóm nhỏ. Một sản phẩm consumer-facing khác khó cạnh tranh trực tiếp.

**Khoảng trống DocMind nhắm vào:** hạ tầng RAG **API-first, tự triển khai (self-hosted), nhúng được vào quy trình nội bộ** — thứ mà một app độc lập như NotebookLM không được thiết kế để làm:

1. **API-first, không phải app độc lập** — bất kỳ hệ thống nào của doanh nghiệp (CRM, ticketing, website support) đều gọi được vào RAG engine qua REST API/SDK, không bắt buộc người dùng phải mở một app riêng.
2. **Self-hosted / triển khai trên hạ tầng riêng** — dành cho tổ chức có yêu cầu compliance (ngân hàng, y tế, chính phủ) không được đẩy dữ liệu ra cloud bên thứ 3.
3. **Nhúng trực tiếp vào workflow có sẵn** — Slack bot, widget chat trên website, plugin cho internal tool — thay vì bắt nhân viên chuyển sang một app mới.
4. **Retrieval pipeline tùy biến được** — chunking, reranking, hybrid search weighting có thể điều chỉnh theo domain đặc thù (luật, kỹ thuật, y tế), không phải hộp đen.
5. **Không giới hạn nguồn cứng theo gói** — kiến trúc tự thiết kế để scale theo nhu cầu thực tế của tổ chức, không bị cap 50-600 file như các gói NotebookLM.

**Câu chuyện định vị khi trình bày trong phỏng vấn:** *"DocMind không cạnh tranh ở việc làm research cá nhân — nó là hạ tầng RAG để nhúng vào quy trình nội bộ doanh nghiệp đã có sẵn."*

---

## 1. Tổng quan sản phẩm

**Mục tiêu:** Hạ tầng RAG đa tenant, API-first, có thể self-hosted, cho phép doanh nghiệp nhúng khả năng "chat với tài liệu nội bộ" vào các hệ thống/kênh giao tiếp họ đã dùng (Slack, website, internal tools) — không chỉ là một app chat độc lập.

**Đối tượng người dùng:**
- Admin: quản lý workspace, upload/xóa tài liệu, xem analytics, quản lý API key
- Member: chat hỏi-đáp qua web UI hoặc qua kênh tích hợp (Slack), xem lịch sử hội thoại của mình
- Developer (bên thứ 3 trong tổ chức): gọi RAG engine qua API để nhúng vào hệ thống khác
- (Optional) Super Admin: quản lý toàn hệ thống, billing, giới hạn usage theo plan

**Giá trị cốt lõi khi demo phỏng vấn:**
- Retrieval accuracy (hybrid search) + citation minh bạch
- Kiến trúc API-first — có thể gọi RAG engine từ bất kỳ đâu, không phụ thuộc UI
- Self-hosted deployment (Docker Compose / Helm chart) — thể hiện tư duy production-ready
- Slack bot tích hợp thật — thể hiện khả năng nhúng vào workflow có sẵn
- Xử lý bất đồng bộ quy mô (embedding pipeline)
- Multi-tenant isolation đúng chuẩn

---

## 2. Kiến trúc tổng thể

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  React SPA  │────▶│  NestJS API  │────▶│   PostgreSQL     │
│ (TanStack)  │◀────│   (REST +    │     │   + pgvector     │
└─────────────┘ SSE │   WebSocket) │     └─────────────────┘
                     └──────┬───────┘
                            │
                ┌───────────┼────────────┐
                ▼           ▼            ▼
          ┌──────────┐ ┌─────────┐ ┌───────────┐
          │  BullMQ  │ │  Redis  │ │ S3-compat │
          │ (Worker) │ │ (cache) │ │  Storage  │
          └────┬─────┘ └─────────┘ └───────────┘
               │
               ▼
      ┌─────────────────┐
      │ Embedding API +  │
      │  LLM API         │
      │ (OpenAI/Anthropic)│
      └─────────────────┘
```

---

## 3. Chức năng chi tiết theo module

### 3.1 Module: Quản lý tài liệu (Document Management)

**3.1.1 Upload tài liệu**
- Hỗ trợ định dạng: PDF, DOCX, TXT, Markdown, HTML (paste URL để crawl)
- Upload đa file (drag & drop), giới hạn dung lượng theo plan (ví dụ free: 10MB/file)
- Lưu file gốc vào S3-compatible storage, lưu metadata vào DB
- Trạng thái xử lý: `pending` → `processing` → `indexed` → `failed`
- Validation: kiểm tra định dạng, kiểm tra virus/malware cơ bản (optional)

**3.1.2 Tổ chức nội dung**
- Khái niệm "Collection" (workspace con) — ví dụ: "HR Policies", "Product Docs", "Engineering Wiki"
- Mỗi tài liệu thuộc 1 hoặc nhiều collection
- Gắn tag/label cho tài liệu để lọc

**3.1.3 Xử lý tài liệu (Document Processing Pipeline)**
- Extract text:
  - PDF: pdf-parse hoặc pdfplumber (qua worker riêng nếu cần Python)
  - DOCX: mammoth.js
  - Scan/ảnh: OCR (Tesseract.js hoặc Google Vision API)
- Chunking strategy:
  - Chia theo section/heading nếu có cấu trúc
  - Fallback: sliding window ~500 tokens, overlap 50 tokens
  - Lưu metadata mỗi chunk: `document_id`, `page_number`, `chunk_index`, `heading_context`
- Re-index: khi tài liệu update, xóa chunks cũ, tạo lại embeddings

**3.1.4 Quản lý vòng đời**
- Xem preview tài liệu (render PDF/docx trong browser)
- Xóa tài liệu (soft delete + cascade xóa chunks/embeddings)
- Version history (optional, nâng cao): giữ lại version cũ khi re-upload

---

### 3.2 Module: Embedding & Vector Pipeline

**3.2.1 Job xử lý bất đồng bộ**
- Khi upload xong → enqueue job vào BullMQ (`document.process`)
- Worker thực hiện: extract → chunk → generate embedding → lưu pgvector
- Retry logic: 3 lần retry với exponential backoff nếu API embedding fail
- Progress tracking: cập nhật % hoàn thành, emit qua WebSocket để FE hiển thị progress bar

**3.2.2 Embedding model**
- Dùng OpenAI `text-embedding-3-small` (1536 dimensions) hoặc Cohere embed
- Batch embedding request để tối ưu chi phí (gộp nhiều chunks/lần gọi)
- Lưu vector vào cột `vector(1536)` trong PostgreSQL (pgvector extension)
- Index: HNSW hoặc IVFFlat cho tìm kiếm nhanh

**3.2.3 Cân nhắc chi phí**
- Cache embedding nếu nội dung trùng lặp (hash content trước khi gọi API)
- Rate limiting để tránh vượt quota API

---

### 3.3 Module: Chat & Retrieval (RAG Core)

**3.3.1 Retrieval**
- Hybrid search: kết hợp
  - Vector similarity search (cosine distance qua pgvector)
  - Full-text search (PostgreSQL `tsvector`/`ts_rank`)
  - Reciprocal Rank Fusion (RRF) để merge 2 kết quả
- Filter theo collection mà user có quyền truy cập (permission-aware retrieval)
- Top-K retrieval (mặc định K=5), có re-ranking bước 2 (optional: Cohere rerank API)

**3.3.2 Generation**
- Prompt template: system prompt + context (chunks) + câu hỏi + lịch sử hội thoại
- Streaming response qua SSE (Server-Sent Events) hoặc WebSocket
- Giới hạn context window: cắt bớt chunks nếu vượt token limit
- Trả về kèm **citation**: mapping câu trả lời với chunk/tài liệu nguồn (hiển thị số thứ tự [1][2] link tới đoạn gốc)

**3.3.3 Conversation Management**
- Lưu lịch sử hội thoại theo session/thread
- Multi-turn: model cần hiểu ngữ cảnh câu hỏi trước (dùng conversation history trong prompt, hoặc query rewriting)
- Tạo title tự động cho conversation (dựa trên câu hỏi đầu)
- Xóa/archive conversation

**3.3.4 Xử lý câu hỏi "không có trong tài liệu"**
- Nếu retrieval score thấp dưới ngưỡng → trả lời "Không tìm thấy thông tin trong tài liệu" thay vì bịa
- Log lại các câu hỏi này để phân tích gap (dùng cho Analytics module)

---

### 3.4 Module: Người dùng & Phân quyền

**3.4.1 Multi-tenancy**
- Mỗi công ty = 1 tenant (dùng `tenant_id` + PostgreSQL RLS giống pattern anh đã dùng ở SlotHub)
- Subdomain hoặc workspace slug riêng (`company.docmind.app`)

**3.4.2 Roles & Permissions**
| Role | Upload tài liệu | Xóa tài liệu | Chat | Xem analytics | Quản lý user |
|---|---|---|---|---|---|
| Owner | ✅ | ✅ | ✅ | ✅ | ✅ |
| Admin | ✅ | ✅ | ✅ | ✅ | ❌ |
| Member | ❌ | ❌ | ✅ | ❌ | ❌ |

- Permission theo Collection (member chỉ thấy collection được share)
- Invite user qua email, accept invitation flow

**3.4.3 Authentication**
- JWT + refresh token
- OAuth (Google Workspace login — hợp lý vì target là doanh nghiệp)
- (Optional) SSO/SAML cho enterprise tier

---

### 3.5 Module: Analytics & Admin Dashboard

**3.5.1 Thống kê sử dụng**
- Top câu hỏi được hỏi nhiều nhất (clustering câu hỏi tương tự bằng embedding similarity)
- Câu hỏi "không trả lời được" (knowledge gap report)
- Số lượt chat theo ngày/tuần, theo user

**3.5.2 Chi phí & Usage**
- Token usage tracking (embedding + generation) theo tenant
- Cảnh báo khi gần đạt giới hạn plan
- Dashboard chi phí ước tính (map token → USD)

**3.5.3 Document health**
- Tài liệu nào chưa từng được retrieve (có thể là nội dung thừa)
- Tài liệu lỗi xử lý (failed indexing) cần xử lý lại

---

### 3.6 Module: API-first & Nhúng vào workflow (CORE — không còn là stretch goal)

**3.6.1 Public API cho Developer**
- API key management: tạo/thu hồi key theo tenant, scope theo collection
- REST API đầy đủ để bên thứ 3 gọi: `POST /v1/query` (RAG query trực tiếp, trả về answer + citations dạng JSON, không cần UI)
- Rate limiting theo API key, usage tracking riêng cho traffic từ API (khác với traffic từ web UI)
- SDK nhẹ (npm package) để dev team khác trong công ty tích hợp nhanh vào hệ thống của họ
- Webhook outbound: bắn event khi có câu hỏi "không trả lời được" để hệ thống khác (vd: ticketing) tự tạo task

**3.6.2 Slack Bot Integration (triển khai thật, không phải mock)**
- Slack App: `/ask <câu hỏi>` trong channel bất kỳ, trả lời kèm citation dạng Slack block kit
- OAuth install flow chuẩn (Slack App Directory pattern)
- Map Slack workspace ↔ tenant, map Slack channel ↔ collection cụ thể (để câu hỏi trong channel HR chỉ retrieve tài liệu HR)
- Threading: trả lời trong thread để không làm loãng channel

**3.6.3 Self-hosted Deployment**
- Docker Compose bundle đầy đủ (API + worker + Postgres/pgvector + Redis) để chạy on-premise
- Helm chart cơ bản cho triển khai Kubernetes (thể hiện tư duy DevOps)
- Config qua biến môi trường để dùng LLM provider khác nhau (OpenAI/Anthropic/local model qua Ollama) — quan trọng cho tổ chức không được gọi API ra ngoài
- Tài liệu deploy rõ ràng (README chuẩn production)

**3.6.4 Auto-sync nguồn ngoài**
- Google Drive: OAuth connect, webhook khi file thay đổi → tự động re-index
- Notion API: sync database/pages định kỳ (cron job)
- Confluence (optional): phù hợp với nhóm khách hàng doanh nghiệp dùng Atlassian

**3.6.5 Feedback loop**
- Thumbs up/down cho mỗi câu trả lời
- Lưu feedback để sau này fine-tune retrieval (điều chỉnh threshold, re-ranking weight)

**3.6.6 Mobile app (Expo) — stretch thật sự, làm sau cùng nếu còn thời gian**
- App tra cứu nhanh cho member, push notification khi có tài liệu mới quan trọng

---

## 4. Data Model (rút gọn)

```
Tenant (id, name, plan, created_at)
User (id, tenant_id, email, role, created_at)
Collection (id, tenant_id, name, description)
Document (id, tenant_id, collection_id, filename, file_url, status, uploaded_by, created_at)
DocumentChunk (id, document_id, content, embedding vector(1536), page_number, chunk_index)
Conversation (id, tenant_id, user_id, title, created_at)
Message (id, conversation_id, role, content, citations jsonb, created_at)
Feedback (id, message_id, user_id, rating, created_at)
UsageLog (id, tenant_id, type, tokens, cost, created_at)
```

---

## 5. API Endpoints (rút gọn — REST)

```
POST   /auth/login
POST   /auth/register

GET    /collections
POST   /collections
DELETE /collections/:id

POST   /documents/upload
GET    /documents?collection_id=
DELETE /documents/:id
GET    /documents/:id/status        # polling hoặc dùng WS

POST   /conversations
GET    /conversations/:id
POST   /conversations/:id/messages  # trả về stream SSE
DELETE /conversations/:id

POST   /messages/:id/feedback

GET    /analytics/top-questions
GET    /analytics/gaps
GET    /analytics/usage
```

WebSocket events: `document.progress`, `chat.token` (streaming), `chat.done`, `chat.citation`

---

## 6. Non-functional requirements

- **Bảo mật:** RLS đảm bảo tenant isolation ở DB level, không chỉ ở application logic
- **Hiệu năng:** Retrieval < 500ms (chưa tính LLM generation), dùng HNSW index cho pgvector
- **Chi phí:** Cache aggressively, batch embedding, giới hạn context window
- **Khả năng mở rộng:** Worker (BullMQ) scale ngang độc lập với API server
- **Quan sát hệ thống (observability):** Structured logging (Pino), health check endpoint `/health`, theo dõi job queue (Bull Board)

---

## 7. Đề xuất roadmap xây dựng (để không bị ngợp)

**Giai đoạn 1 — Core RAG (2-3 tuần):**
Upload tài liệu → extract → chunk → embedding → vector search → chat cơ bản (không streaming)

**Giai đoạn 2 — UX & Multi-tenant (1-2 tuần):**
Streaming chat, citation UI, auth + roles, multi-tenant RLS

**Giai đoạn 3 — API-first & Slack integration (1-2 tuần):**
Public API + API key management, Slack bot end-to-end — đây là phần **chứng minh định vị khác biệt** so với NotebookLM, nên ưu tiên trước analytics

**Giai đoạn 4 — Production polish & Self-hosted (1-2 tuần):**
Docker Compose bundle, CI/CD, analytics dashboard, observability, error handling edge cases

**Giai đoạn 5 — Stretch (nếu còn thời gian):**
Google Drive sync, feedback loop, Helm chart, mobile app

---

## 8. Tech stack tổng hợp

| Layer | Công nghệ |
|---|---|
| Backend | NestJS, Prisma, PostgreSQL + pgvector |
| Queue | BullMQ + Redis |
| Frontend | React, TanStack Router/Query, Zustand |
| Storage | S3-compatible (Cloudflare R2 / MinIO) |
| LLM/Embedding | OpenAI API hoặc Anthropic API |
| Realtime | WebSocket (Socket.io) hoặc SSE |
| Mobile (stretch) | Expo |
| Deploy | Railway/Fly.io/VPS + GitHub Actions CI/CD |
