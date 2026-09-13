import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

// gắn vào request bởi JwtAuthGuard sau khi verify token — xem jwt.strategy.ts bên dưới
export interface AuthenticatedRequest {
  user?: {
    identityId: string;
    tenantId: string;
    membershipId: string;
    role: string;
  };
  tenantId?: string;
}

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // route không cần auth (vd /auth/login, /auth/register) không có request.user -> bỏ qua, chạy thẳng
    if (!request.user?.tenantId) {
      return next.handle();
    }

    // Mỗi service tự gọi this.prisma.runInTenantContext(request.tenantId, ...) khi chạm DB.
    // Interceptor chỉ đảm bảo tenantId có sẵn nhất quán trên request, không tự bọc transaction
    // toàn bộ handler (vì handler có thể có side-effect ngoài DB, không hợp với transaction semantics).
    request.tenantId = request.user.tenantId;
    return next.handle();
  }
}
