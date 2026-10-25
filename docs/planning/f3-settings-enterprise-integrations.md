# Báo cáo Hoàn thành Giai đoạn F3: Cài đặt & Tích hợp Doanh nghiệp

> **Dự án**: DocMind — SaaS RAG đa tenant cho tài liệu doanh nghiệp  
> **Nhánh Git**: `feat/f3-settings`  
> **Thời gian hoàn thành**: 25/10/2026  
> **Trạng thái**: ✅ **HOÀN THÀNH (100% DONE & MERGED TO MAIN)**

---

## 1. Mục tiêu Giai đoạn F3

Giai đoạn F3 hoàn thiện hệ thống quản trị, bảo mật và tích hợp bên ngoài cho không gian làm việc DocMind:
1. **Thành viên & Lời mời (Members & Roles)**:
   - Quản lý thông tin tổ chức và hiển thị vai trò tài khoản hiện tại (OWNER, ADMIN, MEMBER).
   - Mời thành viên mới qua email với vai trò ADMIN/MEMBER.
   - Hỗ trợ cả 2 định dạng liên kết chấp nhận lời mời: `/accept-invite?token=...` (đồng bộ với email backend) và `/invitations/:token`.
   - Trang công khai `/accept-invite` và `/invitations/$token` hỗ trợ thiết lập mật khẩu mới hoặc tham gia ngay nếu đã có tài khoản.
2. **Khóa API Nhà phát triển (Developer API Keys)**:
   - Danh sách khóa API với tiền tố `keyPrefix`, phạm vi truy cập (Toàn bộ tổ chức hoặc giới hạn trong 1 bộ sưu tập), ngày tạo và trạng thái.
   - Hiển thị khóa thô duy nhất 1 lần khi tạo (`ApiKeyCreatedResponse.key`), cảnh báo bảo mật và nút sao chép nhanh.
   - Thu hồi khóa tức thì với hộp thoại xác nhận.
3. **Tích hợp Slack Bot (Slack Integration)**:
   - Kiểm tra trạng thái kết nối Slack Workspace.
   - Tạo liên kết cài đặt ứng dụng qua OAuth (`GET /slack/install`) và ngắt kết nối an toàn.
   - Quản lý ánh xạ kênh Slack với bộ sưu tập (`GET/PUT/DELETE /slack/channels`).
4. **Mức độ sử dụng & Chi phí tài nguyên (Usage Analytics & Meter)**:
   - Bộ lọc thời gian: 7 ngày / 30 ngày gần nhất.
   - Thống kê 4 chỉ số chính: Tổng Token, Token LLM Generation, Token Vector Embedding, Chi phí USD ước tính.
   - Biểu đồ cột biểu diễn biến động lưu lượng theo ngày và bảng chi tiết từng ngày.
5. **Điều hướng toàn diện**:
   - Route thống nhất `/settings` với điều hướng tab qua URL Search Params (`?tab=members|apiKeys|slack|usage`).
   - Tích hợp liên kết Cài đặt vào thanh điều hướng Header trên toàn ứng dụng.

---

## 2. Các công việc đã thực hiện

### 2.1. Quản lý Thành viên & Lời mời
- **Schemas & API Client**:
  - `invitation-schemas.ts`: `createInvitationSchema` (email, role), `acceptInvitationSchema` (password validation).
  - `invitations-api.ts`: Gọi `POST /tenants/:tenantId/invitations`, `DELETE .../invitations/:id`, `GET /invitations/:token`, `POST /invitations/:token/accept`.
  - `use-invitations.ts`: React Query mutations và queries.
- **Components**:
  - `InviteMemberDialog`: Hộp thoại mời thành viên với thẻ chọn vai trò trực quan, tạo link mời và nút sao chép.
  - `MembersSettingsTab`: Hiển thị Workspace Card, Account Card, phân quyền 3 cấp vai trò và nút mời.
- **Routes**:
  - `/invitations/$token`: Trang công khai chấp nhận lời mời, hiển thị tên tổ chức, vai trò chỉ định, form mật khẩu tài khoản mới.
  - `/accept-invite`: Bắt query param `?token=...` từ email backend và tự động redirect sang `/invitations/$token`.

### 2.2. Khóa API Nhà phát triển
- **Schemas & API Client**:
  - `api-key-schemas.ts`: `createApiKeySchema` (name, collectionId), `ApiKeyItem`, `ApiKeyCreatedResponse`.
  - `api-keys-api.ts`: `list()`, `create()`, `revoke()`.
  - `use-api-keys.ts`: Hook truy vấn danh sách và các mutation tạo/hủy khóa.
- **Components**:
  - `CreateApiKeyDialog`: Nhập tên khóa, chọn phạm vi (Toàn bộ tổ chức hoặc bộ sưu tập cụ thể), hiển thị khóa thô duy nhất 1 lần.
  - `ApiKeysSettingsTab`: Bảng khóa API đầy đủ trạng thái Active/Revoked, nút thu hồi kèm modal xác nhận.

### 2.3. Tích hợp Slack Bot
- **Schemas & API Client**:
  - `slack-schemas.ts`: `mapChannelSchema` (channelId dạng `C[A-Z0-9]+`, collectionId).
  - `slack-api.ts`: `getIntegration()`, `getInstallUrl()`, `disconnect()`, `listChannels()`, `upsertChannel()`, `removeChannel()`.
  - `use-slack.ts`: Quản lý query trạng thái kết nối và danh sách kênh ánh xạ.
- **Components**:
  - `AddSlackChannelDialog`: Thêm kênh Slack và liên kết bộ sưu tập tương ứng.
  - `SlackSettingsTab`: Thẻ trạng thái kết nối, ngắt kết nối, bảng quản lý ánh xạ kênh Slack.

### 2.4. Mức độ sử dụng & Chi phí tài nguyên
- **Schemas & API Client**:
  - `usage-schemas.ts`: `UsageSummaryResponse`, `UsageDailyPoint`, `UsageTypeTotals`.
  - `usage-api.ts`: `getSummary(query: { from, to })`.
  - `use-usage.ts`: Hook truy vấn dữ liệu tiêu thụ.
- **Components**:
  - `UsageSettingsTab`: Chuyển đổi khoảng thời gian 7/30 ngày, 4 thẻ thống kê và biểu đồ cột trực quan biến động token.

---

## 3. Kiểm thử & Chất lượng mã nguồn
- `npm run typecheck`: **0 lỗi**
- `npm run lint`: **0 lỗi, 0 cảnh báo**
- `npm run build`: **Thành công**
- Đã merge vào `main` tại commit `14b04f7` và cập nhật README roadmap tại `ba4a94b`.
