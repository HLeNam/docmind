import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AccessTokenPayload, AuthService } from './auth.service.js';
import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  TokensResponseSchema,
  LoginResponseSchema,
  GetMeResponseSchema,
  GoogleLoginSchema,
} from './schemas/auth.schema.js';
import type {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  GoogleLoginDto,
} from './dtos/auth.dto.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ApiZodResponse } from '../common/swagger/api-zod-response.decorator.js';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator.js';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RequestMeta } from './refresh-token.service.js';
import { type Request } from 'express';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  // gửi thẳng lên đây để verify — không dùng flow redirect authorization code, nên không cần
  // passport-google-oauth20 / GOOGLE_CLIENT_SECRET ở phía backend.
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
    return this.authService.loginWithGoogle(
      dto.idToken,
      dto.tenantSlug,
      this.extractMeta(req),
    );
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token, issue new access token' })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Tokens successfully refreshed.',
    schema: TokensResponseSchema,
  })
  @ApiErrorResponse(
    HttpStatus.UNAUTHORIZED,
    'Invalid, expired, or revoked refresh token.',
  )
  refresh(
    @Body({ schema: RefreshTokenSchema }) dto: RefreshTokenDto,
    @Req() req: Request,
  ) {
    return this.authService.refresh(dto.refreshToken, this.extractMeta(req));
  }

  @Post('logout')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke current refresh token (1 device)' })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Logout successful.',
    schema: z.null(),
  })
  logout(@Body({ schema: RefreshTokenSchema }) dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  // KHÔNG @Public() — đây chính là route cần bảo vệ nhất bằng pattern global guard vừa làm ở mục 4.4.
  // FE gọi route này sau khi có accessToken để hydrate thông tin user/tenant/role, hoặc để verify
  // token còn sống sau khi reload trang.
  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get current user information',
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

  // req.ip cần Express đã bật "trust proxy" đúng cấu hình (qua Nginx/Cloudflare) để lấy đúng IP thật
  // của client thay vì IP của proxy — cấu hình này thuộc phần deploy, không phải phạm vi file này.
  private extractMeta(req: Request): RequestMeta {
    return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
  }
}
