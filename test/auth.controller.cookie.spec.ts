import { describe, expect, it, vi } from 'vitest';
import { AuthController } from '../src/auth/auth.controller.js';
import { ForbiddenAppException } from '../src/common/exceptions/app.exception.js';

function build(env: Record<string, string> = {}) {
  const auth = {
    refresh: vi.fn(async (..._a: any[]) => ({
      accessToken: 'AT2',
      refreshToken: 'RT2',
    })),
    logout: vi.fn(async (..._a: any[]) => undefined),
  };
  const config = { get: (k: string) => env[k] } as any;
  return { auth, controller: new AuthController(auth as any, config) };
}

const req = (headers: Record<string, string> = {}) =>
  ({ headers, ip: '1.2.3.4' }) as any;

describe('AuthController.refresh', () => {
  it('browser flow: empty body, extracts token from cookie', async () => {
    const { auth, controller } = build();
    await controller.refresh(
      {},
      req({ cookie: 'x=1; refresh_token=COOKIE_RT' }),
    );
    expect(auth.refresh).toHaveBeenCalledWith(
      'COOKIE_RT',
      expect.objectContaining({ ipAddress: '1.2.3.4' }),
    );
  });

  it('prefers body over cookie for non-browser clients and Swagger', async () => {
    const { auth, controller } = build();
    await controller.refresh(
      { refreshToken: 'BODY_RT' },
      req({ cookie: 'refresh_token=COOKIE_RT' }),
    );
    expect(auth.refresh).toHaveBeenCalledWith('BODY_RT', expect.anything());
  });

  it('passes empty string when both are missing so service rejects with invalid token error', async () => {
    const { auth, controller } = build();
    await controller.refresh({}, req());
    expect(auth.refresh).toHaveBeenCalledWith('', expect.anything());
  });

  it('throws 403 and does not call service when Origin is not allowed', async () => {
    const { auth, controller } = build({
      CORS_ORIGINS: 'http://localhost:5173',
    });
    expect(() =>
      controller.refresh(
        {},
        req({ origin: 'https://evil.com', cookie: 'refresh_token=RT' }),
      ),
    ).toThrow(ForbiddenAppException);
    expect(auth.refresh).not.toHaveBeenCalled();
  });

  it('allows valid Origin, missing Origin, or unconfigured allowlist', async () => {
    const ok = build({ FRONTEND_URL: 'http://localhost:5173/' });
    await ok.controller.refresh(
      {},
      req({ origin: 'http://localhost:5173', cookie: 'refresh_token=RT' }),
    );
    await ok.controller.refresh({}, req({ cookie: 'refresh_token=RT' }));
    expect(ok.auth.refresh).toHaveBeenCalledTimes(2);

    const open = build();
    await open.controller.refresh(
      {},
      req({ origin: 'https://anything.com', cookie: 'refresh_token=RT' }),
    );
    expect(open.auth.refresh).toHaveBeenCalledTimes(1);
  });
});

describe('AuthController.logout', () => {
  const res = () => ({ clearCookie: vi.fn() }) as any;

  it('revokes token from cookie and clears cookie with correct path', async () => {
    const { auth, controller } = build({ AUTH_COOKIE_PATH: '/api/auth' });
    const r = res();
    await controller.logout({}, req({ cookie: 'refresh_token=COOKIE_RT' }), r);
    expect(auth.logout).toHaveBeenCalledWith('COOKIE_RT');
    expect(r.clearCookie).toHaveBeenCalledWith(
      'refresh_token',
      expect.objectContaining({ httpOnly: true, path: '/api/auth' }),
    );
  });

  it('clears cookie without calling service and without error when no token present (idempotent)', async () => {
    const { auth, controller } = build();
    const r = res();
    await controller.logout({}, req(), r);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(r.clearCookie).toHaveBeenCalledTimes(1);
  });

  it('throws 403, does not clear cookie or revoke token on disallowed Origin', async () => {
    const { auth, controller } = build({
      CORS_ORIGINS: 'http://localhost:5173',
    });
    const r = res();
    await expect(
      controller.logout(
        {},
        req({ origin: 'https://evil.com', cookie: 'refresh_token=RT' }),
        r,
      ),
    ).rejects.toThrow(ForbiddenAppException);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(r.clearCookie).not.toHaveBeenCalled();
  });
});
