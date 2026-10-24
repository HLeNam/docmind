import { describe, expect, it } from 'vitest';
import { createCipheriv, randomBytes } from 'node:crypto';
import { SlackCryptoService } from '../src/slack/slack-crypto.service.js';
import { InternalAppException } from '../src/common/exceptions/app.exception.js';
import { ErrorCode } from '../src/common/exceptions/error-codes.js';

const newKey = () => randomBytes(32).toString('base64');

function serviceWith(current: string | undefined, old?: string) {
  const env: Record<string, string | undefined> = {
    SLACK_TOKEN_ENCRYPTION_KEY: current,
    SLACK_TOKEN_ENCRYPTION_KEYS_OLD: old,
  };
  return new SlackCryptoService({ get: (name: string) => env[name] } as any);
}

const KEY = newKey();
const TOKEN = 'xoxb-1234-5678-abcdefghijklmnop';

describe('SlackCryptoService', () => {
  it('encrypts and decrypts back to original token', () => {
    const service = serviceWith(KEY);
    expect(service.decrypt(service.encrypt(TOKEN))).toBe(TOKEN);
  });

  it('stored data does not contain original token and starts with v2 prefix', () => {
    const stored = serviceWith(KEY).encrypt(TOKEN);
    expect(stored.startsWith('v2:')).toBe(true);
    expect(stored).not.toContain(TOKEN);
  });

  it('encrypting same token twice produces different ciphertexts (random IV)', () => {
    const service = serviceWith(KEY);
    expect(service.encrypt(TOKEN)).not.toBe(service.encrypt(TOKEN));
  });

  it('tampered ciphertext throws on decrypt (authenticated GCM)', () => {
    const service = serviceWith(KEY);
    const [v, kid, iv, tag, data] = service.encrypt(TOKEN).split(':') as [
      string,
      string,
      string,
      string,
      string,
    ];
    const bytes = Buffer.from(data, 'base64');
    bytes[0] = bytes[0]! ^ 0xff;
    expect(() =>
      service.decrypt([v, kid, iv, tag, bytes.toString('base64')].join(':')),
    ).toThrow();
  });

  it('wrong key not in key list throws on decrypt', () => {
    const stored = serviceWith(KEY).encrypt(TOKEN);
    expect(() => serviceWith(newKey()).decrypt(stored)).toThrow(/kid/);
  });

  it('corrupted or unsupported format throws', () => {
    expect(() => serviceWith(KEY).decrypt('v9:a:b:c')).toThrow();
    expect(() => serviceWith(KEY).decrypt('rác')).toThrow();
  });

  it.each([
    undefined,
    '',
    'không-phải-base64-32-byte',
    Buffer.alloc(16).toString('base64'),
  ])('missing or invalid key length (%p) throws SLACK_NOT_CONFIGURED', (badKey) => {
    let error: unknown;
    try {
      serviceWith(badKey).encrypt(TOKEN);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(InternalAppException);
    expect((error as InternalAppException).code).toBe(
      ErrorCode.SLACK_NOT_CONFIGURED,
    );
  });

  describe('key rotation', () => {
    const OLD = newKey();
    const OLDER = newKey();

    it('token encrypted with old key can still be decrypted when old key is in KEYS_OLD', () => {
      const stored = serviceWith(OLD).encrypt(TOKEN);
      const rotated = serviceWith(KEY, `${OLDER},${OLD}`);
      expect(rotated.decrypt(stored)).toBe(TOKEN);
    });

    it('new encryption always uses current key rather than old key', () => {
      const rotated = serviceWith(KEY, OLD);
      const stored = rotated.encrypt(TOKEN);
      expect(serviceWith(KEY).decrypt(stored)).toBe(TOKEN); // chỉ cần khoá mới là đủ
      expect(() => serviceWith(OLD).decrypt(stored)).toThrow();
    });

    it('old token fails to decrypt when old key is removed from KEYS_OLD', () => {
      const stored = serviceWith(OLD).encrypt(TOKEN);
      expect(() => serviceWith(KEY).decrypt(stored)).toThrow();
    });

    it('handles whitespace and empty elements in KEYS_OLD', () => {
      const stored = serviceWith(OLD).encrypt(TOKEN);
      expect(serviceWith(KEY, ` ${OLDER} , ,${OLD} ,`).decrypt(stored)).toBe(
        TOKEN,
      );
    });

    it('KEYS_OLD containing invalid key length throws SLACK_NOT_CONFIGURED', () => {
      const stored = serviceWith(KEY).encrypt(TOKEN);
      let error: unknown;
      try {
        serviceWith(KEY, 'khong-hop-le').decrypt(stored);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(InternalAppException);
      expect((error as InternalAppException).code).toBe(
        ErrorCode.SLACK_NOT_CONFIGURED,
      );
    });

    it('needsRotation returns true for old key and false for current key', () => {
      const withOld = serviceWith(OLD).encrypt(TOKEN);
      const service = serviceWith(KEY, OLD);
      expect(service.needsRotation(withOld)).toBe(true);
      expect(service.needsRotation(service.encrypt(TOKEN))).toBe(false);
    });
  });

  describe('backward compatibility with legacy v1 data (no kid)', () => {
    // Dựng v1 đúng như code cũ đã lưu trong DB.
    function legacyEncrypt(plaintext: string, keyB64: string): string {
      const iv = randomBytes(12);
      const cipher = createCipheriv(
        'aes-256-gcm',
        Buffer.from(keyB64, 'base64'),
        iv,
      );
      const enc = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
      ]);
      return [
        'v1',
        iv.toString('base64'),
        cipher.getAuthTag().toString('base64'),
        enc.toString('base64'),
      ].join(':');
    }

    it('reads v1 token when encrypted with current key', () => {
      expect(serviceWith(KEY).decrypt(legacyEncrypt(TOKEN, KEY))).toBe(TOKEN);
    });

    it('reads v1 token encrypted with old key (tries keys sequentially)', () => {
      const old = newKey();
      expect(
        serviceWith(KEY, `${newKey()},${old}`).decrypt(
          legacyEncrypt(TOKEN, old),
        ),
      ).toBe(TOKEN);
    });

    it('v1 token always reports needing rotation even if encrypted with current key', () => {
      expect(serviceWith(KEY).needsRotation(legacyEncrypt(TOKEN, KEY))).toBe(
        true,
      );
    });
  });
});
