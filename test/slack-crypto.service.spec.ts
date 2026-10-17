import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { SlackCryptoService } from '../src/slack/slack-crypto.service.js';
import { InternalAppException } from '../src/common/exceptions/app.exception.js';
import { ErrorCode } from '../src/common/exceptions/error-codes.js';

function serviceWithKey(key: string | undefined) {
  return new SlackCryptoService({ get: () => key } as any);
}

const KEY = randomBytes(32).toString('base64');
const TOKEN = 'xoxb-1234-5678-abcdefghijklmnop';

describe('SlackCryptoService', () => {
  it('encrypts and decrypts back to original token', () => {
    const service = serviceWithKey(KEY);
    expect(service.decrypt(service.encrypt(TOKEN))).toBe(TOKEN);
  });

  it('stored format does not contain plaintext token and has v1 prefix', () => {
    const stored = serviceWithKey(KEY).encrypt(TOKEN);
    expect(stored.startsWith('v1:')).toBe(true);
    expect(stored).not.toContain(TOKEN);
  });

  it('encrypting the same token twice produces different ciphertexts due to random IV', () => {
    const service = serviceWithKey(KEY);
    expect(service.encrypt(TOKEN)).not.toBe(service.encrypt(TOKEN));
  });

  it('tampering with ciphertext causes decryption to throw (authenticated GCM)', () => {
    const service = serviceWithKey(KEY);
    const [v, iv, tag, data] = service.encrypt(TOKEN).split(':') as [
      string,
      string,
      string,
      string,
    ];
    const bytes = Buffer.from(data, 'base64');
    bytes[0] = bytes[0]! ^ 0xff;
    expect(() =>
      service.decrypt([v, iv, tag, bytes.toString('base64')].join(':')),
    ).toThrow();
  });

  it('wrong encryption key causes decryption to throw', () => {
    const stored = serviceWithKey(KEY).encrypt(TOKEN);
    expect(() =>
      serviceWithKey(randomBytes(32).toString('base64')).decrypt(stored),
    ).toThrow();
  });

  it('unsupported or corrupted format throws error', () => {
    expect(() => serviceWithKey(KEY).decrypt('v2:a:b:c')).toThrow();
    expect(() => serviceWithKey(KEY).decrypt('invalid-format')).toThrow();
  });

  it.each([
    undefined,
    '',
    'not-base64-32-bytes',
    Buffer.alloc(16).toString('base64'),
  ])('missing or invalid key length (%p) -> SLACK_NOT_CONFIGURED', (badKey) => {
    let error: unknown;
    try {
      serviceWithKey(badKey).encrypt(TOKEN);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(InternalAppException);
    expect((error as InternalAppException).code).toBe(
      ErrorCode.SLACK_NOT_CONFIGURED,
    );
  });
});
