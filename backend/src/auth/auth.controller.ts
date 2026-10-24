import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ForbiddenAppException } from '../common/exceptions/app.exception.js';
import { ApiZodResponse } from '../common/swagger/api-zod-response.decorator.js';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator.js';
import { isOriginAllowed, resolveAllowedOrigins } from '../common/cors.util.js';
import { AuthService, type AccessTokenPayload } from './auth.service.js';
import { RefreshCookieInterceptor } from './refresh-cookie.interceptor.js';
import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookieOptions,
  readRefreshCookie,
  resolveRefreshCookieSettings,
} from './refresh-cookie.util.js';
import type { RequestMeta } from './refresh-token.service.js';
import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  TokensResponseSchema,
  LoginResponseSchema,
  GetMeResponseSchema,
  GoogleLoginSchema,
} from './schemas/auth.schema.js';

import {
  type RegisterDto,
  type LoginDto,
  type RefreshTokenDto,
  type GoogleLoginDto,
} from './dtos/auth.dto.js';

// RefreshCookieInterceptor: các route trả cặp token (register/login/google/refresh) đặt refreshToken vào cookie HttpOnly
// và bỏ nó khỏi body. Route khác (me, logout) không bị ảnh hưởng vì kết quả không phải cặp token.
@ApiTags('auth')
@Controller('auth')
@UseInterceptors(RefreshCookieInterceptor)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({
    summary: 'Register — create Identity + new Tenant + OWNER Membership',
  })
  @ApiZodResponse({
    status: HttpStatus.CREATED,
    description: 'Registration successful. Returns access and refresh tokens.',
    schema: TokensResponseSchema,
  })
  @ApiErrorResponse(HttpStatus.CONFLICT, 'Email already used.')
  register(
    @Body({ schema: RegisterSchema }) dto: RegisterDto,
    @Req() req: Request,
  ) {
    return this.authService.register(dto, this.extractMeta(req));
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with password' })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description:
      'Login successful. Returns tokens or tenant selection requirement.',
    schema: LoginResponseSchema,
  })
  @ApiErrorResponse(
    HttpStatus.UNAUTHORIZED,
    'Invalid credentials or not a member of the organization.',
  )
  login(@Body({ schema: LoginSchema }) dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, this.extractMeta(req));
  }

  // FE dùng Google Identity Services (One Tap / Sign In With Google) lấy idToken phía client,
  // gửi thẳng lên đây để verify — không dùng flow redirect authorization code.
  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Login/register via Google — verify ID token, auto link/create account',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Google login/registration successful.',
    schema: LoginResponseSchema,
  })
  @ApiErrorResponse(
    HttpStatus.UNAUTHORIZED,
    'Invalid or expired Google ID token.',
  )
  google(
    @Body({ schema: GoogleLoginSchema }) dto: GoogleLoginDto,
    @Req() req: Request,
  ) {
    // SỬA: truyền thêm dto.tenantSlug — trước đó bị bỏ quên, khiến identity nhiều membership
    // qua Google luôn bị ép vào tenant đầu tiên thay vì được chọn như đăng nhập bằng password.
    return this.authService.loginWithGoogle(
      dto.idToken,
      dto.tenantSlug,
      this.extractMeta(req),
    );
  }

  // Refresh token lấy từ body (client không phải trình duyệt, Swagger) HOẶC cookie HttpOnly (trình duyệt). Body ưu tiên
  // vì là lựa chọn tường minh. Thiếu cả hai -> chuỗi rỗng -> service từ chối bằng đúng mã lỗi "token không hợp lệ" như cũ.
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Rotate refresh token (HttpOnly cookie or body), issue new access token',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Tokens successfully refreshed.',
    schema: TokensResponseSchema,
  })
  @ApiErrorResponse(
    HttpStatus.UNAUTHORIZED,
    'Invalid, expired, or revoked refresh token.',
  )
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'Origin not allowed.')
  refresh(
    @Body({ schema: RefreshTokenSchema }) dto: RefreshTokenDto,
    @Req() req: Request,
  ) {
    this.assertAllowedOrigin(req);
    return this.authService.refresh(
      dto.refreshToken ?? readRefreshCookie(req.headers.cookie) ?? '',
      this.extractMeta(req),
    );
  }

  // @Public(): sở hữu refreshToken hợp lệ, chưa revoke, là bằng chứng đủ quyền để revoke chính nó
  // (đúng chuẩn OAuth2 token revocation — RFC 7009), không cần access token còn hạn.
  // Idempotent: không có token nào (cookie đã hết/đã xoá) thì chỉ xoá cookie, vẫn 200 — đăng xuất lần hai không phải lỗi.
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke current refresh token (1 device) and clear cookie',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Logout successful.',
    schema: z.null(),
  })
  @ApiErrorResponse(HttpStatus.FORBIDDEN, 'Origin not allowed.')
  async logout(
    @Body({ schema: RefreshTokenSchema }) dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.assertAllowedOrigin(req);
    const token = dto.refreshToken ?? readRefreshCookie(req.headers.cookie);
    res.clearCookie(
      REFRESH_COOKIE_NAME,
      clearRefreshCookieOptions(resolveRefreshCookieSettings(this.env())),
    );
    if (token) await this.authService.logout(token);
  }

  // KHÔNG @Public() — route cần bảo vệ nhất bằng pattern global guard (JwtAuthGuard).
  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get current user information (identity + tenant + role)',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Returns current user identity, tenant, and membership info.',
    schema: GetMeResponseSchema,
  })
  @ApiErrorResponse(HttpStatus.UNAUTHORIZED, 'Invalid or expired access token.')
  me(@CurrentUser() user: AccessTokenPayload) {
    return this.authService.getMe(user);
  }

  // Chống CSRF cho 2 route dùng cookie: trình duyệt luôn gửi Origin trên POST; có Origin mà không nằm trong danh sách
  // cho phép (CORS_ORIGINS / FRONTEND_URL) thì từ chối. Không có Origin (curl, server-to-server) hoặc chưa cấu hình: cho qua.
  private assertAllowedOrigin(req: Request): void {
    if (
      !isOriginAllowed(req.headers.origin, resolveAllowedOrigins(this.env()))
    ) {
      throw new ForbiddenAppException('Origin not allowed');
    }
  }

  private env(): Record<string, string | undefined> {
    const keys = [
      'NODE_ENV',
      'CORS_ORIGINS',
      'FRONTEND_URL',
      'AUTH_COOKIE_SAMESITE',
      'AUTH_COOKIE_SECURE',
      'AUTH_COOKIE_PATH',
      'AUTH_REFRESH_COOKIE_MAX_AGE_DAYS',
      'AUTH_REFRESH_TOKEN_IN_BODY',
    ];
    return Object.fromEntries(
      keys.map((k) => [k, this.config.get<string>(k) ?? process.env[k]]),
    );
  }

  // req.ip cần Express đã bật "trust proxy" đúng cấu hình để lấy đúng IP thật của client.
  private extractMeta(req: Request): RequestMeta {
    return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
  }
}
