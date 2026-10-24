import { describe, expect, it } from 'vitest';
import {
  CORS_EXPOSED_HEADERS,
  buildCorsOptions,
  isOriginAllowed,
  normalizeOrigin,
  parseOrigins,
  resolveAllowedOrigins,
} from '../src/common/cors.util.js';

describe('normalizeOrigin / parseOrigins', () => {
  it('strips path and trailing slash, lowercases, and ignores non-URL strings', () => {
    expect(normalizeOrigin('HTTP://Localhost:5173/')).toBe(
      'http://localhost:5173',
    );
    expect(normalizeOrigin('https://app.example.com/login?x=1')).toBe(
      'https://app.example.com',
    );
    expect(normalizeOrigin('khong-phai-url')).toBeNull();
  });

  it('splits by comma, trims whitespace, removes empty and duplicate elements', () => {
    expect(
      parseOrigins(' http://a.com , ,http://b.com/, http://a.com '),
    ).toEqual(['http://a.com', 'http://b.com']);
    expect(parseOrigins(undefined)).toEqual([]);
    expect(parseOrigins('')).toEqual([]);
  });
});

describe('resolveAllowedOrigins', () => {
  it('prefers CORS_ORIGINS over FRONTEND_URL, falls back to empty array', () => {
    expect(
      resolveAllowedOrigins({
        CORS_ORIGINS: 'https://x.com',
        FRONTEND_URL: 'https://y.com',
      }),
    ).toEqual(['https://x.com']);
    expect(
      resolveAllowedOrigins({ FRONTEND_URL: 'http://localhost:5173/' }),
    ).toEqual(['http://localhost:5173']);
    expect(resolveAllowedOrigins({})).toEqual([]);
  });
});

describe('isOriginAllowed', () => {
  const allowed = ['http://localhost:5173'];
  it('allows requests without Origin or when allowlist is unconfigured', () => {
    expect(isOriginAllowed(undefined, allowed)).toBe(true);
    expect(isOriginAllowed('http://evil.com', [])).toBe(true);
  });
  it('allows only listed origins matching normalized form', () => {
    expect(isOriginAllowed('http://localhost:5173', allowed)).toBe(true);
    expect(isOriginAllowed('http://LOCALHOST:5173', allowed)).toBe(true);
    expect(isOriginAllowed('http://localhost:3000', allowed)).toBe(false);
    expect(isOriginAllowed('https://evil.com', allowed)).toBe(false);
    expect(isOriginAllowed('null', allowed)).toBe(false);
  });
});

describe('buildCorsOptions', () => {
  it('configures specific origins, credentials, and exposed rate limit headers', () => {
    const opts = buildCorsOptions({ CORS_ORIGINS: 'http://localhost:5173' });
    expect(opts.origin).toEqual(['http://localhost:5173']);
    expect(opts.credentials).toBe(true);
    expect(opts.exposedHeaders).toEqual(CORS_EXPOSED_HEADERS);
    expect(CORS_EXPOSED_HEADERS).toContain('Retry-After');
  });
  it('disables CORS (origin false) when unconfigured, never defaults to wildcard', () => {
    expect(buildCorsOptions({}).origin).toBe(false);
  });
});
