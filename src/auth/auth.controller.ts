import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
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
} from './schemas/auth.schema.js';
import type {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
} from './dtos/auth.dto.js';
import { Public } from '../common/decorators/public.decorator.js';
import { ApiZodResponse } from '../common/swagger/api-zod-response.decorator.js';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator.js';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

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
  register(@Body({ schema: RegisterSchema }) dto: RegisterDto) {
    return this.authService.register(dto);
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
  login(@Body({ schema: LoginSchema }) dto: LoginDto) {
    return this.authService.login(dto);
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
  refresh(@Body({ schema: RefreshTokenSchema }) dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
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
}
