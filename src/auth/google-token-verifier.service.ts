import { Injectable } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedAppException } from '../common/exceptions/app.exception.js';
import { ErrorCode } from '../common/exceptions/error-codes.js';

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

@Injectable()
export class GoogleTokenVerifierService {
  private readonly client: OAuth2Client;
  private readonly clientId: string;

  constructor(configService: ConfigService) {
    this.clientId = configService.get<string>('GOOGLE_CLIENT_ID', {
      infer: true,
    })!;
    this.client = new OAuth2Client(this.clientId);
  }

  async verify(idToken: string): Promise<GoogleProfile> {
    let ticket;
    try {
      // verifyIdToken tự kiểm tra: chữ ký (theo public key Google công bố), issuer, audience khớp
      // clientId, và hạn sử dụng token — throw nếu bất kỳ điều kiện nào sai.
      ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
    } catch {
      throw new UnauthorizedAppException(ErrorCode.AUTH_GOOGLE_TOKEN_INVALID);
    }

    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedAppException(ErrorCode.AUTH_GOOGLE_TOKEN_MISSING_CLAIMS);
    }

    // payload.name có sẵn trong id_token khi scope OAuth có "profile" (mặc định có với Google
    // Identity Services) — dùng để điền Identity.displayName, field đã có sẵn trong schema
    // nhưng register()/login() bằng password không có nguồn nào tương đương để điền.
    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified ?? false,
      name: payload.name,
    };
  }
}
