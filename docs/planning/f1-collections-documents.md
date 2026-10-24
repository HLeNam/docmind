# Báo cáo Hoàn thành Giai đoạn F1: Bộ sưu tập & Quản lý Tài liệu (Collections & Documents)

> **Dự án**: DocMind — SaaS RAG đa tenant cho tài liệu doanh nghiệp  
> **Nhánh Git**: `feat/f1-collections`  
> **Thời gian hoàn thành**: 25/10/2026  
> **Trạng thái**: ✅ **HOÀN THÀNH (100% DONE)**

---

## 1. Mục tiêu Giai đoạn F1

Giai đoạn F1 tập trung vào xây dựng xương sống dữ liệu của DocMind:
1. **Quản lý Bộ sưu tập (Collections)**: Cho phép tổ chức tài liệu theo chủ đề/dự án, tạo mới, liệt kê, và xoá an toàn (cascade delete).
2. **Quản lý Tài liệu (Documents)**: Hỗ trợ tải lên đa định dạng (`PDF`, `DOCX`, `PPTX`, `XLSX`, `CSV`, `TXT`, `MD`), kiểm tra định dạng và dung lượng nghiêm ngặt.
3. **Tiến độ xử lý Realtime (Socket.IO)**: Lắng nghe tiến độ xử lý văn bản, chunking, OCR fallback, vector embedding và indexing trực tiếp từ WebSocket gateway `/realtime`.
4. **Phân quyền vai trò (RBAC)**: Chỉ `OWNER`/`ADMIN` được quyền tạo/xoá bộ sưu tập, tải lên/tái chỉ mục tài liệu; vai trò `MEMBER` được bảo vệ với trải nghiệm xem an toàn.
5. **Giao diện chuẩn Design Tokens**: Tuân thủ triệt để `DESIGN.md` (phong cách "Yên tĩnh, biên tập", không mã màu hex, đầy đủ i18n tiếng Việt/tiếng Anh, đạt chuẩn trợ năng WCAG 2.2 AA).

---

## 2. Các công việc đã thực hiện

### 2.1. Cấu hình Schema, API Client & Domain Components
- **Collections**:
  - `src/features/collections/schemas/collection-schemas.ts`: Schema Zod kiểm thực tên (1–200 ký tự) và mô tả (tối đa 2000 ký tự).
  - `src/features/collections/api/collections-api.ts`: API client tự động hóa cho `list()`, `create(dto)`, `delete(id)`.
- **Documents**:
  - `src/features/documents/schemas/document-schemas.ts`: Enum trạng thái backend (`PENDING`, `PROCESSING`, `INDEXED`, `FAILED`), định nghĩa các phase xử lý (`extracting`, `chunking`, `ocr`, `embedding`, `indexing`, `completed`, `failed`), ngưỡng giới hạn 50MB (tài liệu) và 10MB (bảng tính XLSX/CSV).
  - `src/features/documents/api/documents-api.ts`: Multipart FormData upload, `list(collectionId)`, `getStatus(id)`, `reindex(id)`, `delete(id)`.
- **Domain Components (`components/domain/`)**:
  - `DocumentStatusBadge`: Huy hiệu trạng thái với icon động theo ngữ cảnh (đồng hồ cát khi chờ, spinner xoay khi đang xử lý, tick xanh khi sẵn sàng, tam giác cảnh báo kèm tooltip lý do khi thất bại).
  - `EmptyState`: Khung trạng thái rỗng tối giản, icon ngữ nghĩa, mô tả rõ ràng và nút hành động đầu tiên.

---

### 2.2. Giao diện Quản lý Bộ sưu tập (Collections UI)
- **React Query Hooks (`use-collections.ts`)**: Quản lý query key phân tầng `['collections']`, tự động invalidate khi thêm/xoá bộ sưu tập.
- **`CreateCollectionDialog`**:
  - Modal tạo bộ sưu tập sử dụng Base UI `Dialog` và `react-hook-form` + `zodResolver`.
  - Phím Tab logic, `aria-describedby` báo lỗi, nút Primary duy nhất kèm spinner `Loader2` khi đang gửi yêu cầu.
- **`DeleteCollectionDialog`**:
  - Modal cảnh báo phá huỷ, nêu rõ hệ quả cascade xoá toàn bộ tài liệu bên trong để người dùng cân nhắc.
- **`CollectionCard`**:
  - Thẻ hiển thị bộ sưu tập chuẩn token OKLCH: tên, mô tả rút gọn, ngày tạo theo chuẩn `vi-VN`.
  - Thao tác nhanh qua `DropdownMenu` (chỉ hiển thị cho `OWNER`/`ADMIN`).
- **`CollectionList`**:
  - Lưới card responsive (`sm:grid-cols-2 lg:grid-cols-3`).
  - Đầy đủ 4 trạng thái bắt buộc: **Loading** (lưới Skeleton thẻ), **Error** (báo lỗi + nút Thử lại), **Empty** (EmptyState hướng dẫn tạo), **Phân quyền** (thông điệp riêng cho vai trò Member).

---

### 2.3. Quản lý Tài liệu & Tiến độ Realtime (Documents & Socket.IO)
- **Socket Client (`src/lib/socket.ts`)**:
  - Singleton kết nối `socket.io-client` vào namespace `/realtime`.
  - Handshake xác thực bằng JWT access token lấy trực tiếp từ bộ nhớ.
  - Tự động ngắt kết nối (cleanup) khi người dùng đăng xuất.
- **Kéo thả tệp (`UploadDropzone`)**:
  - Vùng kéo thả tệp với phản hồi viền và nền khi hover kéo file.
  - Hỗ trợ chọn/kéo thả nhiều file đồng thời.
  - Kiểm tra trước định dạng tệp và kích thước (báo lỗi tiếng Việt cụ thể cho từng tệp vi phạm).
- **Tiến độ thời gian thực (`UploadProgressList`)**:
  - Lắng nghe sự kiện `document.progress` từ server.
  - Thanh tiến độ động theo phần trăm và nhãn tiếng Việt tương ứng từng bước: *Đang trích xuất văn bản*, *Đang phân đoạn nội dung*, *Đang nhận dạng chữ (OCR)*, *Đang tạo vector embedding*, *Đang lưu trữ chỉ mục*.
- **Bảng tài liệu (`DocumentTable`)**:
  - Bảng tài liệu sạch sẽ, phân biệt icon theo loại file (PDF đỏ, Word xanh lam, Excel xanh lá, Text hổ phách).
  - Tích hợp inline tiến độ realtime ngay trên dòng tài liệu đang xử lý.
  - Nút Tái chỉ mục (`reindex`) và Xoá tài liệu (`delete`) có modal xác nhận.
- **Chi tiết bộ sưu tập (`CollectionDocumentsView`)**:
  - Breadcrumb điều hướng `Bộ sưu tập / <Tên bộ sưu tập>` mượt mà.
  - Nút chuyển đổi nhanh vùng upload tệp.

---

### 2.4. Sửa lỗi Điều hướng Đăng nhập (Auth Redirect Fix)
- Khắc phục triệt để lỗi người dùng sau khi đăng nhập bị giữ lại trang auth:
  - Đồng bộ `token` vào React state của `AuthProvider`.
  - Gọi `await queryClient.fetchQuery(...)` nạp sẵn thông tin tài khoản `me` trước khi redirect sang trang chủ, loại bỏ hiện tượng bị route guard trả ngược về `/login`.

---

## 3. Danh sách kiểm tra "Định nghĩa Xong" (Definition of Done)

- [x] **Typecheck**: `npm run typecheck` đạt 0 lỗi (TypeScript strict mode).
- [x] **Linter**: `npm run lint` đạt 0 lỗi / 0 cảnh báo.
- [x] **Build**: `npm run build` tạo bundle production thành công trong 2.05s.
- [x] **Chống AI Slop**: Kiểm tra toàn bộ mã nguồn không chứa mã màu hex (`#...`), không có kích thước tùy ý `[...]`.
- [x] **Trợ năng (a11y)**: 100% bàn phím thao tác được, có focus-visible, không có `div` clickable.
- [x] **i18n**: 100% chuỗi hiển thị qua bảng dịch tiếng Việt (`locales/vi.json`) và tiếng Anh (`locales/en.json`).
- [x] **Tích hợp Backend thật**: Đã kiểm tra trực tiếp với Backend NestJS, PostgreSQL, Redis và WebSocket Gateway `/realtime`.

---

## 4. Các Commit trên nhánh `feat/f1-collections`

1. `c3705a8 feat(f1): setup collections/documents schemas, api clients, and domain components`
2. `e1f82ca feat(f1): implement collections UI with create, list, and delete dialogs`
3. `1832851 feat(f1): implement documents UI, multi-file upload, and realtime socket progress`
4. `66b1a6e fix(auth): sync token state in AuthProvider and await user profile fetch on login`
5. `docs(f1): document completion of phase f1 collections and documents`
