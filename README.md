<p align="center">
  <img src="assets/branding/docmind-logo.svg" width="128" height="128" alt="DocMind Logo" />
</p>

<h1 align="center">DocMind</h1>

<p align="center">
  <strong>Enterprise Multi-Tenant RAG Knowledge Base with Verifiable Citations</strong><br>
  Nền tảng hỏi đáp thông minh trên tài liệu doanh nghiệp, loại bỏ ảo giác AI với trích dẫn nguồn minh bạch.
</p>

<p align="center">
  <a href="#-tính-năng-cốt-lõi"><img src="https://img.shields.io/badge/Architecture-Multi--Tenant%20RLS-blue.svg?style=flat-square" alt="Multi-Tenant RLS" /></a>
  <a href="#-công-nghệ"><img src="https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite%20%7C%20Tailwind%20v4-61DAFB.svg?style=flat-square" alt="React 19 Vite" /></a>
  <a href="#-công-nghệ"><img src="https://img.shields.io/badge/Backend-NestJS%2011%20%7C%20Prisma%20ORM-E0234E.svg?style=flat-square" alt="NestJS 11 Prisma" /></a>
  <a href="#-công-nghệ"><img src="https://img.shields.io/badge/Database-PostgreSQL%20%2B%20pgvector-336791.svg?style=flat-square" alt="PostgreSQL pgvector" /></a>
  <a href="#-công-nghệ"><img src="https://img.shields.io/badge/Security-Memory%20JWT%20%2B%20Web%20Locks-success.svg?style=flat-square" alt="Security" /></a>
  <a href="#-giấy-phép"><img src="https://img.shields.io/badge/License-MIT-green.svg?style=flat-square" alt="License MIT" /></a>
</p>

---

## 📖 Giới thiệu (Overview)

**DocMind** là giải pháp SaaS Retrieval-Augmented Generation (RAG) toàn diện dành cho doanh nghiệp. Hệ thống cho phép các tổ chức tải lên khối lượng lớn tài liệu nội bộ (PDF, DOCX, PPTX, bảng tính XLSX/CSV, tài liệu scan ảnh OCR) vào các **Bộ sưu tập** riêng biệt, tra cứu và hỏi đáp AI với tốc độ cao, và đặc biệt **mỗi câu trả lời đều có trích dẫn nguồn có thể kiểm chứng (Verifiable Citations)**.

### Triết lý sản phẩm
1. **Yên tĩnh & Dễ đọc (Quiet & Editorial)**: Chữ và nội dung tài liệu là nhân vật chính. Giao diện tối giản, thanh lịch, dựa trên viền và màu ngữ nghĩa OKLCH thay vì bóng đổ hào nhoáng.
2. **Đáng tin cậy tuyệt đối**: Không bao giờ đưa ra câu trả lời không có bằng chứng. Mọi số liệu hay lập luận đều gắn kèm số trang, đoạn trích và độ khớp tương quan.
3. **Cô lập dữ liệu nghiêm ngặt**: Đảm bảo Tenant A tuyệt đối không thể truy cập tài liệu hay hội thoại của Tenant B bằng Row-Level Security (RLS) ở tầng cơ sở dữ liệu.

---

## ✨ Tính năng cốt lõi (Core Features)

### 1. Quản lý Bộ sưu tập & Kho tài liệu (Collections & Documents)
- **Tổ chức theo chủ đề**: Gom nhóm tài liệu theo phòng ban, dự án hoặc danh mục nghiệp vụ.
- **Đa định dạng tài liệu**: Hỗ trợ `.pdf`, `.docx`, `.pptx`, `.xlsx`, `.csv`, `.txt`, `.md`.
- **OCR thông minh**: Tự động nhận dạng ký tự đối với tài liệu scan ảnh chất lượng kém.
- **Tiến độ xử lý thời gian thực**: Lắng nghe WebSocket (`/realtime`) cập nhật từng bước: *Trích xuất văn bản* $\rightarrow$ *Phân đoạn (Chunking)* $\rightarrow$ *OCR* $\rightarrow$ *Vector Embedding* $\rightarrow$ *Lưu trữ chỉ mục (Indexing)*.
- **Tái chỉ mục (Re-index) & Xoá an toàn**: Dễ dàng chạy lại pipeline nhúng vector hoặc xoá hoàn toàn dữ liệu trích dẫn khi cần.

### 2. Trợ lý AI & Trích dẫn minh bạch (Conversational RAG & Citations)
- **Truy xuất lai (Hybrid Search)**: Kết hợp tìm kiếm ngữ nghĩa Dense Vector (pgvector) với Full-text Search (BM25) để tối ưu độ chính xác.
- **Stream câu trả lời SSE**: Tốc độ phản hồi tức thì với hiệu ứng gõ chữ và nút Dừng/Thử lại linh hoạt.
- **Chip trích dẫn tương tác `[1]`, `[2]`**:
  - Di chuột: Xem nhanh tên tài liệu, trang số và đoạn tóm tắt.
  - Bấm chọn: Mở Panel nguồn bên phải, tự động cuộn đến và tô đậm văn bản gốc trong tài liệu kèm chỉ số tin cậy.

### 3. Bảo mật & Cô lập Doanh nghiệp (Enterprise Security)
- **Xác thực an toàn (Zero XSS)**: Access Token (JWT) được lưu thuần túy **trong bộ nhớ** (Module memory), tuyệt đối không lưu ở `localStorage` hay `sessionStorage`.
- **Single-Flight Refresh & Web Locks**: Refresh token lưu tại cookie HttpOnly; cơ chế Web Locks API ngăn chặn token reuse race-condition khi người dùng mở nhiều tab cùng lúc.
- **Phân quyền vai trò (RBAC)**: Phân cấp rõ rệt giữa Chủ sở hữu (`OWNER`), Quản trị viên (`ADMIN`), và Thành viên (`MEMBER`).

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

### Frontend (`frontend/`)
| Công nghệ | Vai trò & Mục đích |
| :--- | :--- |
| **Vite + React 19** | Nền tảng SPA hiệu năng cao, Strict Mode, React Compiler ready |
| **TypeScript (Strict)** | Đảm bảo tính toàn vẹn kiểu dữ liệu, không sử dụng `any` |
| **TanStack Router** | File-based routing tự động sinh cây route và tách nhỏ bundle |
| **TanStack Query v5** | Quản lý Server State, cơ chế cache phân cấp và đồng bộ dữ liệu |
| **Tailwind CSS v4** | Hệ thống style thế hệ mới với CSS Tokens OKLCH (Light & Dark mode) |
| **Base UI / shadcn** | Bộ thành phần giao diện không style, đạt chuẩn trợ năng WCAG 2.2 AA |
| **Socket.IO Client** | Kết nối WebSocket hai chiều nhận tiến độ xử lý file realtime |
| **React Markdown + GFM** | Kết xuất câu trả lời AI an toàn (không dùng `dangerouslySetInnerHTML`) |
| **i18next** | Quốc tế hóa toàn diện (mặc định Tiếng Việt `vi`, sẵn sàng Tiếng Anh `en`) |

### Backend (`backend/`)
| Công nghệ | Vai trò & Mục đích |
| :--- | :--- |
| **NestJS 11** | Framework kiến trúc module hóa vững chắc trên nền Node.js / Express |
| **Prisma ORM** | Quản lý schema, migrations và truy vấn CSDL an toàn |
| **PostgreSQL + pgvector** | Lưu trữ dữ liệu quan hệ, cô lập RLS và tìm kiếm vector tương đồng |
| **Redis + BullMQ** | Hàng đợi tác vụ xử lý tài liệu nền (background job processing) |
| **RustFS / MinIO** | Kho lưu trữ đối tượng tương thích chuẩn Amazon S3 |
| **LangChain / OpenAI / Gemini** | Pipeline chia đoạn văn bản, trích xuất và tạo vector nhúng |
| **Socket.IO Gateway** | Phát sóng tiến độ xử lý tài liệu theo từng tenant room |

---

## 📁 Cấu trúc thư mục Monorepo

```bash
docmind/
├── assets/                       # Tài nguyên thương hiệu (Logo SVG, PNG icons)
│   └── branding/
├── backend/                      # Mã nguồn NestJS Backend
│   ├── prisma/                   # Prisma Schema, Migrations & RLS policies
│   ├── src/
│   │   ├── auth/                 # Xác thực JWT, Refresh token, Google OAuth
│   │   ├── collections/          # Quản lý bộ sưu tập tài liệu
│   │   ├── documents/            # Xử lý upload, parser, chunker, OCR, embeddings
│   │   ├── chat/                 # RAG engine, hybrid search, SSE stream
│   │   ├── realtime/             # WebSocket progress gateway
│   │   └── common/               # Interceptors, guards, filters, RLS decorators
│   └── test/
├── frontend/                     # Mã nguồn Vite + React Frontend
│   ├── src/
│   │   ├── app/                  # Router TanStack, providers, layouts
│   │   ├── features/             # Feature modules (auth, collections, documents, chat)
│   │   ├── components/           # UI components (Base UI) & Domain components
│   │   ├── lib/                  # API client, token manager, socket, i18n
│   │   ├── locales/              # Bản dịch ngôn ngữ (vi.json, en.json)
│   │   └── styles/               # tokens.css (OKLCH palette), globals.css
│   └── public/
├── docs/                         # Tài liệu kiến trúc và kế hoạch phát triển
│   └── planning/                 # Báo cáo hoàn thành từng giai đoạn (F0, F1...)
├── docker-compose.dev.yml        # Dịch vụ phụ trợ môi trường dev (Postgres, Redis, RustFS)
├── DESIGN.md                     # Tiêu chuẩn thiết kế giao diện & quy tắc chống AI-slop
└── AGENTS.md                     # Nguyên tắc làm việc và quy chuẩn kỹ thuật cho AI
```

---

## 🚀 Hướng dẫn cài đặt & Khởi chạy (Quickstart)

### 1. Yêu cầu hệ thống
- **Node.js**: Phiên bản 20.x hoặc 22.x LTS
- **Package Manager**: `npm`
- **Docker & Docker Compose**: Để chạy Postgres, Redis và S3 Storage

### 2. Khởi động hạ tầng dịch vụ (Docker)
Từ thư mục gốc dự án:
```bash
docker compose -f docker-compose.dev.yml up -d
```
*Lệnh này sẽ khởi động PostgreSQL (port 5433 nội bộ/5432 container), Redis (port 6379), và RustFS (port 9000).*

### 3. Thiết lập Backend
```bash
cd backend

# Cài đặt thư viện
npm install

# Thiết lập biến môi trường (sao chép từ .env.example nếu có)
# Chạy migration database và kích hoạt RLS
npm run prisma:migrate

# Khởi động máy chủ backend ở chế độ watch
npm run start:dev
```
- Backend sẽ lắng nghe tại: `http://localhost:3000`
- Tài liệu API tương tác Swagger: `http://localhost:3000/api/docs`

### 4. Thiết lập Frontend
Mở một cửa sổ terminal mới:
```bash
cd frontend

# Cài đặt thư viện
npm install

# Khởi động Vite dev server
npm run dev
```
- Frontend sẽ chạy tại: `http://localhost:5173`
- Mọi yêu cầu `/api` và `/socket.io` được Vite tự động proxy ngầm sang backend `localhost:3000`.

### 5. Tài khoản thử nghiệm
Bạn có thể đăng ký tài khoản mới trực tiếp tại `http://localhost:5173/register` hoặc sử dụng tài khoản mẫu:
- **Email**: `demo@docmind.vn`
- **Mật khẩu**: `Password123`
- **Vai trò**: `OWNER` (Chủ sở hữu)

---

## 🗺️ Lộ trình phát triển (Roadmap)

- [x] **Phase F0: Nền móng & Xác thực (Foundations & Auth)**
  - Tái cấu trúc monorepo, thiết lập Design Tokens OKLCH.
  - Động cơ xác thực an toàn: Memory JWT, Single-flight refresh token, Web Locks, Google OAuth.
  - Trang đăng nhập, đăng ký và chọn Workspace đa tenant.
- [x] **Phase F1: Bộ sưu tập & Quản lý Tài liệu (Collections & Documents)**
  - Quản lý danh sách, tạo mới, xoá cascade bộ sưu tập.
  - Vùng kéo thả tải lên nhiều file, kiểm soát định dạng & kích thước.
  - Socket.IO Realtime hiển thị tiến độ phân tích văn bản từng bước.
  - Bảng tài liệu, badge trạng thái kèm lý do lỗi, nút tái chỉ mục.
- [x] **Phase F2: Trợ lý Chat & Trích dẫn minh bạch (AI Chat & Citations)**
  - Bố cục 3 cột chuyên nghiệp: Lịch sử $\leftrightarrow$ Chat Stream $\leftrightarrow$ Panel đối soát nguồn.
  - Stream câu trả lời SSE, chip trích dẫn tương tác highlight vị trí tài liệu gốc.
  - Lịch sử hội thoại nhóm theo ngày, tìm kiếm và quản lý phiên chat.
- [x] **Phase F3: Cài đặt & Tích hợp Doanh nghiệp (Settings & Integrations)**
  - Quản lý thành viên nhóm, phân quyền RBAC và gửi lời mời qua email/link chấp nhận `/accept-invite`.
  - Cổng nhà phát triển: Quản lý API Key có scoped permission theo từng bộ sưu tập.
  - Tích hợp Slack Bot tự động trả lời câu hỏi trực tiếp trên các kênh nội bộ kèm ánh xạ channel.
  - Bảng đồng hồ theo dõi token tiêu thụ (LLM & Embedding) và chi phí ước tính theo ngày (Usage Meter).
- [x] **Phase F4: Hoàn thiện & Tối ưu hóa (Polish & Launch)**
  - Nút chuyển đổi giao diện Sáng/Tối (Dark Mode Toggle) lưu trữ trạng thái và tự động nhận diện hệ thống.
  - Bổ sung Skip Link truy cập nhanh và rà soát phím bấm đạt chuẩn trợ năng WCAG 2.2 AA.
  - Hạ tầng kiểm thử tự động Vitest + Testing Library + vitest-axe với 20/20 test cases vượt qua.
  - Kịch bản kiểm thử luồng người dùng E2E với Playwright và Axe-Core.

---

## 📜 Giấy phép (License)

Dự án được phân phối dưới giấy phép **MIT License**. Xem chi tiết tại tập tin `LICENSE`.

---

<p align="center">
  Xây dựng với niềm đam mê dành cho tri thức doanh nghiệp chính xác và minh bạch.
</p>
