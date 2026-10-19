// src/slack/slack-crypto.service.ts
//
// Mã hoá bot token của Slack trước khi lưu DB (schema.prisma ghi rõ: "mã hóa ở tầng application").
// AES-256-GCM (mã hoá có xác thực: sửa bậc cipher text là giải mã fail, không ra token sai âm thầm).
// Chi tiết định dạng và thuật toán nằm ở slack-token-crypto.util.ts.
//
// Xoay khoá (không phải cài lại app ở các workspace):
//   SLACK_TOKEN_ENCRYPTION_KEY       = khoá HIỆN TẠI — luôn dùng để mã hoá mới.
//   SLACK_TOKEN_ENCRYPTION_KEYS_OLD  = danh sách khoá cũ (base64, cách nhau bằng dấu phẩy) — chỉ dùng để
//                                       giải mã token đã lưu bằng khoá cũ.
// Quy trình đầy đủ xem SLACK_MODULE_NOTES.md (mục "Xoay khoá mã hoá token").
//
// ⚠️ Mất khoá đã dùng để mã hoá một token (mà không còn trong 2 biến trên) = token đó không giải mã
// được, phải cài lại app ở workspace tương ứng.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InternalAppException } from '../common/exceptions/app.exception.js';
import { ErrorCode } from '../common/exceptions/error-codes.js';
import {
  TokenCryptoError,
  decryptToken,
  encryptToken,
  needsRotation as tokenNeedsRotation,
  parseKey,
  parseKeyList,
} from './slack-token-crypto.util.js';

@Injectable()
export class SlackCryptoService {
  constructor(private readonly config: ConfigService) {}

  encrypt(plaintext: string): string {
    return encryptToken(plaintext, this.currentKey());
  }

  decrypt(stored: string): string {
    return decryptToken(stored, [this.currentKey(), ...this.oldKeys()]);
  }

  /** true nếu token này chưa mã hoá bằng khoá hiện tại (cần chạy script xoay khoá). */
  needsRotation(stored: string): boolean {
    return tokenNeedsRotation(stored, this.currentKey());
  }

  private currentKey(): Buffer {
    const raw = this.config.get<string>('SLACK_TOKEN_ENCRYPTION_KEY', {
      infer: true,
    });
    try {
      if (!raw) throw new TokenCryptoError('missing');
      return parseKey(raw);
    } catch {
      throw new InternalAppException(
        'SLACK_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key',
        ErrorCode.SLACK_NOT_CONFIGURED,
      );
    }
  }

  private oldKeys(): Buffer[] {
    const raw = this.config.get<string>('SLACK_TOKEN_ENCRYPTION_KEYS_OLD', {
      infer: true,
    });
    try {
      return parseKeyList(raw);
    } catch {
      throw new InternalAppException(
        'SLACK_TOKEN_ENCRYPTION_KEYS_OLD must be comma-separated base64-encoded 32-byte keys',
        ErrorCode.SLACK_NOT_CONFIGURED,
      );
    }
  }
}
