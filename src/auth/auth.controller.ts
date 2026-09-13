import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  TokensResponseSchema,
  LoginResponseSchema,
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
}
