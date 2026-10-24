// scripts/rotate-slack-tokens.mjs — mã hoá lại mọi token Slack đã lưu bằng khoá HIỆN TẠI.
//
// Chạy (từ thư mục gốc repo, đã có .env):
//   node --env-file=.env scripts/rotate-slack-tokens.mjs            # dry-run: chỉ báo cáo, KHÔNG ghi DB
//   node --env-file=.env scripts/rotate-slack-tokens.mjs --apply    # ghi thật
//
// Cần: SLACK_TOKEN_ENCRYPTION_KEY (khoá mới), SLACK_TOKEN_ENCRYPTION_KEYS_OLD (khoá cũ, cách nhau dấu
// phẩy) và một chuỗi kết nối DB. Ưu tiên ROTATE_DATABASE_URL, rồi SYSTEM_DATABASE_URL, rồi DATABASE_URL.
// Cần package `pg` (thường đã có sẵn qua Prisma adapter; nếu không: npm i -D pg).
//
// An toàn:
// - Mặc định dry-run. Không bao giờ in token ra màn hình.
// - Với mỗi dòng: giải mã bằng (khoá mới + khoá cũ) -> mã hoá bằng khoá mới -> giải mã thử bằng RIÊNG khoá
//   mới và so với bản gốc -> mới UPDATE. Bất kỳ bước nào lỗi thì giữ nguyên dòng đó.
// - UPDATE có điều kiện `access_token = <giá trị đã đọc>`: nếu giữa chừng có ai cài lại app (token đổi)
//   thì dòng đó bị bỏ qua thay vì bị ghi đè bằng token cũ.
// - Chạy lại bao nhiêu lần cũng được (dòng đã ở khoá mới thì bỏ qua).
// Định dạng phải khớp src/slack/slack-token-crypto.util.ts.
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { pathToFileURL } from 'node:url';

const CURRENT_VERSION = 'v2';
const LEGACY_VERSION = 'v1';

export function parseKey(raw) {
  const key = Buffer.from(String(raw).trim(), 'base64');
  if (key.length !== 32)
    throw new Error('Key must be a base64-encoded 32-byte key');
  return key;
}

export function parseKeyList(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseKey);
}

export const keyId = (key) =>
  createHash('sha256').update(key).digest('hex').slice(0, 8);

export function encryptToken(plaintext, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [
    CURRENT_VERSION,
    keyId(key),
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    enc.toString('base64'),
  ].join(':');
}

function decryptWithKey(key, iv, tag, data) {
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    d.update(Buffer.from(data, 'base64')),
    d.final(),
  ]).toString('utf8');
}

export function decryptToken(stored, keys) {
  const parts = stored.split(':');
  if (parts[0] === CURRENT_VERSION && parts.length === 5) {
    const [, kid, iv, tag, data] = parts;
    const key = keys.find((k) => keyId(k) === kid);
    if (!key) throw new Error(`No encryption key matches kid=${kid}`);
    return decryptWithKey(key, iv, tag, data);
  }
  if (parts[0] === LEGACY_VERSION && parts.length === 4) {
    const [, iv, tag, data] = parts;
    let last;
    for (const key of keys) {
      try {
        return decryptWithKey(key, iv, tag, data);
      } catch (e) {
        last = e;
      }
    }
    throw last ?? new Error('No key can decrypt this v1 token');
  }
  throw new Error('Unsupported encrypted token format');
}

export const needsRotation = (stored, currentKey) => {
  const p = stored.split(':');
  return !(
    p[0] === CURRENT_VERSION &&
    p.length === 5 &&
    p[1] === keyId(currentKey)
  );
};

/** Trả { status: 'ok'|'skipped', value } hoặc throw. Thuần, không đụng DB. */
export function rotateValue(stored, currentKey, oldKeys) {
  if (!needsRotation(stored, currentKey))
    return { status: 'skipped', value: stored };
  const plaintext = decryptToken(stored, [currentKey, ...oldKeys]);
  const rotated = encryptToken(plaintext, currentKey);
  if (decryptToken(rotated, [currentKey]) !== plaintext)
    throw new Error('Verification decryption failed');
  return { status: 'ok', value: rotated };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const url =
    process.env.ROTATE_DATABASE_URL ??
    process.env.SYSTEM_DATABASE_URL ??
    process.env.DATABASE_URL;
  if (!url)
    throw new Error(
      'Missing ROTATE_DATABASE_URL / SYSTEM_DATABASE_URL / DATABASE_URL',
    );
  if (!process.env.SLACK_TOKEN_ENCRYPTION_KEY)
    throw new Error('Missing SLACK_TOKEN_ENCRYPTION_KEY');

  const currentKey = parseKey(process.env.SLACK_TOKEN_ENCRYPTION_KEY);
  const oldKeys = parseKeyList(process.env.SLACK_TOKEN_ENCRYPTION_KEYS_OLD);
  console.log(
    `Mode: ${apply ? 'APPLY (writing to DB)' : 'DRY-RUN (read-only)'} · new key kid=${keyId(currentKey)} · ${oldKeys.length} old key(s)`,
  );

  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const counts = { total: 0, skipped: 0, rotated: 0, failed: 0, conflict: 0 };
  try {
    const { rows } = await client.query(
      'select slack_team_id, access_token from slack_integrations order by slack_team_id',
    );
    counts.total = rows.length;
    if (rows.length === 0) {
      console.log(
        'No rows found in slack_integrations. If the table has data, the current role may be blocked by RLS — set ROTATE_DATABASE_URL pointing to an RLS bypass role.',
      );
    }
    for (const row of rows) {
      const team = row.slack_team_id;
      try {
        const result = rotateValue(row.access_token, currentKey, oldKeys);
        if (result.status === 'skipped') {
          counts.skipped++;
          console.log(`  = ${team}: already using current key, skipping`);
          continue;
        }
        if (!apply) {
          counts.rotated++;
          console.log(`  ~ ${team}: will re-encrypt (dry-run)`);
          continue;
        }
        const upd = await client.query(
          'update slack_integrations set access_token = $1 where slack_team_id = $2 and access_token = $3',
          [result.value, team, row.access_token],
        );
        if (upd.rowCount === 1) {
          counts.rotated++;
          console.log(`  ✓ ${team}: re-encrypted successfully`);
        } else {
          counts.conflict++;
          console.log(
            `  ! ${team}: token changed concurrently (or no write permission), skipping — re-run script`,
          );
        }
      } catch (err) {
        counts.failed++;
        console.log(`  ✗ ${team}: ${err.message}`);
      }
    }
  } finally {
    await client.end();
  }

  console.log(
    `\nTotal ${counts.total}: ${apply ? 'rotated' : 'would rotate'} ${counts.rotated}, skipped ${counts.skipped}, conflict ${counts.conflict}, failed ${counts.failed}`,
  );
  if (counts.failed > 0 || counts.conflict > 0) {
    console.log(
      'Some rows are not yet rotated. DO NOT remove old keys from SLACK_TOKEN_ENCRYPTION_KEYS_OLD until the script reports 0 failures and 0 conflicts.',
    );
    process.exitCode = 1;
  } else if (apply) {
    console.log(
      'Done. You may remove old keys from SLACK_TOKEN_ENCRYPTION_KEYS_OLD after verifying Slack integration works.',
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}
