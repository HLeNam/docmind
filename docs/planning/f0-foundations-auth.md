# Báo cáo Hoàn thành Giai đoạn F0: Nền móng & Xác thực (Foundations & Authentication)

> **Dự án**: DocMind — SaaS RAG đa tenant cho tài liệu doanh nghiệp  
> **Nhánh Git**: `feat/f0-auth`  
> **Thời gian hoàn thành**: 24/10/2026  
> **Trạng thái**: ✅ **HOÀN THÀNH (100% DONE)**

---

## 1. Mục tiêu Giai đoạn F0
Giai đoạn F0 tập trung vào việc thiết lập toàn bộ nền móng kiến trúc kỹ thuật cho Frontend, chuẩn hóa hệ thống Design Tokens, tích hợp các bộ kỹ năng thiết kế chuyên sâu, và xây dựng hệ sinh thái Xác thực (Authentication) tuân thủ 100% hợp đồng bảo mật với Backend NestJS.

---

## 2. Các công việc đã thực hiện

### 2.1. Tái cấu trúc Monorepo & Quản lý thư viện
- **Tái cấu trúc monorepo**: Dùng `git mv` di dời toàn bộ mã nguồn Backend vào thư mục `backend/` (bảo toàn 100% lịch sử git). Thư mục `frontend/` được tổ chức độc lập nhưng chia sẻ cùng một repository.
- **Cấu hình Package Manager**: Đồng bộ sử dụng `npm` cho cả hai thư mục theo đúng quy chuẩn.
- **Tích hợp các Agent Skills**:
  - `shadcn` (`.agents/skills/shadcn/SKILL.md`): Tích hợp Base UI preset `base-vega` và gói `cn` chính chủ.
  - `impeccable` (`.agents/skills/impeccable/SKILL.md`): Áp dụng chuẩn thiết kế biên tập yên tĩnh (Quiet Editorial), loại bỏ hoàn toàn các lỗi "AI Slop".
  - `web-design-guidelines` (`.agents/skills/web-design-guidelines/SKILL.md`): Đảm bảo tiêu chuẩn trợ năng WCAG 2.2 AA.

---

### 2.2. Nền tảng Kỹ thuật Frontend (Frontend Architecture)
- **Công nghệ cốt lõi**: Vite + React 19 + TypeScript (strict mode, không dùng `any`, xử lý kiểu nghiêm ngặt).
- **Định tuyến (Routing)**: `@tanstack/react-router` với tính năng tự động sinh cây route (`src/app/routeTree.gen.ts`) và chia nhỏ bundle tự động (Route-level code splitting).
- **Quản lý dữ liệu máy chủ (Server State)**: `@tanstack/react-query` v5 với `QueryClient` độc lập, cấu trúc key phân tầng `["auth", "me"]`.
- **Hệ thống Token & CSS**:
  - Tailwind CSS v4 kết hợp `tokens.css` chuẩn OKLCH (hỗ trợ Light và Dark mode nguyên bản).
  - Khắc phục triệt để lỗi ghi đè biến bán kính và màu nhấn (`--radius`, `--accent`).
  - Font tự host: `@fontsource-variable/inter` (chữ UI) và `@fontsource-variable/jetbrains-mono` (mã code, số trang, ID).
- **Thanh cuộn toàn cục tinh tế (Global Sleek Scrollbar)**:
  - Tích hợp vào `src/index.css`: thanh cuộn mảnh 6px, bo tròn dạng viên thuốc, track trong suốt.
  - Tự động chuyển đổi màu theo Token: xám ấm ở Light mode, slate tối ở Dark mode.
- **Biểu mẫu & Kiểm thực**: `react-hook-form` kết hợp `zod` (`@hookform/resolvers`), đồng bộ hoàn toàn với schema của backend.
- **Đa ngôn ngữ (i18n)**: `i18next` và `react-i18next`, mặc định tiếng Việt (`locales/vi.json`), sẵn sàng tiếng Anh (`locales/en.json`).

---

### 2.3. Động cơ Xác thực (Auth Engine & Security Contract)
Tuân thủ nghiêm ngặt các quy định tại Mục 4 của `AGENTS.md`:

1. **Quản lý Token trong bộ nhớ**:
   - Access Token (JWT) được lưu giữ thuần túy trong memory (`src/lib/auth-token.ts`), tuyệt đối không lưu ở `localStorage`, `sessionStorage` hay JS Cookie nhằm triệt tiêu nguy cơ tấn công XSS.
   - Đồng bộ trạng thái đăng nhập tức thì giữa các tab trình duyệt thông qua `BroadcastChannel("docmind-auth")`.
2. **Single-Flight Refresh & Web Locks**:
   - Refresh Token nằm an toàn trong cookie HttpOnly (`Path=/api/auth; SameSite=Lax`).
   - Bọc tiến trình làm mới token trong `navigator.locks.request('docmind-refresh')`. Khi nhiều tab cùng gặp lỗi 401, chỉ một request refresh duy nhất được gửi đi, các tab khác chờ và tái sử dụng access token mới.
   - Tự động thử lại request một lần duy nhất (`single retry`) sau khi refresh thành công; đăng xuất và xóa cache nếu refresh thất bại.
3. **Bóc tách Envelope & Xử lý lỗi tập trung**:
   - `src/lib/api-client.ts`: Tự động mở phong bì JSON `{ success: true, data, meta }`.
   - `src/lib/error-util.ts`: Bắt mã lỗi nghiệp vụ từ backend (`AUTH_EMAIL_TAKEN`, `AUTH_INVALID_CREDENTIALS`, `RATE_LIMITED`...) và chuyển thành thông điệp tiếng Việt thân thiện qua i18n.
   - Đọc header `Retry-After` khi gặp lỗi 429 Rate Limit.
4. **Hỗ trợ Tài khoản đa Workspace (Multi-tenancy Discovery)**:
   - Xử lý phản hồi `requiresTenantSelection: true` khi tài khoản thuộc nhiều tổ chức khác nhau.
   - Hiển thị danh sách chọn Workspace (`TenantSelectionList`) kèm vai trò (`OWNER`, `ADMIN`, `MEMBER`).
5. **Tích hợp Google Identity Services (GIS)**:
   - Nạp SDK chính thức của Google (`https://accounts.google.com/gsi/client`).
   - Hỗ trợ lấy OpenID Connect `idToken` từ Google Popup/One Tap và gửi trực tiếp lên `POST /auth/google` của backend.

---

### 2.4. Thiết kế Giao diện & Trải nghiệm (UI/UX High-Craft)
- **Bố cục Split-Screen Biên tập**:
  - **Trên Desktop (≥ 1024px)**: 
    - Cột trái: Form thao tác tập trung, tỷ lệ chuẩn `max-w-sm`.
    - Cột phải: Khung trưng bày giá trị cốt lõi của DocMind với triết lý: *"Mọi câu trả lời đều truy nguyên về tài liệu gốc"*, mockup câu trả lời AI thật, chip trích dẫn `[1]` và bảng tra cứu nguồn trích dẫn (`Bao_cao_Tai_chinh_Q3.pdf`, Trang 18, Độ khớp 98%).
  - **Trên Mobile (< 1024px)**: Cột trưng bày tự động ẩn, form căn giữa thanh thoát, tối ưu trải nghiệm chạm.
- **Tối ưu hóa Khung nhìn (Single-Viewport)**:
  - Khóa chiều cao `lg:h-screen lg:overflow-hidden` và sử dụng `my-auto py-4`.
  - Triệt tiêu hoàn toàn thanh cuộn dọc không mong muốn trên màn hình laptop tiêu chuẩn (768px - 900px).
- **Phản hồi độ mạnh mật khẩu thời gian thực (`PasswordStrengthIndicator`)**:
  - 3 tiêu chí: "Tối thiểu 8 ký tự", "Có chữ hoa", "Có chữ số" tự động tick xanh khi người dùng gõ phím.
  - Tối ưu hóa bằng `useWatch` tương thích hoàn toàn với React Compiler mà không gây re-render dư thừa.
- **Bộ nhận diện Thương hiệu độc bản**:
  - Thiết kế logo vector SVG kiến trúc: Hai trang tài liệu xếp tầng kết hợp ngôi sao trích dẫn 4 cánh ở trung tâm.
  - Component React [`DocMindLogo`](file:///home/hlnam/self-pratices/projects/docmind/frontend/src/components/ui/docmind-logo.tsx) tự động đảo màu theo theme.
  - `favicon.svg` tự động sáng lên khi thanh tab trình duyệt ở Dark mode.
  - Quy hoạch tài nguyên thương hiệu vào [`assets/branding/`](file:///home/hlnam/self-pratices/projects/docmind/assets/branding/) và [`frontend/public/branding/`](file:///home/hlnam/self-pratices/projects/docmind/frontend/public/branding/) (bao gồm bản PNG 120x120 chuẩn Google OAuth Consent Screen).

---

## 3. Cấu trúc Thư mục sau Giai đoạn F0

```
docmind/
├── assets/
│   └── branding/                      # Tài nguyên Master (Logo SVG, Icon 120x120, 512x512)
├── backend/                           # NestJS Backend API
└── frontend/
    ├── public/
    │   ├── branding/                  # Public web brand assets
    │   └── favicon.svg                # Favicon thích ứng Dark/Light
    ├── src/
    │   ├── app/
    │   │   ├── routes/                # TanStack Router Routes
    │   │   │   ├── __root.tsx         # Root layout
    │   │   │   ├── index.tsx          # Dashboard (Protected route)
    │   │   │   ├── login.tsx          # Trang Đăng nhập
    │   │   │   └── register.tsx       # Trang Đăng ký
    │   │   ├── providers/             # QueryProvider
    │   │   └── routeTree.gen.ts       # Generated routes
    │   ├── components/
    │   │   └── ui/                    # Base UI / shadcn (Button, Input, Card, Label, Alert, DocMindLogo)
    │   ├── features/
    │   │   └── auth/                  # Feature Xác thực
    │   │       ├── api/               # auth-api.ts
    │   │       ├── components/        # Form, SplitLayout, Showcase, StrengthIndicator, TenantList
    │   │       ├── context/           # auth-context.ts, auth-provider.tsx
    │   │       ├── hooks/             # use-auth.ts
    │   │       ├── schemas/           # auth-schemas.ts (Zod)
    │   │       └── index.ts
    │   ├── lib/                       # api-client.ts, auth-token.ts, error-util.ts, i18n.ts
    │   ├── locales/                   # vi.json, en.json
    │   ├── styles/                    # tokens.css
    │   └── index.css                  # Tailwind v4, custom scrollbar, base styles
    └── vite.config.ts                 # TanStackRouterVite, proxy /api -> :3000
```

---

## 4. Kết quả Kiểm thử (Definition of Done Verification)

| Bộ kiểm tra | Lệnh thực thi | Kết quả |
| :--- | :--- | :--- |
| **TypeScript Typecheck** | `npm run typecheck` | ✅ **0 lỗi** (`tsc -b` pass sạch) |
| **ESLint** | `npm run lint` | ✅ **0 lỗi, 0 cảnh báo** |
| **Production Build** | `npm run build` | ✅ **Thành công** trong 1.27s (Route splitting hoàn chỉnh) |
| **Tuân thủ DESIGN.md** | Kiểm tra tự động & thủ công | ✅ 100% token ngữ nghĩa OKLCH, không có mã hex hay class Tailwind `[...]` tùy ý |
| **Trợ năng (A11y)** | Kiểm tra phím & DOM | ✅ Tab index hợp lý, focus ring hiển thị, nhãn `htmlFor`, `aria-invalid` đầy đủ |
| **Docker Stack** | `docker compose up -d` | ✅ PostgreSQL 16 pgvector, Redis 7, RustFS S3 hoạt động ổn định |
| **Kiểm thử E2E API** | Proxy từ Vite `:5173` -> NestJS `:3000` | ✅ Đăng ký -> Đăng nhập -> Cấp cookie `Path=/api/auth` -> Refresh Single-flight -> Get Me -> Đăng xuất thành công |

---

## 5. Danh sách Commit trên nhánh `feat/f0-auth`

1. `8ab333e` - `feat(auth): implement in-memory auth engine with web locks refresh`
2. `9ebf04d` - `feat(auth): add login, register forms, tenant picker, and protected routes`
3. `80c0d90` - `feat(auth): upgrade auth UI to split-screen layout with citation showcase and live password feedback`
4. `5944660` - `fix(auth): eliminate vertical scrolling on register and login screens with compact viewport rhythm`
5. `ce3ed45` - `style: apply global token-based sleek scrollbar across app`
6. `0ea6428` - `feat(auth): integrate Google Identity Services SDK for Google OAuth login`
7. `6125b9c` - `feat(branding): integrate custom DocMind vector logo and adaptive favicon`
8. `4b677a2` - `fix(branding): mathematically center DocMind logo in 1:1 square canvas`
9. `995384b` - `chore(branding): organize brand assets into assets/branding and frontend/public/branding`

---

## 6. Kế hoạch Giai đoạn tiếp theo (Phase F1: Collections & Documents)
- **Giao diện Bộ sưu tập**: Danh sách bộ sưu tập, tạo mới, chỉnh sửa, xóa, phân quyền truy cập.
- **Quản lý Tài liệu**:
  - Kéo thả tải lên nhiều file (PDF, DOCX, XLSX, hình ảnh OCR).
  - Thanh tiến độ upload thời gian thực kết nối Socket.IO namespace `/realtime`.
  - Huy hiệu trạng thái xử lý tài liệu (`DocumentStatusBadge`): `UPLOADED` -> `PROCESSING` -> `READY` / `FAILED`.
