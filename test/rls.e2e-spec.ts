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

  it('tenant A can not see document of tenant B', async () => {
    // Seed bằng docmind_system (BYPASSRLS) — không dùng cho assertion, chỉ để chuẩn bị dữ liệu
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

  it('docmind_app can not read table tenants of other tenant', async () => {
    const tenantA = await system.tenant.create({
      data: { name: 'C', slug: 'tenant-c-' + Date.now() },
    });
    const tenantD = await system.tenant.create({
      data: { name: 'D', slug: 'tenant-d-' + Date.now() },
    });

    const tenantsSeenByA = await prisma.runInTenantContext(tenantA.id, (tx) =>
      tx.tenant.findMany(),
    );

    expect(tenantsSeenByA.map((t) => t.id)).toEqual([tenantA.id]);
    expect(tenantsSeenByA.find((t) => t.id === tenantD.id)).toBeUndefined();
  });
});
