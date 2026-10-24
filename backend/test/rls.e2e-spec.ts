// test/rls.e2e-spec.ts
//
// Test RLS cross-tenant — bản đầy đủ.
// Ngoài 2 test gốc (documents, tenants) đã có trong docmind-phase1-implementation.md,
// bổ sung thêm 2 test cho đúng 2 bảng đã bị PHÁT HIỆN THIẾU RLS ở bản draft đầu tiên
// (feedbacks, collection_accesses) — để lỗ hổng đó không bao giờ tái diễn âm thầm.
//
// Yêu cầu môi trường: Postgres + pgvector đã chạy (docker compose up -d), đã migrate đủ cả
// 2 file migration tay (pgvector/tsvector + RLS), và .env có DATABASE_URL/APP_DATABASE_URL/
// SYSTEM_DATABASE_URL trỏ đúng 3 role docmind_owner/docmind_app/docmind_system.

import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../src/prisma/prisma.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PrismaSystemService } from '../src/prisma/prisma-system.service.js';

describe('RLS cross-tenant isolation', () => {
  let prisma: PrismaService;
  let system: PrismaSystemService; // dùng role BYPASSRLS chỉ để SEED dữ liệu test

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    system = moduleRef.get(PrismaSystemService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await system.$disconnect();
  });

  it('tenant A cannot see document of tenant B even without manual filtering', async () => {
    const tenantA = await system.tenant.create({
      data: { name: 'A', slug: 'tenant-a-' + Date.now() },
    });
    const tenantB = await system.tenant.create({
      data: { name: 'B', slug: 'tenant-b-' + Date.now() },
    });

    const identity = await system.identity.create({
      data: { email: `rls-test-${Date.now()}@test.com` },
    });
    await system.tenantMembership.create({
      data: { tenantId: tenantA.id, identityId: identity.id, role: 'OWNER' },
    });
    const collectionB = await system.collection.create({
      data: { tenantId: tenantB.id, name: 'Secret B' },
    });
    const memberB = await system.tenantMembership.create({
      data: { tenantId: tenantB.id, identityId: identity.id, role: 'OWNER' },
    });
    await system.document.create({
      data: {
        tenantId: tenantB.id,
        collectionId: collectionB.id,
        uploadedById: memberB.id,
        filename: 'secret.pdf',
        fileUrl: 's3://secret',
      },
    });

    // Đây mới là assertion thật: query bằng docmind_app trong context tenant A, không filter thủ công
    const docsSeenByTenantA = await prisma.runInTenantContext(
      tenantA.id,
      (tx) => tx.document.findMany(),
    );

    expect(docsSeenByTenantA).toHaveLength(0); // RLS phải tự chặn, không thấy document của B
  });

  it('docmind_app cannot arbitrarily read tenants table of other tenants (patched discovered vulnerability)', async () => {
    const tenantC = await system.tenant.create({
      data: { name: 'C', slug: 'tenant-c-' + Date.now() },
    });
    const tenantD = await system.tenant.create({
      data: { name: 'D', slug: 'tenant-d-' + Date.now() },
    });

    const tenantsSeenByC = await prisma.runInTenantContext(tenantC.id, (tx) =>
      tx.tenant.findMany(),
    );

    expect(tenantsSeenByC.map((t) => t.id)).toEqual([tenantC.id]);
    expect(tenantsSeenByC.find((t) => t.id === tenantD.id)).toBeUndefined();
  });

  it('collection_accesses of other tenants are not exposed via RLS subquery', async () => {
    const tenantE = await system.tenant.create({
      data: { name: 'E', slug: 'tenant-e-' + Date.now() },
    });
    const tenantF = await system.tenant.create({
      data: { name: 'F', slug: 'tenant-f-' + Date.now() },
    });

    const identity = await system.identity.create({
      data: { email: `rls-ca-${Date.now()}@test.com` },
    });
    await system.tenantMembership.create({
      data: { tenantId: tenantE.id, identityId: identity.id, role: 'OWNER' },
    });
    const memberF = await system.tenantMembership.create({
      data: { tenantId: tenantF.id, identityId: identity.id, role: 'OWNER' },
    });
    const collectionF = await system.collection.create({
      data: { tenantId: tenantF.id, name: 'Secret F' },
    });
    await system.collectionAccess.create({
      data: { collectionId: collectionF.id, membershipId: memberF.id },
    });

    // Tenant E hoàn toàn không liên quan tới collection_access này (tồn tại ở tenant F qua
    // subquery join collections -> tenant_id) -> phải không thấy gì.
    const accessSeenByTenantE = await prisma.runInTenantContext(
      tenantE.id,
      (tx) => tx.collectionAccess.findMany(),
    );
    expect(accessSeenByTenantE).toHaveLength(0);
  });

  it('feedbacks of other tenants are not exposed (patched vulnerability — "feedbacks" table was missing RLS)', async () => {
    const tenantG = await system.tenant.create({
      data: { name: 'G', slug: 'tenant-g-' + Date.now() },
    });
    const tenantH = await system.tenant.create({
      data: { name: 'H', slug: 'tenant-h-' + Date.now() },
    });

    const identity = await system.identity.create({
      data: { email: `rls-fb-${Date.now()}@test.com` },
    });
    const memberH = await system.tenantMembership.create({
      data: { tenantId: tenantH.id, identityId: identity.id, role: 'OWNER' },
    });
    const collectionH = await system.collection.create({
      data: { tenantId: tenantH.id, name: 'Col H' },
    });
    const docH = await system.document.create({
      data: {
        tenantId: tenantH.id,
        collectionId: collectionH.id,
        uploadedById: memberH.id,
        filename: 'h.pdf',
        fileUrl: 's3://h',
      },
    });
    const conversationH = await system.conversation.create({
      data: { tenantId: tenantH.id, membershipId: memberH.id, title: 'conv H' },
    });
    const messageH = await system.message.create({
      data: {
        conversationId: conversationH.id,
        role: 'ASSISTANT',
        content: 'answer from document H',
      },
    });
    await system.feedback.create({
      data: { messageId: messageH.id, membershipId: memberH.id, rating: 1 },
    });

    // Nếu policy tenant_isolation cho bảng feedbacks bị thiếu (như bản draft gốc), test này sẽ FAIL
    // vì tenant G sẽ thấy được rating của tenant H.
    const feedbackSeenByTenantG = await prisma.runInTenantContext(
      tenantG.id,
      (tx) => tx.feedback.findMany(),
    );
    expect(feedbackSeenByTenantG).toHaveLength(0);

    // Sanity check ngược lại: chính chủ (tenant H) vẫn thấy được feedback của mình bình thường.
    const feedbackSeenByTenantH = await prisma.runInTenantContext(
      tenantH.id,
      (tx) => tx.feedback.findMany(),
    );
    expect(feedbackSeenByTenantH.map((f) => f.id)).toContain(
      (
        await system.feedback.findFirstOrThrow({
          where: { messageId: messageH.id },
        })
      ).id,
    );
  });
});
