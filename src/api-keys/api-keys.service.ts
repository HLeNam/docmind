import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AccessTokenPayload } from '../auth/auth.service.js';
import {
  NotFoundAppException,
  UnprocessableAppException,
} from '../common/exceptions/app.exception.js';
import { ErrorCode } from '../common/exceptions/error-codes.js';
import { generateApiKey } from './api-key.util.js';
import { CreateApiKeyDto } from './dtos/api-key.dto.js';

// Chỉ select đúng các field an toàn trả ra ngoài — keyHash KHÔNG bao giờ rời service này.
const SAFE_SELECT = {
  id: true,
  name: true,
  keyPrefix: true,
  collectionId: true,
  createdAt: true,
  revokedAt: true,
} as const;

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tạo key mới. tenantId luôn lấy từ JWT của người gọi (đã verify), không nhận từ body/URL.
   * Trả key gốc kèm kết quả — đây là LẦN DUY NHẤT key gốc tồn tại ngoài bộ nhớ.
   */
  async create(caller: AccessTokenPayload, dto: CreateApiKeyDto) {
    const generated = generateApiKey();

    const created = await this.prisma.runInTenantContext(
      caller.tenantId,
      async (tx) => {
        if (dto.collectionId) {
          // Collection có RLS: nếu collectionId thuộc tenant khác, findUnique trả null (Postgres tự lọc),
          // không cần tự viết check "collection.tenantId === caller.tenantId". Chặn được việc Admin tenant A
          // tạo key trỏ vào collection của tenant B.
          const collection = await tx.collection.findUnique({
            where: { id: dto.collectionId },
            select: { id: true },
          });
          if (!collection) {
            throw new NotFoundAppException(
              'Collection not found',
              ErrorCode.COLLECTION_NOT_FOUND,
            );
          }
        }

        return tx.apiKey.create({
          data: {
            tenantId: caller.tenantId,
            name: dto.name,
            keyHash: generated.keyHash,
            keyPrefix: generated.keyPrefix,
            collectionId: dto.collectionId ?? null,
          },
          select: SAFE_SELECT,
        });
      },
    );

    return { ...created, key: generated.raw };
  }

  /** Liệt kê key của tenant (cả key đã revoke, để user thấy lịch sử) — mới nhất trước. */
  async list(caller: AccessTokenPayload) {
    return this.prisma.runInTenantContext(caller.tenantId, (tx) =>
      tx.apiKey.findMany({
        where: { tenantId: caller.tenantId },
        select: SAFE_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  /**
   * Thu hồi key. Không xoá hẳn row: giữ lại để audit và để ApiKeyGuard (bước 4.2) phân biệt được
   * "key đã bị thu hồi" với "key không tồn tại".
   */
  async revoke(caller: AccessTokenPayload, apiKeyId: string) {
    return this.prisma.runInTenantContext(caller.tenantId, async (tx) => {
      const existing = await tx.apiKey.findUnique({
        where: { id: apiKeyId },
        select: SAFE_SELECT,
      });
      if (!existing) {
        throw new NotFoundAppException(
          'API key not found',
          ErrorCode.API_KEY_NOT_FOUND,
        );
      }
      if (existing.revokedAt) {
        throw new UnprocessableAppException(
          'API key has already been revoked',
          undefined,
          ErrorCode.API_KEY_ALREADY_REVOKED,
        );
      }
      return tx.apiKey.update({
        where: { id: apiKeyId },
        data: { revokedAt: new Date() },
        select: SAFE_SELECT,
      });
    });
  }
}
