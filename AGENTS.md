# AGENTS.md — Hướng dẫn cho AI làm frontend DocMind

Đọc hết file này và `DESIGN.md` **trước khi viết bất kỳ dòng UI nào**. Khi hai nguồn mâu thuẫn: `DESIGN.md` thắng về giao diện, file này thắng về quy trình và kỹ thuật.

## 1. Sản phẩm

DocMind: SaaS RAG đa tenant. Người dùng tải tài liệu (PDF, DOCX, PPTX, bảng tính, ảnh có OCR) vào **bộ sưu tập**, hỏi đáp bằng AI, câu trả lời có **trích dẫn nguồn**. Có thành viên và vai trò, API key, tích hợp Slack, thống kê dùng.
Backend: NestJS nằm ở thư mục `backend/`. Frontend nằm ở thư mục `frontend/` (chung repo).

## 2. Stack (đã chốt, không tự đổi)

- Vite + React + TypeScript (strict), SPA.
- Routing/data: TanStack Router + TanStack Query. Zustand **chỉ** cho UI state cục bộ (sidebar, panel); không lưu dữ liệu server trong Zustand.
- Style: Tailwind v4 + shadcn/ui (Base UI / base-vega, gói cn chính chủ). Token ở `src/styles/tokens.css`.
- Form: react-hook-form + Zod (`@hookform/resolvers`).
- API client: **sinh tự động** từ OpenAPI của backend (không viết tay kiểu response).
- Chat: `fetch` + đọc stream SSE (không dùng `EventSource` vì cần header Authorization). Tiến độ upload: `socket.io-client`.
- Markdown: `react-markdown` + `remark-gfm`, component tuỳ biến cho trích dẫn. **Không** dùng `dangerouslySetInnerHTML`.
- i18n: `i18next` (mặc định `vi`). Test: Vitest + Testing Library; E2E: Playwright; a11y: `vitest-axe`/`@axe-core/playwright`.
- Trình quản lý gói: npm. Thêm dependency mới cần được duyệt: nêu lý do và phương án thay thế.

## 3. Cấu trúc thư mục

```
src/
  app/            router, providers, shell
  features/       auth/ collections/ documents/ chat/ settings/ usage/
    <feature>/    components/ hooks/ api/ schemas/ index.ts
  components/
    ui/           shadcn (đã tuỳ biến theo token)
    domain/       CitationChip, SourcePanel, DocumentStatusBadge...
  lib/            api client, auth, sse, socket, i18n, utils
  styles/         tokens.css, globals.css
  locales/        vi.json, en.json
```

Feature không import trực tiếp nội bộ feature khác, chỉ qua `index.ts`. Component `ui/` không biết gì về domain.

## 4. Hợp đồng API (backend)

- Mọi response thành công: `{ success: true, data, meta }`. Lỗi: `{ success: false, error: { code, message, details? } }`. Client bóc `data`; xử lý lỗi theo `error.code`.
- **Xác thực**
    - Access token (JWT) giữ **trong bộ nhớ** (module-level + Query), **không** `localStorage`/`sessionStorage`/cookie JS.
    - Refresh token ở cookie HttpOnly `refresh_token`; JS không đọc được và response không chứa nó.
    - Khởi động app: gọi `POST /auth/refresh` với body `{}` và `credentials: 'include'`. 401 → trang đăng nhập.
    - Gặp 401 ở API khác: refresh **một lần dùng chung** (single-flight), rồi thử lại đúng một lần. Vẫn 401 → đăng xuất.
    - **Nhiều tab**: refresh token xoay vòng và có phát hiện dùng lại; bọc refresh trong `navigator.locks.request('docmind-refresh', ...)`. Sau khi lấy được lock, kiểm tra lại xem tab khác đã làm mới access token chưa.
    - Đăng xuất: `POST /auth/logout`, xoá cache Query, ngắt socket.
- Dev: Vite proxy `/api` → `http://localhost:3000` (bỏ tiền tố). Backend đặt `AUTH_COOKIE_PATH=/api/auth`.
- **Rate limit**: đọc `X-RateLimit-*` và `Retry-After`. Gặp 429 hiển thị đếm ngược, không thử lại tự động dồn dập.
- **Phân quyền**: ẩn/vô hiệu hoá hành động theo vai trò (OWNER/ADMIN/MEMBER...) để UX tốt, nhưng **backend mới là nơi quyết định**; luôn xử lý 403.
- **Chat SSE**: sự kiện có `error` giữa chừng (ví dụ không lưu được câu trả lời). Phải xử lý: giữ phần đã nhận, báo lỗi, cho thử lại. Có nút Dừng (AbortController).
- **Trích dẫn**: dữ liệu nguồn đi kèm câu trả lời; dùng đúng schema OpenAPI, không đoán trường.
- Xoá hội thoại: `DELETE /chat/conversations/:id`. Nếu đang stream vào hội thoại bị xoá thì nhận event lỗi, xử lý nhẹ nhàng.
- Schema và đường dẫn chính xác lấy từ OpenAPI (`/docs` hoặc file JSON). **Không bịa endpoint hay trường.** Thiếu gì thì ghi vào mục "Câu hỏi cho backend" trong PR.

## 5. Quy tắc code

- TypeScript strict, không `any` (dùng `unknown` + thu hẹp), không `@ts-ignore` không kèm lý do.
- Dữ liệu từ ngoài vào (API, URL params, localStorage) được parse bằng Zod hoặc kiểu sinh sẵn.
- Server state qua TanStack Query: key có cấu trúc `[feature, entity, params]`; mutation phải invalidate đúng key; cập nhật lạc quan chỉ khi có rollback.
- Không `useEffect` để lấy dữ liệu hoặc đồng bộ state có thể suy ra. Hạn chế `useMemo/useCallback` khi không đo được lợi ích.
- Component nhỏ, một trách nhiệm; props rõ ràng; composition thay vì cờ boolean chồng chất.
- Không `console.log` trong code merge. Không để lộ token, email, nội dung tài liệu trong log hay URL.
- Truy cập: thực hiện theo mục 7 của `DESIGN.md`. Không `div` bấm được.
- Hiệu năng: route-level code splitting; danh sách dài dùng ảo hoá; không tải thư viện nặng (PDF viewer, markdown) ở bundle đầu.
- Bảo mật: không HTML thô từ nội dung tài liệu/AI; link ngoài `rel="noopener noreferrer"`; không nhúng secret vào bundle (mọi biến `VITE_*` là công khai).

## 6. Quy tắc giao diện (tóm tắt, chi tiết ở DESIGN.md)

- Chỉ dùng token và component có sẵn. Không hex, không giá trị tuỳ ý, không `style` cho màu/khoảng cách.
- Mỗi màn hình đủ: loading (skeleton), empty, error, forbidden, rate-limited.
- Một nút `primary` mỗi vùng nhìn thấy. Mọi chuỗi qua i18n. Icon-only button có `aria-label`.
- Cấm danh sách "AI slop" ở mục 9 của `DESIGN.md`.
- Thiếu token/component: **đề xuất** trước, rồi mới thêm.

## 7. Cách làm việc

- **Từng bước nhỏ, dừng để duyệt.** Mỗi lần giao một phần nhỏ, dùng được và kiểm tra được. Không làm cả giai đoạn một lượt.
- Không bắt đầu giai đoạn mới khi chưa có xác nhận của chủ dự án.
- Trước khi code: nói ngắn bạn sẽ làm gì và file nào bị đụng. Sau khi code: nói đã kiểm tra gì và cách tự kiểm tra lại.
- Không sửa backend từ frontend. Phát hiện lỗi/thiếu ở API: ghi lại chính xác (request, response, kỳ vọng) để báo.
- Không tự thêm tính năng ngoài phạm vi. Gợi ý thì ghi riêng.
- Nhánh/PR: một mục đích mỗi PR; mô tả có ảnh chụp (light + dark, 390/768/1280) và danh sách trạng thái đã kiểm.

## 8. Lộ trình (chỉ làm giai đoạn được giao)

- **F0** Nền móng: scaffold, token, shadcn, i18n, API client sinh từ OpenAPI, xác thực (cookie + refresh single-flight + Web Locks), app shell, route bảo vệ, trang đăng nhập/đăng ký.
- **F1** Bộ sưu tập và tài liệu: danh sách, tạo/sửa/xoá, tải lên nhiều file, tiến độ realtime, trạng thái xử lý.
- **F2** Chat: hội thoại, stream, trích dẫn, panel nguồn, lịch sử, xoá hội thoại.
- **F3** Cài đặt: thành viên và lời mời, API key, Slack, thống kê dùng.
- **F4** Hoàn thiện: a11y, hiệu năng, E2E, dark mode rà soát, tài liệu.

## 9. Định nghĩa "xong" (cho mỗi bước)

- [ ] `npm run typecheck`, `npm run lint`, `npm test` sạch.
- [ ] Không vi phạm mục 9 của `DESIGN.md` (tìm hex, `[...]` tuỳ ý, chuỗi cứng).
- [ ] Đủ trạng thái loading/empty/error/forbidden.
- [ ] axe không có lỗi nghiêm trọng; thao tác được hoàn toàn bằng bàn phím.
- [ ] Ảnh chụp ở 3 độ rộng, cả light và dark, đã tự rà.
- [ ] Chuỗi mới nằm trong `locales/vi.json`.
- [ ] Đã chạy thật với backend và ghi lại kết quả; phần chưa chạy được nêu rõ.

## 10. Skill và tham chiếu (đọc trước khi cài)

- `anthropics/skills` → `frontend-design` (token trước code, tránh 3 kiểu mặc định, chuyển động tiết chế).
- `vercel-labs/agent-skills` → `web-design-guidelines`, `composition-patterns`; `react-best-practices` dùng chọn lọc (nhiều mục hướng Next.js, bỏ qua mục không áp dụng cho SPA).
- Skill shadcn (`npx skills add shadcn-ui/ui@shadcn`).
- Luôn đọc nội dung skill trước khi cài; nếu mâu thuẫn với `DESIGN.md`/`AGENTS.md` thì hai file này thắng.
