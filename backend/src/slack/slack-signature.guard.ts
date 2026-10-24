// Xác thực request từ Slack (slash command) bằng chữ ký — https://api.slack.com/authentication/verifying-requests-from-slack
// Endpoint /slack/commands là @Public() (Slack không có JWT) nên chữ ký là rào chắn DUY NHẤT: thiếu bước
// này thì bất kỳ ai biết URL đều giả được lệnh /ask và hút dữ liệu của tenant.
//
//   basestring = "v0:" + X-Slack-Request-Timestamp + ":" + <raw body nguyên văn>
//   chữ ký     = "v0=" + HMAC-SHA256(signingSecret, basestring) dạng hex
//
// Cần RAW body (đúng từng byte Slack gửi), KHÔNG dùng body đã parse: parse rồi serialize lại không đảm bảo
// ra đúng chuỗi gốc. Vì vậy main.ts phải bật `NestFactory.create(AppModule, { rawBody: true })`.
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  InternalAppException,
  UnauthorizedAppException,
} from '../common/exceptions/app.exception.js';
import { ErrorCode } from '../common/exceptions/error-codes.js';

// Slack khuyến nghị từ chối request cũ hơn 5 phút để chống replay.
export const SLACK_MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60;

export function computeSlackSignature(
  signingSecret: string,
  timestamp: string,
  rawBody: string,
): string {
  return `v0=${createHmac('sha256', signingSecret).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`;
}

@Injectable()
export class SlackSignatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { rawBody?: Buffer }>();

    const signingSecret = this.config.get<string>('SLACK_SIGNING_SECRET', {
      infer: true,
    });
    if (!signingSecret) {
      throw new InternalAppException(
        'Slack integration is not configured on this server',
        ErrorCode.SLACK_NOT_CONFIGURED,
      );
    }
    if (!request.rawBody) {
      throw new InternalAppException(
        'Raw request body is unavailable: enable rawBody in NestFactory.create(AppModule, { rawBody: true })',
        ErrorCode.SLACK_RAW_BODY_MISSING,
      );
    }

    const timestamp = request.headers['x-slack-request-timestamp'];
    const signature = request.headers['x-slack-signature'];
    if (typeof timestamp !== 'string' || typeof signature !== 'string') {
      throw this.invalid();
    }

    const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (
      !Number.isFinite(ageSeconds) ||
      ageSeconds > SLACK_MAX_TIMESTAMP_SKEW_SECONDS
    ) {
      throw this.invalid();
    }

    const expected = Buffer.from(
      computeSlackSignature(
        signingSecret,
        timestamp,
        request.rawBody.toString('utf8'),
      ),
    );
    const actual = Buffer.from(signature);
    // timingSafeEqual ném lỗi nếu độ dài khác nhau -> kiểm tra độ dài trước.
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      throw this.invalid();
    }
    return true;
  }

  private invalid(): UnauthorizedAppException {
    return new UnauthorizedAppException(
      'Invalid Slack signature',
      ErrorCode.SLACK_SIGNATURE_INVALID,
    );
  }
}
