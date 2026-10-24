import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // @Public() gắn ở route hoặc cả controller đều được nhận diện (getAllAndOverride
    // ưu tiên metadata ở handler trước, class sau)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // Không phải public -> để AuthGuard('jwt') gốc xử lý: verify token qua
    // JwtStrategy, set request.user nếu hợp lệ, tự throw UnauthorizedException nếu thiếu/sai token
    return super.canActivate(context);
  }
}
