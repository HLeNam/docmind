// test/api-key.util.spec.ts
import { describe, expect, it } from 'vitest';
import {
  API_KEY_PREFIX,
  generateApiKey,
  hashApiKey,
  looksLikeApiKey,
} from '../src/api-keys/api-key.util.js';

describe('api-key.util', () => {
  it('sinh key đúng định dạng dm_live_ + prefix hiển thị 12 ký tự', () => {
    const { raw, keyPrefix } = generateApiKey();
    expect(raw.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(keyPrefix).toBe(raw.slice(0, 12));
    expect(keyPrefix).toHaveLength(12);
  });

  it('keyHash khớp hashApiKey(raw) và không chứa key gốc', () => {
    const { raw, keyHash } = generateApiKey();
    expect(keyHash).toBe(hashApiKey(raw));
    expect(keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(keyHash).not.toContain(raw);
  });

  it('mỗi lần sinh ra key khác nhau', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.raw).not.toBe(b.raw);
    expect(a.keyHash).not.toBe(b.keyHash);
  });

  it('looksLikeApiKey chỉ nhận chuỗi đúng prefix và đủ dài', () => {
    expect(looksLikeApiKey(generateApiKey().raw)).toBe(true);
    expect(looksLikeApiKey('dm_live_')).toBe(false);
    expect(looksLikeApiKey('eyJhbGciOi.jwt.token')).toBe(false);
  });
});
