// Tải sẵn dữ liệu ngôn ngữ OCR (eng + vie) để production không phải gọi CDN lúc chạy.
// Dùng ĐÚNG bản mà tesseract.js tự tải mặc định (gói @tesseract.js-data, 4.0.0_best_int, đã gzip).
//
//   node scripts/download-tessdata.mjs [thư-mục-đích]     (mặc định: ./tessdata)
//   TESSDATA_BASE_URL=https://mirror.example/tessdata node scripts/download-tessdata.mjs ./tessdata
//
// Sau đó đặt OCR_LANG_PATH=<thư-mục-đích> cho app. Bỏ qua file đã có (chạy lại an toàn).
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const LANGS = ['eng', 'vie'];
const VERSION = '4.0.0_best_int';
const dest = resolve(process.argv[2] ?? 'tessdata');
const baseOverride = process.env.TESSDATA_BASE_URL?.replace(/\/+$/, '');

const urlFor = (lang) =>
  baseOverride
    ? `${baseOverride}/${lang}.traineddata.gz`
    : `https://cdn.jsdelivr.net/npm/@tesseract.js-data/${lang}/${VERSION}/${lang}.traineddata.gz`;

const exists = (p) =>
  stat(p).then(
    (s) => s.size > 0,
    () => false,
  );

await mkdir(dest, { recursive: true });

let failed = false;
for (const lang of LANGS) {
  const file = join(dest, `${lang}.traineddata.gz`);
  if (await exists(file)) {
    console.log(`= ${lang}: already exists, skipping (${file})`);
    continue;
  }
  const url = urlFor(lang);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    // File .gz hợp lệ bắt đầu bằng 0x1f 0x8b — tránh lưu nhầm trang lỗi HTML.
    if (buf.length < 1024 || buf[0] !== 0x1f || buf[1] !== 0x8b)
      throw new Error('Content is not a valid gzip file');
    const tmp = `${file}.part`;
    await writeFile(tmp, buf);
    await rename(tmp, file); // ghi nguyên tử: không để lại file dở nếu bị ngắt giữa chừng
    console.log(
      `+ ${lang}: ${(buf.length / 1024 / 1024).toFixed(1)} MB -> ${file}`,
    );
  } catch (err) {
    failed = true;
    console.error(`! ${lang}: failed to download ${url}: ${err.message}`);
  }
}

if (failed) {
  console.error(
    '\nSome files failed to download. Check network/proxy, or set TESSDATA_BASE_URL to an internal mirror.',
  );
  process.exit(1);
}
console.log(`\nDone. Set OCR_LANG_PATH=${dest}`);
