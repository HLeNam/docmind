import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  decryptToken,
  encryptToken,
  keyId,
  needsRotation,
  parseKey,
  parseKeyList,
} from '../src/slack/slack-token-crypto.util.js';

const k = () => randomBytes(32);

describe('slack-token-crypto.util', () => {
  it('parseKey passes on exact 32 bytes and throws on invalid length', () => {
    expect(parseKey(k().toString('base64'))).toHaveLength(32);
    expect(() => parseKey(randomBytes(16).toString('base64'))).toThrow();
  });

  it('parseKeyList returns empty array for undefined/empty, splits by comma, trims whitespace', () => {
    expect(parseKeyList(undefined)).toEqual([]);
    expect(parseKeyList('')).toEqual([]);
    const a = k();
    const b = k();
    expect(parseKeyList(` ${a.toString('base64')} , ${b.toString('base64')},`)).toEqual([a, b]);
  });

  it('keyId is stable 8-hex string and differs between keys', () => {
    const a = k();
    expect(keyId(a)).toMatch(/^[0-9a-f]{8}$/);
    expect(keyId(a)).toBe(keyId(Buffer.from(a)));
    expect(keyId(a)).not.toBe(keyId(k()));
  });

  it('encrypt and decrypt roundtrip preserves token and includes key kid', () => {
    const key = k();
    const stored = encryptToken('xoxb-secret', key);
    expect(stored.split(':')[1]).toBe(keyId(key));
    expect(decryptToken(stored, [key])).toBe('xoxb-secret');
  });

  it('v2 selects correct key by kid even with multiple candidate keys', () => {
    const [a, b, c] = [k(), k(), k()];
    expect(decryptToken(encryptToken('t', b), [a, b, c])).toBe('t');
  });

  it('v2 missing matching kid throws descriptive error containing kid', () => {
    const stored = encryptToken('t', k());
    expect(() => decryptToken(stored, [k()])).toThrow(/kid=/);
  });

  it('needsRotation returns false for current key and true for mismatched/legacy formats', () => {
    const [a, b] = [k(), k()];
    expect(needsRotation(encryptToken('t', a), a)).toBe(false);
    expect(needsRotation(encryptToken('t', a), b)).toBe(true);
    expect(needsRotation('v1:x:y:z', a)).toBe(true);
    expect(needsRotation('rác', a)).toBe(true);
  });
});