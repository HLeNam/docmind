// Phần thuần (không phụ thuộc Nest) của mã hoá token Slack, để vừa dùng trong SlackCryptoService vừa
// test được dễ dàng. scripts/rotate-slack-tokens.mjs có bản sao cùng định dạng — nếu đổi định dạng ở đây
// thì phải đổi cả script (script tự kiểm tra lại bằng cách giải mã thử trước khi ghi DB).
//
// Định dạng lưu:
//   v2:<kid>:<iv>:<authTag>:<ciphertext>   (base64; kid = 8 ký tự hex đầu của sha256(khoá))
//   v1:<iv>:<authTag>:<ciphertext>         (định dạng cũ, không có kid — vẫn đọc được)
// kid cho phép chọn đúng khoá khi giải mã mà không phải thử từng khoá. Kid chỉ là 8 hex của một hash
// một chiều của khoá 256-bit nên không làm lộ khoá.
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

export const CURRENT_VERSION = 'v2';
const LEGACY_VERSION = 'v1';
const KEY_BYTES = 32;

export class TokenCryptoError extends Error {}

/** base64 -> Buffer 32 byte, throw nếu sai độ dài. */
export function parseKey(raw: string): Buffer {
  const key = Buffer.from(raw.trim(), 'base64');
  if (key.length !== KEY_BYTES) {
    throw new TokenCryptoError('Key must be a base64-encoded 32-byte key');
  }
  return key;
}

/** "k1,k2" -> [Buffer, Buffer]; chuỗi rỗng/undefined -> []. Bỏ qua khoảng trắng và phần tử rỗng. */
export function parseKeyList(raw: string | undefined): Buffer[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(parseKey);
}

export function keyId(key: Buffer): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 8);
}

export function encryptToken(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    CURRENT_VERSION,
    keyId(key),
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

function decryptWithKey(
  key: Buffer,
  iv: string,
  tag: string,
  data: string,
): string {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Giải mã bằng danh sách khoá (khoá hiện tại đứng đầu, sau đó là các khoá cũ).
 * - v2: chọn khoá theo kid; không có khoá khớp -> lỗi rõ ràng (nói thiếu khoá nào).
 * - v1: không có kid nên thử lần lượt từng khoá (GCM xác thực nên khoá sai thì fail ngay, không ra rác).
 */
export function decryptToken(stored: string, keys: Buffer[]): string {
  const parts = stored.split(':');
  const version = parts[0];

  if (version === CURRENT_VERSION && parts.length === 5) {
    const [, kid, iv, tag, data] = parts as [
      string,
      string,
      string,
      string,
      string,
    ];
    const key = keys.find((candidate) => keyId(candidate) === kid);
    if (!key) {
      throw new TokenCryptoError(
        `No encryption key matches kid=${kid} (missing old key in SLACK_TOKEN_ENCRYPTION_KEYS_OLD?)`,
      );
    }
    return decryptWithKey(key, iv, tag, data);
  }

  if (version === LEGACY_VERSION && parts.length === 4) {
    const [, iv, tag, data] = parts as [string, string, string, string];
    let lastError: unknown;
    for (const key of keys) {
      try {
        return decryptWithKey(key, iv, tag, data);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new TokenCryptoError('No key can decrypt this v1 token');
  }

  throw new TokenCryptoError('Unsupported or corrupted encrypted token format');
}

/** true nếu giá trị chưa ở định dạng mới nhất hoặc chưa mã hoá bằng khoá hiện tại. */
export function needsRotation(stored: string, currentKey: Buffer): boolean {
  const parts = stored.split(':');
  return !(
    parts[0] === CURRENT_VERSION &&
    parts.length === 5 &&
    parts[1] === keyId(currentKey)
  );
}
