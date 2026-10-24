import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { PrismaSystemService } from '../prisma/prisma-system.service.js';
import { UnauthorizedAppException } from '../common/exceptions/app.exception.js';
import { ErrorCode } from '../common/exceptions/error-codes.js';
import { hashApiKey, looksLikeApiKey } from './api-key.util.js';
import type { ApiKeyPrincipal } from './api-key-principal.js';

export type ApiKeyRequest = Request & {
  apiKey?: ApiKeyPrincipal;
  tenantId?: string;
};

// Lấy token từ "Authorization: Bearer <key>". Trả null nếu thiếu / sai dạng.
function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token, ...rest] = header.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0)
    return null;
  return token;
}

/**
 * Guard xác thực bằng API key — dùng qua decorator @ApiKeyAuth() (xem decorators/api-key-auth.decorator.ts),
 * không gắn tay.
 *
 * Dùng PrismaSystemService (BYPASSRLS), KHÔNG dùng PrismaService: lúc này chưa biết tenant nào nên
 * app.current_tenant chưa được set, RLS của bảng api_keys sẽ lọc ra rỗng. Đây đúng là kiểu "cross-tenant
 * discovery" hợp lệ như AuthService.login() ở Phase 1: tra theo keyHash (SHA-256 của chuỗi ngẫu nhiên 192 bit,
 * không đoán được, không phải input tuỳ ý), chỉ select đúng vài field cần.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly system: PrismaSystemService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiKeyRequest>();

    const raw = extractBearer(request.headers.authorization);
    if (!raw) {
      throw new UnauthorizedAppException(
        'Missing API key',
        ErrorCode.API_KEY_MISSING,
      );
    }
    // Chặn sớm thứ rõ ràng không phải key của DocMind (vd lỡ gửi JWT) — đỡ tốn 1 lần tra DB.
    if (!looksLikeApiKey(raw)) {
      throw new UnauthorizedAppException(
        'Invalid API key',
        ErrorCode.API_KEY_INVALID,
      );
    }

    const record = await this.system.apiKey.findUnique({
      where: { keyHash: hashApiKey(raw) },
      select: {
        id: true,
        keyPrefix: true,
        tenantId: true,
        collectionId: true,
        revokedAt: true,
      },
    });
    if (!record) {
      throw new UnauthorizedAppException(
        'Invalid API key',
        ErrorCode.API_KEY_INVALID,
      );
    }
    if (record.revokedAt) {
      throw new UnauthorizedAppException(
        'API key has been revoked',
        ErrorCode.API_KEY_REVOKED,
      );
    }

    request.apiKey = {
      apiKeyId: record.id,
      keyPrefix: record.keyPrefix,
      tenantId: record.tenantId,
      collectionId: record.collectionId,
    };
    // Cùng tên field với TenantContextInterceptor (JWT) để code phía sau dùng thống nhất request.tenantId.
    request.tenantId = record.tenantId;
    return true;
  }
}
