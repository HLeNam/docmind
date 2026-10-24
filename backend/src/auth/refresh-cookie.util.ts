// Refresh token nằm trong cookie HttpOnly (JS trong trang không đọc được -> XSS không lấy cắp được token dài hạn).
// - Path mặc định "/auth": trình duyệt chỉ gửi cookie này kèm các request /auth/* (refresh, logout), không kèm mọi API.
//   Đặt sau reverse proxy có tiền tố (vd /api) thì PHẢI đổi AUTH_COOKIE_PATH=/api/auth, nếu không cookie không được gửi.
// - SameSite=Lax + kiểm tra Origin ở refresh/logout (xem AuthController) chống CSRF.
type Env = Record<string, string | undefined>;

export const REFRESH_COOKIE_NAME = 'refresh_token';
const DEFAULT_MAX_AGE_DAYS = 30; // đặt >= thời hạn refresh token thật; token hết hạn phía server thì vẫn bị từ chối
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RefreshCookieSettings {
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAgeMs: number;
  /** Chỉ cho client không phải trình duyệt / test: trả thêm refreshToken trong body JSON (mặc định TẮT). */
  inBody: boolean;
}

export function resolveRefreshCookieSettings(env: Env): RefreshCookieSettings {
  const sameSiteRaw = (env.AUTH_COOKIE_SAMESITE ?? 'lax').toLowerCase();
  const sameSite =
    sameSiteRaw === 'strict' || sameSiteRaw === 'none' ? sameSiteRaw : 'lax';
  const secureDefault = env.NODE_ENV === 'production';
  // SameSite=None bị trình duyệt từ chối nếu thiếu Secure -> ép secure.
  const secure =
    sameSite === 'none'
      ? true
      : env.AUTH_COOKIE_SECURE
        ? env.AUTH_COOKIE_SECURE === 'true'
        : secureDefault;
  const days = Number(env.AUTH_REFRESH_COOKIE_MAX_AGE_DAYS);
  return {
    secure,
    sameSite,
    path: env.AUTH_COOKIE_PATH?.trim() || '/auth',
    maxAgeMs:
      (Number.isFinite(days) && days > 0 ? days : DEFAULT_MAX_AGE_DAYS) *
      DAY_MS,
    inBody: env.AUTH_REFRESH_TOKEN_IN_BODY === 'true',
  };
}

export function refreshCookieOptions(s: RefreshCookieSettings) {
  return {
    httpOnly: true,
    secure: s.secure,
    sameSite: s.sameSite,
    path: s.path,
    maxAge: s.maxAgeMs,
  } as const;
}

/** Xoá cookie: phải trùng path/secure/sameSite với lúc đặt thì trình duyệt mới xoá đúng cookie. */
export function clearRefreshCookieOptions(s: RefreshCookieSettings) {
  return {
    httpOnly: true,
    secure: s.secure,
    sameSite: s.sameSite,
    path: s.path,
  } as const;
}

/** Đọc cookie `refresh_token` từ header `Cookie` (không cần cookie-parser). */
export function readRefreshCookie(
  cookieHeader: string | undefined,
): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== REFRESH_COOKIE_NAME) continue;
    const raw = part.slice(eq + 1).trim();
    if (!raw) return undefined;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

export function isTokenPair(
  data: unknown,
): data is { accessToken: string; refreshToken: string } {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as Record<string, unknown>).accessToken === 'string' &&
    typeof (data as Record<string, unknown>).refreshToken === 'string'
  );
}
