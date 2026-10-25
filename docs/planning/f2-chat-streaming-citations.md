# Báo cáo Hoàn thành Giai đoạn F2: Chat AI, SSE Streaming & Trích dẫn nguồn

> **Dự án**: DocMind — SaaS RAG đa tenant cho tài liệu doanh nghiệp  
> **Nhánh Git**: `feat/f2-chat`  
> **Thời gian hoàn thành**: 25/10/2026  
> **Trạng thái**: ✅ **HOÀN THÀNH (100% DONE)**

---

## 1. Mục tiêu Giai đoạn F2

Giai đoạn F2 hiện thực hoá trái tim và trải nghiệm tương tác cốt lõi của sản phẩm DocMind:
1. **Kiến trúc Bố cục 3 Cột (3-Column Layout)**: Tuân thủ nghiêm ngặt mục 3 của `DESIGN.md` — `[Lịch sử hội thoại] | [Cuộc hội thoại chính] | [Panel nguồn đối soát]`.
2. **Động cơ Stream SSE qua `fetch()`**: Đọc luồng SSE với sự kiện `start`, `delta`, `done`, `error`. Hỗ trợ xác thực `Authorization: Bearer` (khắc phục điểm yếu không thể gắn header của `EventSource`), cơ chế single-flight refresh token khi gặp 401, và nút Dừng tức thì qua `AbortController`.
3. **Trích dẫn minh bạch (Verifiable Citations)**:
   - Chip trích dẫn `[1]`, `[2]` với tooltip hiển thị trước tên file, số trang/mục tài liệu và độ khớp phần trăm.
   - Khi bấm vào chip: Mở `SourcePanel`, tự động cuộn đến và làm nổi bật nguồn trích dẫn tương ứng.
4. **Quản lý Lịch sử Hội thoại (Conversations Management)**:
   - Phân nhóm thời gian trực quan (*Hôm nay*, *Hôm qua*, *7 ngày trước*, *Cũ hơn*).
   - Tìm kiếm nhanh hội thoại theo tiêu đề hoặc nội dung tin nhắn.
   - Đổi tên và xoá hội thoại với hộp thoại xác nhận bảo vệ dữ liệu.
5. **Điều hướng App Shell**: Tích hợp thanh chuyển đổi linh hoạt giữa **Bộ sưu tập** và **Hội thoại AI** trên toàn bộ hệ thống.

---

## 2. Các công việc đã thực hiện

### 2.1. Schemas, SSE Streaming Engine & Domain Citation Components
- **Schemas (`src/features/chat/schemas/`)**:
  - `chat-schemas.ts`: Schema kiểm thực payload tin nhắn (`SendMessagePayload`), cấu trúc trích dẫn `ChatCitation` (`index`, `documentId`, `filename`, `chunkIndex`, `pageNumber`, `headingContext`, `score`), và các kiểu sự kiện SSE (`start`, `delta`, `done`, `error`).
  - `conversation-schemas.ts`: Kiểu dữ liệu danh sách hội thoại phân trang theo cursor (`ConversationListResponse`) và danh sách tin nhắn (`MessageListResponse`).
- **SSE Engine (`src/lib/sse.ts`)**:
  - Đọc luồng byte qua `fetch()` và `ReadableStreamDefaultReader` + `TextDecoder`.
  - Phân tách boundary `\n\n` chuẩn Server-Sent Events, xử lý trơn tru cả khi chunk dữ liệu bị cắt ngang giữa chừng.
  - Tự động bắt lỗi 429 Rate Limit (đọc header `Retry-After`) và lỗi mạng.
- **Domain Components (`src/components/domain/`)**:
  - `CitationChip`: Chip nhỏ `[1]` chuẩn token OKLCH (`bg-accent-soft text-accent`), phím Tab hỗ trợ trợ năng, `aria-label` mô tả chi tiết nguồn.
  - `SourcePanel`: Danh sách nguồn trích dẫn đối soát, hiển thị độ liên quan phần trăm, vị trí trang hoặc heading context của tài liệu gốc.

---

### 2.2. Lịch sử Hội thoại (Conversation Sidebar & Management)
- **React Query Hooks (`use-conversations.ts`)**: Quản lý truy vấn danh sách hội thoại, mutation đổi tên (`rename`) và xoá (`delete`) với tự động invalidate cache key `['conversations']`.
- **`ConversationList`**:
  - Nhóm hội thoại theo mốc thời gian động.
  - Thanh tìm kiếm tức thời lọc danh sách theo từ khoá.
  - Nút "+ Hội thoại mới" đặt ở vị trí ưu tiên.
- **`RenameConversationDialog`**: Cho phép đổi tên hội thoại dễ dàng.
- **`DeleteConversationDialog`**: Cảnh báo xoá vĩnh viễn toàn bộ tin nhắn bên trong trước khi thực thi.

---

### 2.3. Không gian Chat chính & Kết xuất Markdown
- **Hook `use-chat-messages.ts`**: Nạp lịch sử tin nhắn của từng hội thoại theo thứ tự thời gian.
- **Hook `use-chat-stream.ts`**:
  - Điều khiển gửi tin nhắn, tích luỹ token stream thời gian thực.
  - Nút Dừng (`stopStreaming`) gọi `AbortController.abort()`.
  - Giữ lại phần văn bản đã nhận và hiển thị nút **"Thử lại câu trả lời"** khi luồng gặp sự cố mạng hoặc lỗi máy chủ.
- **`ChatMessageItem`**:
  - Kết xuất markdown an toàn với `react-markdown` và `remark-gfm` (không dùng `dangerouslySetInnerHTML`).
  - Tự động nhận diện cú pháp `[1]`, `[2]` trong nội dung AI để chèn component `CitationChip` tương tác.
  - Nút sao chép phản hồi với phản hồi "Đã sao chép".
  - Chỉ báo câu hỏi được viết lại độc lập (`rewrittenQuery`) giúp người dùng nắm bắt cách AI diễn giải câu hỏi.
- **`ChatInput`**:
  - Khung nhập tin nhắn tự co giãn chiều cao theo nội dung (tối đa 180px).
  - Phím Enter để gửi, Shift+Enter xuống dòng.
  - Bộ lọc phạm vi: Cho phép người dùng chọn đặt câu hỏi trong một Bộ sưu tập cụ thể hoặc trên toàn bộ kho tài liệu.
- **`ChatView`**:
  - Khung 3 cột hoàn chỉnh: Sidebar trái (ẩn/hiện linh hoạt) $\leftrightarrow$ Vùng chat cuộn mượt $\leftrightarrow$ SourcePanel bên phải.

---

### 2.4. Điều hướng App Shell & Tích hợp Tuyến đường
- Tạo route mới `/chat` (`src/app/routes/chat.tsx`).
- Tự động sinh cây route TanStack Router (`routeTree.gen.ts`) hỗ trợ code splitting.
- Đồng bộ thanh chuyển tab (Bộ sưu tập $\leftrightarrow$ Hội thoại AI) trên header toàn cục.

---

## 3. Danh sách kiểm tra "Định nghĩa Xong" (Definition of Done)

- [x] **Typecheck**: `npm run typecheck` đạt 0 lỗi (TypeScript strict mode).
- [x] **Linter**: `npm run lint` đạt 0 lỗi / 0 cảnh báo.
- [x] **Build**: `npm run build` tạo bundle production thành công với route-level code splitting (`chat`, `collections`, `auth`).
- [x] **Chống AI Slop**: Kiểm tra toàn bộ mã nguồn không chứa mã màu hex (`#...`), không có class kích thước tùy ý `[...]`.
- [x] **Trợ năng (a11y)**: 100% thao tác được bằng bàn phím, focus-visible đầy đủ, các button icon-only đều có `aria-label`.
- [x] **i18n**: 100% chuỗi qua hệ thống đa ngôn ngữ (`locales/vi.json` và `locales/en.json`).

---

## 4. Các Commit trên nhánh `feat/f2-chat`

1. `729eb00 feat(f2): setup chat schemas, sse stream engine, and domain citation components`
2. `2519c0e feat(f2): implement conversation list, grouping, rename, and delete dialogs`
3. `346beca feat(f2): implement 3-column chat view, sse answer stream, and citation interaction`
4. `docs(f2): document completion of phase f2 chat, streaming, and citations`
