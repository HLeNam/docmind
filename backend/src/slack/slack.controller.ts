import {
  Controller,
  Delete,
  Get,
  HttpStatus,
  Logger,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ApiZodResponse } from '../common/swagger/api-zod-response.decorator.js';
import { ApiErrorResponse } from '../common/swagger/api-error-response.decorator.js';
import { AppException } from '../common/exceptions/app.exception.js';
import type { AccessTokenPayload } from '../auth/auth.service.js';
import { SlackService } from './slack.service.js';

const InstallUrlResponseSchema = z.object({
  url: z
    .string()
    .describe(
      'Open this URL in a browser to install DocMind into a Slack workspace',
    ),
});
const IntegrationResponseSchema = z.object({
  connected: z.boolean().describe('Whether a Slack workspace is connected'),
  slackTeamId: z.string().optional().describe('Connected Slack team ID'),
  connectedAt: z
    .string()
    .optional()
    .describe('ISO timestamp when Slack was connected'),
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resultPage(title: string, message: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 16px;text-align:center;color:#111}h1{font-size:1.4rem}p{color:#555}</style></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></body></html>`;
}

@ApiTags('slack')
@Controller('slack')
export class SlackController {
  private readonly logger = new Logger(SlackController.name);

  constructor(private readonly slackService: SlackService) {}

  @Get('install')
  @Roles('OWNER', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Generate Slack OAuth install URL for current tenant (OWNER/ADMIN only)',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Installation URL (expires in 10 minutes)',
    schema: InstallUrlResponseSchema,
  })
  @ApiErrorResponse(
    HttpStatus.FORBIDDEN,
    'Forbidden: Requires OWNER or ADMIN role',
  )
  @ApiErrorResponse(
    HttpStatus.INTERNAL_SERVER_ERROR,
    'Slack integration is not configured on this server',
  )
  install(@CurrentUser() user: AccessTokenPayload) {
    return this.slackService.buildInstallUrl(user);
  }

  // Slack redirect trình duyệt về đây: KHÔNG có JWT nên @Public(); tenant lấy từ `state` đã ký.
  // Trả trang HTML (người xem là con người trên trình duyệt, không phải client API) nên dùng @Res()
  // và tự bắt lỗi thay vì để GlobalExceptionFilter trả JSON.
  @Public()
  @Get('oauth/callback')
  @ApiOperation({
    summary:
      'Slack OAuth redirect callback endpoint (handled automatically by browser)',
  })
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (error) {
      // User pressed Cancel/Deny on Slack: error=access_denied
      res
        .status(HttpStatus.BAD_REQUEST)
        .type('html')
        .send(
          resultPage(
            'Installation Canceled',
            'You did not grant permissions to DocMind in Slack.',
          ),
        );
      return;
    }
    if (!code || !state) {
      res
        .status(HttpStatus.BAD_REQUEST)
        .type('html')
        .send(
          resultPage(
            'Invalid Request',
            'Missing required parameters from Slack.',
          ),
        );
      return;
    }

    try {
      const result = await this.slackService.completeInstall(code, state);
      const where = result.slackTeamName
        ? `workspace "${result.slackTeamName}"`
        : 'Slack workspace';
      res
        .status(HttpStatus.OK)
        .type('html')
        .send(
          resultPage(
            'Connected Successfully',
            `DocMind has been installed into ${where}. You can close this window.`,
          ),
        );
    } catch (err) {
      if (err instanceof AppException) {
        res
          .status(err.getStatus())
          .type('html')
          .send(resultPage('Installation Failed', err.message));
        return;
      }
      this.logger.error('Unexpected error in Slack OAuth callback', err);
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .type('html')
        .send(
          resultPage(
            'Something went wrong',
            'Please try again later.',
          ),
        );
    }
  }

  @Get('integration')
  @Roles('OWNER', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Get current tenant Slack workspace integration status (OWNER/ADMIN only)',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Current integration status',
    schema: IntegrationResponseSchema,
  })
  @ApiErrorResponse(
    HttpStatus.FORBIDDEN,
    'Forbidden: Requires OWNER or ADMIN role',
  )
  getIntegration(@CurrentUser() user: AccessTokenPayload) {
    return this.slackService.getIntegration(user);
  }

  @Delete('integration')
  @Roles('OWNER', 'ADMIN')
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Disconnect Slack workspace and remove all channel mappings (OWNER/ADMIN only)',
  })
  @ApiZodResponse({
    status: HttpStatus.OK,
    description: 'Successfully disconnected',
    schema: z.object({ connected: z.literal(false) }),
  })
  @ApiErrorResponse(
    HttpStatus.FORBIDDEN,
    'Forbidden: Requires OWNER or ADMIN role',
  )
  @ApiErrorResponse(
    HttpStatus.NOT_FOUND,
    'Tenant is not connected to a Slack workspace',
  )
  disconnect(@CurrentUser() user: AccessTokenPayload) {
    return this.slackService.disconnect(user);
  }
}
