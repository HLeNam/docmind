import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccessTokenPayload } from '../auth/auth.service.js';
import { CreateCollectionDto } from './dtos/collection.dto.js';
import { NotFoundAppException } from '../common/exceptions/app.exception.js';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(caller: AccessTokenPayload, dto: CreateCollectionDto) {
    return this.prisma.runInTenantContext(caller.tenantId, (tx) =>
      tx.collection.create({
        data: {
          tenantId: caller.tenantId,
          name: dto.name,
          description: dto.description,
        },
      }),
    );
  }

  async list(caller: AccessTokenPayload) {
    return this.prisma.runInTenantContext(caller.tenantId, async (tx) => {
      // OWNER/ADMIN thấy mọi collection của tenant; MEMBER chỉ thấy collection được gán qua CollectionAccess.
      if (caller.role === 'OWNER' || caller.role === 'ADMIN') {
        return tx.collection.findMany({ orderBy: { createdAt: 'desc' } });
      }
      return tx.collection.findMany({
        where: { access: { some: { membershipId: caller.membershipId } } },
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  async delete(caller: AccessTokenPayload, collectionId: string) {
    return this.prisma.runInTenantContext(caller.tenantId, async (tx) => {
      const collection = await tx.collection.findUnique({
        where: { id: collectionId },
      });
      if (!collection) throw new NotFoundAppException('Collection not found');
      // onDelete: Cascade trên Document/CollectionAccess/SlackChannelMapping tự dọn theo.
      return tx.collection.delete({ where: { id: collectionId } });
    });
  }

  /**
   * Dùng chung bởi RetrievalService: trả về danh sách collectionId mà membership này được phép
   * đọc, để lọc hybrid search theo đúng permission (RLS chỉ cô lập theo TENANT, không theo
   * COLLECTION — phần lọc collection là business logic, phải tự làm ở đây).
   */
  async listAccessibleCollectionIds(
    caller: AccessTokenPayload,
  ): Promise<string[]> {
    return this.prisma.runInTenantContext(caller.tenantId, async (tx) => {
      if (caller.role === 'OWNER' || caller.role === 'ADMIN') {
        const all = await tx.collection.findMany({ select: { id: true } });
        return all.map((c) => c.id);
      }
      const accessible = await tx.collectionAccess.findMany({
        where: { membershipId: caller.membershipId },
        select: { collectionId: true },
      });
      return accessible.map((a) => a.collectionId);
    });
  }

  /**
   * Dùng bởi DocumentsService trước khi cho upload/đọc 1 document: xác nhận caller có quyền vào
   * ĐÚNG collection đó (không phải chỉ liệt kê toàn bộ danh sách như listAccessibleCollectionIds).
   * Throw NotFoundAppException thay vì ForbiddenAppException để không rò rỉ thông tin collection
   * đó có tồn tại hay không cho người không có quyền (giống cách 404 thay 403 ở nhiều API thật).
   */
  async assertCollectionAccessible(
    caller: AccessTokenPayload,
    collectionId: string,
  ): Promise<void> {
    const accessibleIds = await this.listAccessibleCollectionIds(caller);
    if (!accessibleIds.includes(collectionId)) {
      throw new NotFoundAppException('Collection not found');
    }
  }
}
