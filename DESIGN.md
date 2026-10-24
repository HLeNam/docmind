# DESIGN.md — DocMind Design System

Nguồn sự thật duy nhất cho giao diện. AI và người đều phải đọc file này trước khi viết UI.
Mọi giá trị thị giác đi qua **token**. Không có ngoại lệ ngoài mục "Cổng thoát hiểm".

## 1. Nguyên tắc sản phẩm

DocMind là công cụ làm việc với tài liệu, dùng hằng ngày, đọc nhiều chữ. Giao diện phải:

1. **Yên tĩnh và dễ đọc**: chữ là nhân vật chính, UI lùi lại phía sau.
2. **Đáng tin**: mọi câu trả lời của AI đều truy được về nguồn. Trích dẫn là phần "chữ ký" của sản phẩm.
3. **Rõ trạng thái**: người dùng luôn biết tài liệu đang ở đâu (đang xử lý, sẵn sàng, lỗi) và vì sao.
4. **Dày thông tin nhưng không chật**: mật độ vừa phải, nhịp thở đều.
5. **Nhất quán hơn là gây ấn tượng**: một cách làm cho một việc.

Giọng điệu: chuyên nghiệp, ấm, ngắn gọn. Không hào nhoáng, không "magic".

## 2. Token (nguồn: `frontend/src/styles/tokens.css`)

Dùng OKLCH. Light là mặc định, dark định nghĩa lại cùng tên token. Component chỉ dùng token ngữ nghĩa.

### 2.1 Màu ngữ nghĩa

| Token                                  | Light                                                         | Dark                   | Dùng cho                                                   |
| -------------------------------------- | ------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------- |
| `--bg`                                 | oklch(0.985 0.003 90)                                         | oklch(0.17 0.01 260)   | nền trang                                                  |
| `--surface`                            | oklch(1 0 0)                                                  | oklch(0.21 0.012 260)  | card, panel                                                |
| `--surface-muted`                      | oklch(0.965 0.004 90)                                         | oklch(0.245 0.012 260) | vùng phụ, hàng hover                                       |
| `--border`                             | oklch(0.91 0.005 90)                                          | oklch(0.31 0.012 260)  | đường kẻ, viền card (chỉ trang trí)                        |
| `--border-strong`                      | oklch(0.62 0.01 260)                                          | oklch(0.55 0.012 260)  | viền input, checkbox, nút outline (≥ 3:1 theo WCAG 1.4.11) |
| `--fg`                                 | oklch(0.22 0.01 260)                                          | oklch(0.96 0.005 90)   | chữ chính                                                  |
| `--fg-muted`                           | oklch(0.48 0.012 260)                                         | oklch(0.72 0.01 260)   | chữ phụ (đạt AA trên `--bg`)                               |
| `--accent`                             | oklch(0.52 0.13 255)                                          | oklch(0.72 0.12 255)   | hành động chính, link, focus, trích dẫn                    |
| `--accent-fg`                          | oklch(0.99 0 0)                                               | oklch(0.17 0.01 260)   | chữ trên nền accent                                        |
| `--accent-soft`                        | oklch(0.95 0.025 255)                                         | oklch(0.27 0.04 255)   | nền nhấn nhẹ, chip trích dẫn                               |
| `--success` / `--warning` / `--danger` | xanh lá / hổ phách / đỏ, mỗi màu có biến thể `-soft` và `-fg` |                        | trạng thái                                                 |
| `--ring`                               | = `--accent`                                                  |                        | vòng focus                                                 |

- Màu nhấn chỉ **một** (xanh dương trầm, có thể đổi sau khi chọn hướng thiết kế; đổi ở token là đủ).
- Trạng thái không bao giờ chỉ dựa vào màu: luôn kèm icon hoặc nhãn.
- Kiểm tra tương phản bằng công cụ trước khi đổi bất kỳ token màu nào: chữ thường ≥ 4.5:1, chữ lớn và icon ≥ 3:1.

### 2.2 Typography

- Sans: **Inter** (chữ UI và nội dung); hỗ trợ tiếng Việt đầy đủ. Mono: **JetBrains Mono** (code, ID, đường dẫn).
- Tự host font (`@fontsource-variable`), `font-display: swap`. Không tải từ CDN.
- Thang chữ (rem, line-height): `text-xs` .75/1.4 · `text-sm` .875/1.35 · `text-base` 1/1.55 · `text-lg` 1.125/1.5 · `text-xl` 1.25/1.4 · `text-2xl` 1.5/1.3 · `text-3xl` 1.875/1.2.
- Độ đậm chỉ 400, 500, 600. Nội dung câu trả lời dài dùng `text-base`, độ rộng dòng tối đa `68ch`.
- Số trong bảng và thống kê dùng `tabular-nums`.
- Tiêu đề và nhãn viết hoa kiểu câu (sentence case). Không IN HOA TOÀN BỘ trừ nhãn rất ngắn.

### 2.3 Khoảng cách, bo góc, đổ bóng, lớp

- Spacing theo lưới 4px: dùng thang `1 2 3 4 5 6 8 10 12 16` của Tailwind. Không giá trị lẻ.
- Radius: `--radius-sm` 6px (input, chip) · `--radius-md` 8px (button, card nhỏ) · `--radius-lg` 12px (card, dialog) · `--radius-full` (avatar, badge).
- Đổ bóng chỉ 3 mức: `--shadow-sm` (card nổi nhẹ), `--shadow-md` (popover, dropdown), `--shadow-lg` (dialog). Phần lớn vùng dùng **viền thay vì bóng**.
- Z-index theo token: `base 0 · sticky 10 · overlay 40 · modal 50 · toast 60`.

### 2.4 Chuyển động

- Thời lượng: `--dur-fast` 120ms · `--dur-base` 200ms · `--dur-slow` 320ms. Easing: `cubic-bezier(0.2, 0, 0, 1)`.
- Chỉ animate `opacity` và `transform`. Không animate kích thước, màu nền lớn, hay vị trí layout.
- Chuyển động phải **mang nghĩa** (vào/ra của panel, trạng thái tải, token stream). Không trang trí.
- Tôn trọng `prefers-reduced-motion`: tắt mọi chuyển động không thiết yếu.

### 2.5 Breakpoint

`sm 640 · md 768 · lg 1024 · xl 1280`. Thiết kế **mobile-first**. Bố cục chat 3 cột chỉ từ `xl`.

## 3. Bố cục

- **App shell**: sidebar trái (điều hướng, chọn tenant, người dùng) · vùng nội dung · panel phụ bên phải khi cần.
- Sidebar thu gọn thành icon từ `lg`, thành drawer dưới `md`.
- Nội dung trang rộng tối đa `1200px` căn giữa; trang đọc dài tối đa `68ch`.
- **Trang chat** (đặc trưng): `[Lịch sử hội thoại] | [Cuộc hội thoại] | [Panel nguồn]`.
    - Dưới `xl`, panel nguồn mở như drawer phải khi bấm một trích dẫn; lịch sử là drawer trái.
- Header trang: tiêu đề + mô tả ngắn + hành động chính (một nút `primary` duy nhất mỗi vùng nhìn thấy).

## 4. Component

### 4.1 Nền tảng (shadcn/ui, đã tuỳ biến theo token)

Button, Input, Textarea, Select, Checkbox, Switch, Dialog, Sheet, Popover, DropdownMenu, Tabs, Tooltip, Toast (Sonner), Table, Badge, Skeleton, Avatar, Command, ScrollArea.

- Biến thể Button: `primary` · `secondary` · `ghost` · `destructive`. Kích thước: `sm` 32 · `md` 36 · `lg` 40px cao. Vùng chạm tối thiểu 44×44 trên màn hình cảm ứng (padding ẩn).
- Chỉ sửa component nền ở `components/ui/`. Domain component **ghép** chúng, không sao chép style.

### 4.2 Domain component (`components/domain/`)

| Component             | Mô tả                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CitationChip`        | Chip nhỏ `[1]` trong câu trả lời, nền `--accent-soft`, chữ `--accent`. Hover: xem trước tên tài liệu + trang. Bấm: mở panel nguồn, cuộn tới đoạn trích. Có `aria-label="Nguồn 1: <tên tài liệu>, trang <n>"`. |
| `SourcePanel`         | Danh sách nguồn của câu trả lời đang chọn. Mỗi nguồn: tên tài liệu, vị trí (trang/slide/dòng), đoạn trích có tô đậm phần khớp, độ liên quan (nhãn chữ, không chỉ thanh).                                      |
| `AnswerStream`        | Render markdown khi stream. Con trỏ nhấp nháy tinh tế ở cuối; trạng thái "Đang tìm trong tài liệu" trước token đầu. Nút Dừng. Khi lỗi giữa chừng: giữ phần đã nhận + nút Thử lại.                             |
| `DocumentStatusBadge` | `UPLOADED/PROCESSING/READY/FAILED`... (khớp enum backend). Icon + nhãn + màu. `FAILED` có tooltip lý do.                                                                                                      |
| `UploadProgress`      | Hàng tiến độ theo từng file, cập nhật realtime qua socket. Có huỷ/thử lại.                                                                                                                                    |
| `ConversationList`    | Nhóm theo ngày, tìm kiếm, xoá có xác nhận (có hoàn tác bằng toast nếu khả thi).                                                                                                                               |
| `EmptyState`          | Minh hoạ tối giản (icon) + một câu giải thích + một hành động.                                                                                                                                                |
| `PermissionNotice`    | Giải thích **vì sao** không có quyền và ai có thể cấp.                                                                                                                                                        |
| `UsageMeter`          | Số liệu dùng + nhãn chữ, không chỉ thanh màu.                                                                                                                                                                 |

## 5. Trạng thái bắt buộc

Mọi màn hình danh sách, dữ liệu và form phải thiết kế đủ:
**loading** (skeleton đúng hình dạng nội dung, không spinner toàn trang) · **empty** (có hướng dẫn hành động) · **error** (nói chuyện gì xảy ra + làm gì tiếp, có Thử lại) · **forbidden** (`PermissionNotice`) · **offline/rate-limited** (hiển thị thời gian chờ từ `Retry-After`) · **partial** (stream đứt) · **success** (toast ngắn, không modal).
Lỗi từ backend dùng `error.code` để chọn thông điệp tiếng Việt trong bảng i18n, không hiển thị `message` thô của server.

## 6. Nội dung và giọng điệu (i18n)

- Mọi chuỗi qua i18n (mặc định `vi`, sẵn sàng `en`). Không hardcode chuỗi trong JSX.
- Nút bắt đầu bằng động từ cụ thể: "Tải tài liệu lên", "Tạo bộ sưu tập", "Xoá hội thoại". Không "Submit", "OK", "Click here".
- Thông báo lỗi: nguyên nhân ngắn + cách xử lý. Ví dụ: "Không đọc được file này. Hãy thử xuất lại thành PDF rồi tải lên."
- Không dùng: "Chào mừng đến với thế giới của…", emoji trang trí, dấu chấm than liên tục, "✨", "AI-powered", "seamless", "unlock", "supercharge".
- Ngày giờ và số theo locale `vi-VN`. Thời gian tương đối ("2 phút trước") có `title` hiển thị thời gian tuyệt đối.
- Hành động phá huỷ: dialog nêu rõ đối tượng bị xoá và hậu quả; nút xác nhận dùng đúng động từ ("Xoá hội thoại").

## 7. Trợ năng (WCAG 2.2 AA)

- Mọi thao tác dùng được bằng bàn phím; thứ tự Tab hợp lý; `:focus-visible` luôn thấy (vòng 2px `--ring`, offset 2px).
- Dùng phần tử ngữ nghĩa (`button`, `a`, `nav`, `main`, `ul`...). Không `div` có `onClick`.
- Icon-only button có `aria-label`. Hình trang trí `aria-hidden`.
- Nội dung stream: vùng `aria-live="polite"` cập nhật theo câu, không đọc từng token.
- Dialog và drawer bẫy focus, `Esc` đóng, trả focus về phần tử mở.
- Form: nhãn gắn đúng input, lỗi gắn bằng `aria-describedby`, không chỉ báo bằng màu.
- Kiểm tra bằng axe trong test và duyệt tay bằng bàn phím trước khi merge.

## 8. Chế độ tối

Đây là chế độ hạng nhất, không phải bản đảo màu. Theo hệ thống mặc định, người dùng đổi được và được nhớ. Kiểm tra tương phản riêng cho dark. Bề mặt dark tách lớp bằng độ sáng và viền, không bằng bóng.

## 9. Quy tắc cứng cho AI (chống "AI slop")

**Cấm**

- Màu hex/rgb/hsl trực tiếp, giá trị tuỳ ý của Tailwind (`w-[347px]`, `text-[13px]`, `bg-[#...]`), `style={{}}` cho màu hay khoảng cách.
- Gradient tím–xanh, gradient trên chữ, glassmorphism, đổ bóng màu neon, hiệu ứng "glow".
- Lưới 3 thẻ icon + tiêu đề + mô tả giống nhau làm nội dung chính; thẻ trong thẻ trong thẻ.
- Bo góc và bóng lệch tông giữa các vùng; mỗi card một kiểu khác nhau.
- Emoji làm icon; icon ngẫu nhiên không mang nghĩa; minh hoạ stock.
- Lorem ipsum và số liệu bịa trong màn hình thật.
- Hero marketing trong ứng dụng; chữ viết tắt và biệt ngữ nội bộ lộ ra giao diện.
- Animation vào trang cho mọi phần tử; hiệu ứng nảy (spring) ở nơi không cần.
- Tự thêm component, thư viện UI hay font mới khi chưa được duyệt.

**Bắt buộc**

- Dùng token và component có sẵn trước; thiếu thì **đề xuất** thêm token/component rồi mới dùng.
- Một nút `primary` cho mỗi vùng nhìn thấy; phần còn lại là `secondary`/`ghost`.
- Mọi màn hình đủ các trạng thái ở mục 5.
- Mọi chuỗi qua i18n, mọi icon-only button có nhãn.
- Chụp ảnh màn hình ở 3 độ rộng (390 / 768 / 1280) cả light và dark để tự rà trước khi báo xong.

## 10. Cổng thoát hiểm

Nếu thật sự cần giá trị ngoài token (ví dụ kích thước cố định của vùng PDF): thêm token mới vào `tokens.css` kèm lý do trong PR, rồi dùng token đó. Không viết giá trị tuỳ ý tại chỗ.

## 11. Mở rộng

- Thêm theme/tenant branding: chỉ đổi giá trị `--accent*` và logo, không đụng component.
- Thêm ngôn ngữ: thêm file locale, không đổi component.
- Đổi hướng thiết kế: sửa `tokens.css` và `DESIGN.md` cùng một PR.

## 12. Hướng thiết kế (chờ chốt)

Bản này dùng "Yên tĩnh, biên tập" (nền ấm nhẹ, chữ rõ, một màu nhấn xanh trầm). Nếu chọn hướng khác sau khi xem mockup, chỉ cập nhật mục 2.1, 2.2 và 12.
