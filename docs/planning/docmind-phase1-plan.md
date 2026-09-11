# DocMind — Giai đoạn 1: Scaffold & Auth (chi tiết)

Mục tiêu cuối giai đoạn: đăng ký được, đăng nhập được (password + Google), mời user vào tenant được, refresh token rotation hoạt động đúng, RLS thật sự chặn được cross-tenant access — có thể verify bằng Postman/test, chưa cần UI.

---

## 1. Cấu trúc thư mục NestJS

```
docmind-api/
├── docker-compose.yml
├── .env.example
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts          # wrapper set app.current_tenant
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── current-membership.decorator.ts
│   │   │   └── roles.decorator.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   └── interceptors/
│   │       └── tenant-context.interceptor.ts   # set app.current_tenant mỗi request
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   ├── jwt.strategy.ts
│   │   │   └── google.strategy.ts
│   │   ├── dto/
│   │   │   ├── register.dto.ts
│   │   │   ├── login.dto.ts
│   │   │   └── refresh-token.dto.ts
│   │   └── refresh-token.service.ts    # rotation + reuse detection logic riêng
│   ├── tenants/
│   │   ├── tenants.module.ts
│   │   ├── tenants.controller.ts
│   │   └── tenants.service.ts
│   └── invitations/
│       ├── invitations.module.ts
│       ├── invitations.controller.ts
│       └── invitations.service.ts
└── test/
    └── auth.e2e-spec.ts
```

---

## 2. Docker Compose (dev environment)

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: docmind
      POSTGRES_USER: docmind_owner
      POSTGRES_PASSWORD: devpassword
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

Lưu ý: `docmind_owner` chỉ dùng để chạy migration. Sau khi migrate xong, tạo thêm role `docmind_app` (không phải table owner) để runtime dùng — đúng yêu cầu RLS đã ghi ở migration RLS.

---

## 3. Checklist theo thứ tự triển khai

### Ngày 1-2: Bootstrap
- [ ] `nest new docmind-api`, dọn cấu trúc theo domain module ở trên
- [ ] Setup `docker-compose.yml`, chạy `docker compose up -d`
- [ ] `npx prisma init`, copy schema đã thiết kế vào `prisma/schema.prisma`
- [ ] `npx prisma migrate dev --name init`
- [ ] Chạy 2 migration thủ công đã viết (pgvector+index, RLS) — nhớ tạo role `docmind_app` sau bước RLS
- [ ] Verify: `npx prisma studio` mở được, thấy đủ bảng

### Ngày 3-4: PrismaService + tenant context
- [ ] Viết `PrismaService` — wrapper quanh `PrismaClient`, method `forTenant(tenantId)` trả về client đã set `SET LOCAL app.current_tenant` trong transaction
- [ ] Viết `TenantContextInterceptor` — đọc `tenantId` từ JWT payload (request đã qua `JwtAuthGuard`), wrap toàn bộ request trong `$transaction`
- [ ] Viết test đơn giản: tạo 2 tenant, 2 document khác tenant, verify query của tenant A không thấy document tenant B dù không filter thủ công trong code — đây là bài test RLS quan trọng nhất, nên làm sớm để tin tưởng phần còn lại

### Ngày 5-6: Auth core — password
- [ ] `POST /auth/register` — tạo Identity + AuthProvider(PASSWORD) + Tenant mới + TenantMembership(role=OWNER)
      (Lưu ý: register tạo tenant mới, khác với accept invitation — chỉ tạo TenantMembership vào tenant có sẵn)
- [ ] `POST /auth/login` — verify password, nếu Identity có nhiều membership → trả về danh sách tenant cho FE chọn, hoặc nhận `tenantSlug` trong request để login thẳng vào 1 tenant
- [ ] Hash password bằng argon2 (khuyến nghị hơn bcrypt cho project mới)
- [ ] JWT access token: payload `{ identityId, tenantId, membershipId, role }`, hạn 15 phút

### Ngày 7-8: Refresh token rotation
- [ ] `RefreshTokenService`: `issue()`, `rotate()`, `revokeFamily()`
- [ ] `POST /auth/refresh` — nhận refresh token, hash, tìm theo `tokenHash`:
      - Không tồn tại → 401
      - `revokedAt` đã có → **reuse detected**, gọi `revokeFamily()`, trả 401 kèm flag để FE bắt buộc logout toàn bộ
      - Hợp lệ → revoke token hiện tại, tạo token mới cùng `familyId`, trả access token mới
- [ ] `POST /auth/logout` — revoke refresh token hiện tại (không cần revoke cả family, chỉ logout 1 thiết bị)
- [ ] Viết test: rotate 3 lần liên tiếp thành công; dùng lại token đã rotate → phải bị revoke cả family

### Ngày 9-10: Google OAuth
- [ ] `google.strategy.ts` dùng `passport-google-oauth20` hoặc verify ID token thủ công qua `google-auth-library`
- [ ] `POST /auth/google` — nhận ID token từ FE, verify, lấy `sub` + email
- [ ] Logic link account: tìm AuthProvider(GOOGLE, sub) trước; nếu không có, tìm Identity theo email; nếu Identity tồn tại → thêm AuthProvider mới (link); nếu không → tạo Identity + AuthProvider + Tenant + Membership mới

### Ngày 11-12: Invitation flow
- [ ] `POST /tenants/:id/invitations` (chỉ OWNER/ADMIN) — tạo Invitation, gửi email chứa link `?token=...`
- [ ] `POST /invitations/:token/accept` — nếu chưa login: đăng ký mới hoặc login trước; sau đó tạo TenantMembership với role đã set trong Invitation
- [ ] Guard `RolesGuard` đọc `@Roles('OWNER', 'ADMIN')` decorator, check role từ JWT payload

### Ngày 13-14: Polish & test
- [ ] Roles guard áp dụng cho các route nhạy cảm (invite, revoke API key sau này...)
- [ ] Viết e2e test cho toàn bộ flow: register → login → refresh → logout, invite → accept
- [ ] `.env.example` đầy đủ biến cần thiết
- [ ] README ngắn: cách chạy local (`docker compose up`, `prisma migrate`, `npm run start:dev`)

---

## 4. Danh sách endpoint hoàn chỉnh cuối giai đoạn

```
POST   /auth/register          — tạo Identity + Tenant mới + Membership OWNER
POST   /auth/login              — password login, trả access+refresh token
POST   /auth/google              — Google OAuth login/register
POST   /auth/refresh             — rotate refresh token
POST   /auth/logout              — revoke refresh token hiện tại

POST   /tenants/:id/invitations  — tạo invitation (OWNER/ADMIN only)
POST   /invitations/:token/accept — chấp nhận lời mời
GET    /invitations/:token       — xem thông tin invitation trước khi accept (email, tenant name)
```

---

## 5. Định nghĩa "Done" cho giai đoạn 1

- [ ] Test RLS cross-tenant pass (quan trọng nhất — nếu fail, toàn bộ security model sai)
- [ ] Test reuse detection refresh token pass
- [ ] Đăng ký + login được cả 2 cách (password, Google) qua Postman/Insomnia
- [ ] Invite → accept → user mới xuất hiện đúng role trong `TenantMembership`
- [ ] `docker compose up` từ máy sạch chạy được toàn bộ, không cần setup thủ công gì thêm ngoài `.env`
