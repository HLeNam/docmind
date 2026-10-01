// test/auth-invitation-flow.e2e-spec.ts
//
// Bản đầy đủ của khung sườn "test/auth-invitation-flow.e2e-spec.ts" đã phác thảo trong
// docmind-phase1-implementation.md mục 7 — trước đó chỉ có comment mô tả từng bước, chưa có
// code thật. File này implement bằng supertest, bootstrap app giống hệt main.ts.
//
// Yêu cầu môi trường: Postgres + pgvector đã migrate đủ (bao gồm RLS), .env có đủ
// DATABASE_URL/APP_DATABASE_URL/SYSTEM_DATABASE_URL/JWT_SECRET/GOOGLE_CLIENT_ID/MAIL_*/FRONTEND_URL.
// Lưu ý: MailService.sendInvitationEmail() tự bắt lỗi gửi mail và chỉ log (không throw) — nên dù
// MAIL_PROVIDER trỏ tới 1 provider không gửi được thật ở môi trường test, request tạo invitation
// vẫn trả về 201 bình thường, token vẫn lấy được thẳng từ response mà không cần đọc email thật.

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter.js';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor.js';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor.js';
import { ValidationAppException } from '../src/common/exceptions/app.exception.js';

const VALID_PASSWORD = 'Passw0rd123';

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.docmind.local`;
}

// Bootstrap app cho test, đăng ký lại đúng pipe/filter/interceptor như main.ts thật —
// nếu main.ts sau này thêm gì mới (vd 1 interceptor khác), nhớ đồng bộ lại ở đây.
async function bootstrapTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();

  app.useGlobalPipes(
    new StandardSchemaValidationPipe({
      transform: true,
      exceptionFactory: (issues) => {
        const details: Record<string, string[]> = {};
        for (const issue of issues) {
          const field = issue.path?.length
            ? issue.path.map(String).join('.')
            : 'root';
          (details[field] ??= []).push(issue.message);
        }
        return new ValidationAppException('Validation failed', details);
      },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseInterceptor(),
  );

  await app.init();
  return app;
}

describe('Full auth + invitation flow (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await bootstrapTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('register -> login -> refresh -> reuse detection -> logout', async () => {
    const email = uniqueEmail('owner');

    // 1. Register
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: VALID_PASSWORD, tenantName: 'Flow Test Co' })
      .expect(201);

    expect(registerRes.body.success).toBe(true);
    const { accessToken: firstAccessToken, refreshToken: firstRefreshToken } =
      registerRes.body.data;
    expect(typeof firstAccessToken).toBe('string');
    expect(typeof firstRefreshToken).toBe('string');

    // register lại đúng email -> phải bị từ chối (409, đúng error code nghiệp vụ)
    const duplicateRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: VALID_PASSWORD, tenantName: 'Duplicate Co' })
      .expect(409);
    expect(duplicateRes.body.error.code).toBe('AUTH_EMAIL_TAKEN');

    // 2. Login lại bằng đúng email/password vừa đăng ký -> family refresh token MỚI, khác lúc register
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: VALID_PASSWORD })
      .expect(200);
    expect(loginRes.body.success).toBe(true);
    const { refreshToken: loginRefreshToken } = loginRes.body.data;

    // sai password -> 401 đúng code
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'SaiMatKhau123' })
      .expect(401)
      .then((res) =>
        expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS'),
      );

    // 3. Rotate refresh token nhận từ login
    const refreshRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: loginRefreshToken })
      .expect(200);
    expect(refreshRes.body.success).toBe(true);
    const {
      accessToken: rotatedAccessToken,
      refreshToken: rotatedRefreshToken,
    } = refreshRes.body.data;
    expect(rotatedRefreshToken).not.toBe(loginRefreshToken);

    // GET /auth/me bằng access token vừa rotate
    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${rotatedAccessToken}`)
      .expect(200);
    expect(meRes.body.data.identity.email).toBe(email);
    expect(meRes.body.data.membership.role).toBe('OWNER');

    // không kèm Authorization -> 401
    await request(app.getHttpServer()).get('/auth/me').expect(401);

    // 4. Reuse detection: dùng lại refresh token CŨ (loginRefreshToken đã bị revoke bởi bước rotate)
    const reuseRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: loginRefreshToken })
      .expect(401);
    expect(reuseRes.body.error.code).toBe('AUTH_REFRESH_TOKEN_REUSED');

    // hệ quả: rotatedRefreshToken (cùng family, sinh ra sau) cũng đã bị revoke theo -> reuse tiếp
    const rotatedNowRevokedRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: rotatedRefreshToken })
      .expect(401);
    expect(rotatedNowRevokedRes.body.error.code).toBe(
      'AUTH_REFRESH_TOKEN_REUSED',
    );

    // chuỗi hoàn toàn ngẫu nhiên, chưa từng tồn tại -> invalid, không phải reuse
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'chuoi-khong-ton-tai-' + Date.now() })
      .expect(401)
      .then((res) =>
        expect(res.body.error.code).toBe('AUTH_REFRESH_TOKEN_INVALID'),
      );

    // 5. Logout bằng refresh token đầu tiên (từ register — family riêng, chưa bị đụng tới ở trên)
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${firstAccessToken}`)
      .send({ refreshToken: firstRefreshToken })
      .expect(200);

    // token vừa logout, dùng lại -> cũng rơi vào nhánh reuse detected (revokedAt đã set bởi logout)
    const afterLogoutRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: firstRefreshToken })
      .expect(401);
    expect(afterLogoutRes.body.error.code).toBe('AUTH_REFRESH_TOKEN_REUSED');
  });

  it('invite -> accept (email has no account yet)', async () => {
    const ownerEmail = uniqueEmail('inv-owner');
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: ownerEmail,
        password: VALID_PASSWORD,
        tenantName: 'Invite Test Co',
      })
      .expect(201);
    const ownerAccessToken = registerRes.body.data.accessToken;

    const inviteeEmail = uniqueEmail('invitee');

    // :tenantId trên URL bị service cố tình bỏ qua (luôn dùng tenantId từ JWT) -> truyền giá trị
    // bất kỳ vẫn phải hoạt động đúng, đây cũng là cách test luôn điểm bảo mật đó.
    const createInviteRes = await request(app.getHttpServer())
      .post('/tenants/khong-quan-tam/invitations')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ email: inviteeEmail, role: 'MEMBER' })
      .expect(201);
    expect(createInviteRes.body.success).toBe(true);
    const invitationId: string = createInviteRes.body.data.id;
    const invitationToken: string = createInviteRes.body.data.token;

    // Xem preview trước khi accept — public, chưa cần đăng nhập
    const previewRes = await request(app.getHttpServer())
      .get(`/invitations/${invitationToken}`)
      .expect(200);
    expect(previewRes.body.data.email).toBe(inviteeEmail);
    expect(previewRes.body.data.role).toBe('MEMBER');
    expect(previewRes.body.data.tenantName).toBe('Invite Test Co');

    // Accept — email chưa có Identity nào -> bắt buộc kèm password
    const missingPasswordRes = await request(app.getHttpServer())
      .post(`/invitations/${invitationToken}/accept`)
      .send({})
      .expect(400);
    expect(missingPasswordRes.body.error.code).toBe(
      'INVITATION_PASSWORD_REQUIRED',
    );

    const acceptRes = await request(app.getHttpServer())
      .post(`/invitations/${invitationToken}/accept`)
      .send({ password: VALID_PASSWORD })
      .expect(200);
    expect(acceptRes.body.success).toBe(true);
    const memberAccessToken = acceptRes.body.data.accessToken;

    // GET /auth/me bằng token vừa nhận -> đúng role MEMBER, đúng tenant
    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(200);
    expect(meRes.body.data.identity.email).toBe(inviteeEmail);
    expect(meRes.body.data.membership.role).toBe('MEMBER');
    expect(meRes.body.data.tenant.name).toBe('Invite Test Co');

    // Accept lần 2 với cùng token -> phải từ chối (đã accepted)
    const acceptAgainRes = await request(app.getHttpServer())
      .post(`/invitations/${invitationToken}/accept`)
      .send({ password: VALID_PASSWORD })
      .expect(422);
    expect(acceptAgainRes.body.error.code).toBe('INVITATION_ALREADY_ACCEPTED');

    // MEMBER không có quyền tạo invitation (RolesGuard chặn)
    await request(app.getHttpServer())
      .post('/tenants/x/invitations')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .send({ email: uniqueEmail('blocked'), role: 'MEMBER' })
      .expect(403);

    // OWNER revoke 1 invitation MỚI (chưa accept) -> accept sau đó phải bị từ chối
    const secondInviteRes = await request(app.getHttpServer())
      .post('/tenants/x/invitations')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ email: uniqueEmail('to-be-revoked'), role: 'MEMBER' })
      .expect(201);
    const secondInvitationId: string = secondInviteRes.body.data.id;
    const secondInvitationToken: string = secondInviteRes.body.data.token;

    await request(app.getHttpServer())
      .delete(`/tenants/x/invitations/${secondInvitationId}`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);

    const acceptRevokedRes = await request(app.getHttpServer())
      .post(`/invitations/${secondInvitationToken}/accept`)
      .send({ password: VALID_PASSWORD })
      .expect(422);
    expect(acceptRevokedRes.body.error.code).toBe('INVITATION_REVOKED');

    void invitationId; // giữ lại biến để dễ mở rộng test sau này (vd revoke chính invitation này)
  });

  it('invite -> accept (email already has an account in another tenant) — link additional membership, do not create new Identity', async () => {
    const existingEmail = uniqueEmail('multi-tenant');

    // 1. Tạo sẵn 1 Identity qua register() ở Tenant A
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: existingEmail,
        password: VALID_PASSWORD,
        tenantName: 'Tenant A',
      })
      .expect(201);

    // 2. Owner của Tenant B mời đúng email đó, role ADMIN
    const ownerBRegisterRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: uniqueEmail('owner-b'),
        password: VALID_PASSWORD,
        tenantName: 'Tenant B',
      })
      .expect(201);
    const ownerBAccessToken = ownerBRegisterRes.body.data.accessToken;

    const createInviteRes = await request(app.getHttpServer())
      .post('/tenants/x/invitations')
      .set('Authorization', `Bearer ${ownerBAccessToken}`)
      .send({ email: existingEmail, role: 'ADMIN' })
      .expect(201);
    const invitationToken: string = createInviteRes.body.data.token;

    // 3. Accept KHÔNG cần password (Identity đã tồn tại) -> nhận token đăng nhập thẳng vào Tenant B
    const acceptRes = await request(app.getHttpServer())
      .post(`/invitations/${invitationToken}/accept`)
      .send({})
      .expect(200);
    const tenantBAccessToken = acceptRes.body.data.accessToken;

    // 4. Xác nhận đã vào đúng Tenant B với đúng role đã mời (ADMIN), không phải OWNER (role ở Tenant A)
    const meInTenantB = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${tenantBAccessToken}`)
      .expect(200);
    expect(meInTenantB.body.data.identity.email).toBe(existingEmail);
    expect(meInTenantB.body.data.tenant.name).toBe('Tenant B');
    expect(meInTenantB.body.data.membership.role).toBe('ADMIN');

    // 5. Login lại bằng password gốc, KHÔNG chỉ định tenantSlug -> vì giờ có 2 membership,
    //    login() phải trả requiresTenantSelection thay vì phát token bừa vào 1 tenant.
    const loginMultiRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: existingEmail, password: VALID_PASSWORD })
      .expect(200);
    expect(loginMultiRes.body.data.requiresTenantSelection).toBe(true);
    expect(loginMultiRes.body.data.tenants).toHaveLength(2);

    // Login lại có chỉ định tenantSlug (lấy từ /auth/me ở trên qua slug Tenant B) phải phát token thẳng
    const tenantBSlugMeRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${tenantBAccessToken}`)
      .expect(200);
    const tenantBSlug: string = tenantBSlugMeRes.body.data.tenant.slug;

    const loginWithSlugRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: existingEmail,
        password: VALID_PASSWORD,
        tenantSlug: tenantBSlug,
      })
      .expect(200);
    expect(loginWithSlugRes.body.data.requiresTenantSelection).toBeUndefined();
    expect(typeof loginWithSlugRes.body.data.accessToken).toBe('string');
  });
});
