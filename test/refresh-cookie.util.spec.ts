import { describe, expect, it } from 'vitest';
import {
  clearRefreshCookieOptions,
  isTokenPair,
  readRefreshCookie,
  refreshCookieOptions,
  resolveRefreshCookieSettings,
} from '../src/auth/refresh-cookie.util.js';

describe('resolveRefreshCookieSettings', () => {
  it('defaults to lax, path /auth, 30 days, token omitted from body, secure only in production', () => {
    const dev = resolveRefreshCookieSettings({});
    expect(dev).toEqual({
      secure: false,
      sameSite: 'lax',
      path: '/auth',
      maxAgeMs: 30 * 86_400_000,
      inBody: false,
    });
    expect(
      resolveRefreshCookieSettings({ NODE_ENV: 'production' }).secure,
    ).toBe(true);
  });

  it('supports custom path (e.g. reverse proxy /api), samesite, maxAge, and secure', () => {
    const s = resolveRefreshCookieSettings({
      AUTH_COOKIE_PATH: '/api/auth',
      AUTH_COOKIE_SAMESITE: 'STRICT',
      AUTH_REFRESH_COOKIE_MAX_AGE_DAYS: '7',
      AUTH_COOKIE_SECURE: 'true',
      AUTH_REFRESH_TOKEN_IN_BODY: 'true',
    });
    expect(s).toEqual({
      secure: true,
      sameSite: 'strict',
      path: '/api/auth',
      maxAgeMs: 7 * 86_400_000,
      inBody: true,
    });
  });

  it('enforces Secure on SameSite=None, falls back to lax on invalid value, uses default on invalid days', () => {
    expect(
      resolveRefreshCookieSettings({
        AUTH_COOKIE_SAMESITE: 'none',
        AUTH_COOKIE_SECURE: 'false',
      }),
    ).toMatchObject({
      sameSite: 'none',
      secure: true,
    });
    expect(
      resolveRefreshCookieSettings({ AUTH_COOKIE_SAMESITE: 'abc' }).sameSite,
    ).toBe('lax');
    expect(
      resolveRefreshCookieSettings({ AUTH_REFRESH_COOKIE_MAX_AGE_DAYS: '-3' })
        .maxAgeMs,
    ).toBe(30 * 86_400_000);
  });
});

describe('cookie options', () => {
  const s = resolveRefreshCookieSettings({});
  it('always sets HttpOnly; clear options use same path and samesite without maxAge', () => {
    expect(refreshCookieOptions(s)).toMatchObject({
      httpOnly: true,
      path: '/auth',
      sameSite: 'lax',
      maxAge: s.maxAgeMs,
    });
    const clear = clearRefreshCookieOptions(s) as Record<string, unknown>;
    expect(clear).toMatchObject({
      httpOnly: true,
      path: '/auth',
      sameSite: 'lax',
    });
    expect(clear.maxAge).toBeUndefined();
  });
});

describe('readRefreshCookie', () => {
  it('reads correct cookie from multi-cookie header and decodes percent-encoding', () => {
    expect(readRefreshCookie('a=1; refresh_token=abc.def-123; b=2')).toBe(
      'abc.def-123',
    );
    expect(readRefreshCookie('refresh_token=a%2Bb%3D')).toBe('a+b=');
  });
  it('returns undefined when missing, empty, or similar name', () => {
    expect(readRefreshCookie(undefined)).toBeUndefined();
    expect(readRefreshCookie('')).toBeUndefined();
    expect(readRefreshCookie('refresh_token=')).toBeUndefined();
    expect(
      readRefreshCookie('my_refresh_token=x; refresh_token_old=y'),
    ).toBeUndefined();
  });
});

describe('isTokenPair', () => {
  it('identifies objects containing string accessToken and refreshToken', () => {
    expect(isTokenPair({ accessToken: 'a', refreshToken: 'r' })).toBe(true);
    expect(isTokenPair({ accessToken: 'a' })).toBe(false);
    expect(isTokenPair({ requiresTenantSelection: true, tenants: [] })).toBe(
      false,
    );
    expect(isTokenPair(null)).toBe(false);
    expect(isTokenPair('x')).toBe(false);
  });
});
