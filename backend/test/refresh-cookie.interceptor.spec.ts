import { describe, expect, it, vi } from 'vitest';
import { lastValueFrom, of } from 'rxjs';
import { RefreshCookieInterceptor } from '../src/auth/refresh-cookie.interceptor.js';

function run(data: unknown, env: Record<string, string> = {}) {
  const res = { cookie: vi.fn() };
  const ctx = { switchToHttp: () => ({ getResponse: () => res }) } as any;
  const config = { get: (k: string) => env[k] } as any;
  const out = lastValueFrom(
    new RefreshCookieInterceptor(config).intercept(ctx, {
      handle: () => of(data),
    }),
  );
  return { res, out };
}

describe('RefreshCookieInterceptor', () => {
  it('sets refreshToken in HttpOnly cookie and removes it from body, keeping accessToken', async () => {
    const { res, out } = run({ accessToken: 'AT', refreshToken: 'RT' });
    expect(await out).toEqual({ accessToken: 'AT' });
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'RT',
      expect.objectContaining({
        httpOnly: true,
        path: '/auth',
        sameSite: 'lax',
      }),
    );
  });

  it('sets cookie and keeps refreshToken in body when AUTH_REFRESH_TOKEN_IN_BODY=true', async () => {
    const { res, out } = run(
      { accessToken: 'AT', refreshToken: 'RT' },
      { AUTH_REFRESH_TOKEN_IN_BODY: 'true' },
    );
    expect(await out).toEqual({ accessToken: 'AT', refreshToken: 'RT' });
    expect(res.cookie).toHaveBeenCalledTimes(1);
  });

  it('uses path and secure flag from configuration', async () => {
    const { res, out } = run(
      { accessToken: 'AT', refreshToken: 'RT' },
      { AUTH_COOKIE_PATH: '/api/auth', AUTH_COOKIE_SECURE: 'true' },
    );
    await out;
    expect(res.cookie).toHaveBeenCalledWith(
      'refresh_token',
      'RT',
      expect.objectContaining({ path: '/api/auth', secure: true }),
    );
  });

  it('does not set cookie or alter body when response is not a token pair', async () => {
    const pick = {
      requiresTenantSelection: true,
      tenants: [{ tenantId: 't', role: 'OWNER' }],
    };
    const a = run(pick);
    expect(await a.out).toBe(pick);
    expect(a.res.cookie).not.toHaveBeenCalled();

    const b = run(undefined);
    expect(await b.out).toBeUndefined();
    expect(b.res.cookie).not.toHaveBeenCalled();
  });
});
