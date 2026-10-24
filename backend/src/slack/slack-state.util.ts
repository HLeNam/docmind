// Tham số `state` của OAuth Slack: vừa chống CSRF (kẻ tấn công không thể tự tạo state hợp lệ để lừa
// admin nối workspace của họ vào tenant nạn nhân), vừa cho callback biết request thuộc TENANT nào —
// callback là redirect từ trình duyệt nên KHÔNG có JWT.
//
// Tự ký bằng HMAC thay vì dùng JwtService: nếu ký state bằng JWT_SECRET thì state (nằm trên URL, dễ lộ
// qua history/log) có thể bị JwtStrategy chấp nhận như 1 access token. Ở đây dùng SLACK_CLIENT_SECRET
// làm khoá và tiền tố riêng, nên state vô dụng ở bất kỳ chỗ nào khác.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SLACK_STATE_TTL_MS = 10 * 60 * 1000;

export interface SlackStatePayload {
  tenantId: string;
  exp: number; // epoch ms
  nonce: string;
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`slack-state:${body}`)
    .digest('base64url');
}

export function signSlackState(
  tenantId: string,
  secret: string,
  now: number = Date.now(),
): string {
  const payload: SlackStatePayload = {
    tenantId,
    exp: now + SLACK_STATE_TTL_MS,
    nonce: randomBytes(8).toString('hex'),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body, secret)}`;
}

/** Trả payload nếu state hợp lệ (đúng chữ ký, chưa hết hạn), ngược lại null — không phân biệt lý do. */
export function verifySlackState(
  state: string,
  secret: string,
  now: number = Date.now(),
): SlackStatePayload | null {
  const parts = state.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts as [string, string];

  const expected = Buffer.from(sign(body, secret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as Partial<SlackStatePayload>;
    if (typeof payload.tenantId !== 'string' || typeof payload.exp !== 'number')
      return null;
    if (payload.exp <= now) return null;
    return payload as SlackStatePayload;
  } catch {
    return null;
  }
}
