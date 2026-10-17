// Mã hoá bot token của Slack trước khi lưu DB (schema.prisma ghi rõ: "mã hóa ở tầng application").
// AES-256-GCM (mã hoá có xác thực: sửa bậc cipher text là giải mã fail, không ra token sai âm thầm).
// Định dạng lưu: "v1:<iv>:<authTag>:<ciphertext>" (base64) — tiền tố "v1" để sau này đổi thuật toán/xoay
// khoá mà vẫn đọc được dữ liệu cũ.
//
// ⚠️ Mất SLACK_TOKEN_ENCRYPTION_KEY = mọi token đã lưu không giải mã được (phải cài lại app ở mọi
// workspace). Đổi khoá cũng vậy — hiện chưa có cơ chế xoay khoá.
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { InternalAppException } from '../common/exceptions/app.exception.js';
import { ErrorCode } from '../common/exceptions/error-codes.js';

const VERSION = 'v1';

@Injectable()
export class SlackCryptoService {
  constructor(private readonly config: ConfigService) {}

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      VERSION,
      iv.toString('base64'),
      tag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  decrypt(stored: string): string {
    const [version, iv, tag, data] = stored.split(':');
    if (version !== VERSION || !iv || !tag || !data) {
      throw new Error('Unsupported or corrupted encrypted token format');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key(),
      Buffer.from(iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(data, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  private key(): Buffer {
    const raw = this.config.get<string>('SLACK_TOKEN_ENCRYPTION_KEY', {
      infer: true,
    });
    const key = raw ? Buffer.from(raw, 'base64') : undefined;
    if (!key || key.length !== 32) {
      throw new InternalAppException(
        'SLACK_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key',
        ErrorCode.SLACK_NOT_CONFIGURED,
      );
    }
    return key;
  }
}
