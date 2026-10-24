// Sinh + hash API key. Tách riêng thành util để ApiKeyGuard (bước 4.2) dùng LẠI đúng hàm hashApiKey()
// — hash lúc tạo và hash lúc tra cứu BẮT BUỘC cùng thuật toán, tách 2 nơi tự viết dễ lệch nhau.
//
// Định dạng key: "dm_live_" + 32 ký tự base64url (24 byte ngẫu nhiên = 192 bit entropy).
// - Prefix "dm_live_" giúp nhận diện key của DocMind (secret scanning của GitHub, grep log...).
// - KHÔNG dùng argon2/bcrypt như password: key đã là chuỗi ngẫu nhiên entropy cao, không phải thứ
//   người dùng tự đặt nên không cần hash chậm để chống brute-force; SHA-256 đủ, và quan trọng hơn là
//   mỗi request /v1/query phải hash + tra DB 1 lần — hash chậm sẽ làm mọi request chậm theo.
//   (Cùng lý do RefreshToken ở Phase 1 cũng dùng SHA-256.)
import { createHash, randomBytes } from 'node:crypto';

export const API_KEY_PREFIX = 'dm_live_';
// "dm_live_" (8 ký tự) + 4 ký tự đầu của phần ngẫu nhiên, ví dụ "dm_live_ab12" — khớp ví dụ trong
// comment của model ApiKey.keyPrefix. Chỉ để user nhận diện key trong danh sách, KHÔNG đủ để đoán key.
const DISPLAY_PREFIX_LENGTH = API_KEY_PREFIX.length + 4;

export interface GeneratedApiKey {
  /** Key gốc — chỉ tồn tại trong bộ nhớ lúc tạo, trả cho user ĐÚNG 1 LẦN, không bao giờ lưu DB. */
  raw: string;
  keyHash: string;
  keyPrefix: string;
}

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function generateApiKey(): GeneratedApiKey {
  const raw = `${API_KEY_PREFIX}${randomBytes(24).toString('base64url')}`;
  return {
    raw,
    keyHash: hashApiKey(raw),
    keyPrefix: raw.slice(0, DISPLAY_PREFIX_LENGTH),
  };
}

/** Kiểm tra nhanh hình dạng key trước khi tốn 1 lần tra DB (dùng ở ApiKeyGuard, bước 4.2). */
export function looksLikeApiKey(value: string): boolean {
  return (
    value.startsWith(API_KEY_PREFIX) && value.length > DISPLAY_PREFIX_LENGTH
  );
}
