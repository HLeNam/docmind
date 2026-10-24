// Danh sách origin được phép (CORS + kiểm tra Origin ở các route dùng cookie). Một nguồn duy nhất cho cả hai chỗ.
// Nguồn cấu hình: CORS_ORIGINS (danh sách cách nhau dấu phẩy); không đặt thì lấy FRONTEND_URL (đã dùng để dựng link mời
// trong email). Cả hai đều không có -> danh sách rỗng: KHÔNG bật CORS (phù hợp mô hình cùng origin qua reverse proxy).
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface.js';

type Env = Record<string, string | undefined>;

/** "http://localhost:5173/" -> "http://localhost:5173"; chuỗi không phải URL hợp lệ bị bỏ qua. */
export function normalizeOrigin(raw: string): string | null {
  try {
    return new URL(raw.trim()).origin.toLowerCase();
  } catch {
    return null;
  }
}

export function parseOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  const origins = raw
    .split(',')
    .map(normalizeOrigin)
    .filter((o): o is string => o !== null);
  return [...new Set(origins)];
}

export function resolveAllowedOrigins(env: Env): string[] {
  const fromCors = parseOrigins(env.CORS_ORIGINS);
  return fromCors.length > 0 ? fromCors : parseOrigins(env.FRONTEND_URL);
}

/**
 * Không có header Origin (curl, server-to-server, request cùng origin của một số trình duyệt) hoặc chưa cấu hình danh
 * sách -> cho qua. Có Origin mà không nằm trong danh sách -> từ chối.
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowed: string[],
): boolean {
  if (!origin || allowed.length === 0) return true;
  const normalized = normalizeOrigin(origin);
  return normalized !== null && allowed.includes(normalized);
}

// Các header frontend cần đọc được qua CORS (hạn mức rate limit + thời gian chờ khi bị 429).
export const CORS_EXPOSED_HEADERS = [
  'X-RateLimit-Limit',
  'X-RateLimit-Remaining',
  'X-RateLimit-Reset',
  'Retry-After',
];

/** Dùng trong main.ts: app.enableCors(buildCorsOptions(process.env)). */
export function buildCorsOptions(env: Env): CorsOptions {
  const origins = resolveAllowedOrigins(env);
  return {
    // credentials: true KHÔNG đi cùng '*' -> luôn liệt kê origin cụ thể. Rỗng -> tắt CORS.
    origin: origins.length > 0 ? origins : false,
    credentials: true,
    exposedHeaders: CORS_EXPOSED_HEADERS,
    maxAge: 600,
  };
}
