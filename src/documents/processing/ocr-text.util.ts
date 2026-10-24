// Ghép kết quả của NHIỀU lượt OCR trên cùng một ảnh (ảnh gốc + ảnh đảo màu) thành một đoạn text, bỏ dòng trùng/nhiễu.
//
// Vì sao cần nhiều lượt: tesseract đọc tốt chữ tối trên nền sáng; chữ TRẮNG trên nền xanh đậm (header, banner, logo —
// rất hay gặp trong slide) thường bị bỏ sót hoàn toàn ở ảnh gốc. Đo trên slide thật: ảnh gốc chỉ ra 2 dòng giữa slide,
// ảnh đảo màu + chế độ "sparse text" mới đọc thêm được "KHOA CHÍNH TRỊ - HÀNH CHÍNH". Hai lượt cho kết quả bổ sung cho nhau,
// nên ghép lại thay vì chọn 1.

/** Bỏ dấu, chữ thường, chỉ giữ chữ-số — dùng để so khớp dòng giữa các lượt (mỗi lượt có thể sai khác vài ký tự). */
export function normalizeOcrLine(line: string): string {
  return line
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Dòng quá ngắn hoặc phần lớn là ký tự lạ (nhiễu của OCR trên hoạ tiết/logo) -> bỏ. */
export function isNoiseLine(line: string): boolean {
  const compact = line.replace(/\s+/g, '');
  if (compact.length === 0) return true;
  const alnum = compact.replace(/[^\p{L}\p{N}]/gu, '');
  if (alnum.length < 4) return true;
  return alnum.length / compact.length < 0.6;
}

function bigrams(s: string): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    map.set(g, (map.get(g) ?? 0) + 1);
  }
  return map;
}

/** Hệ số Dice trên bigram (0..1): độ giống nhau của 2 chuỗi đã chuẩn hoá. */
export function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let overlap = 0;
  for (const [g, n] of A) overlap += Math.min(n, B.get(g) ?? 0);
  return (2 * overlap) / (a.length - 1 + (b.length - 1));
}

export const OCR_DUPLICATE_SIMILARITY = 0.75;

function isDuplicate(key: string, seen: string[]): boolean {
  return seen.some(
    (other) =>
      other === key ||
      // Dòng nằm trọn trong dòng đã có (vd "KHOA" trong "KHOA CHINH TRI - HANH CHINH") — chỉ tính khi đủ dài
      // để không loại nhầm từ ngắn trùng ngẫu nhiên.
      (key.length >= 4 && other.includes(key)) ||
      diceSimilarity(key, other) >= OCR_DUPLICATE_SIMILARITY,
  );
}

/**
 * Ghép các lượt OCR theo thứ tự ưu tiên: dòng của lượt trước được giữ; lượt sau chỉ bổ sung dòng MỚI. Nếu một dòng mới
 * "bao" trọn dòng đã giữ trước đó (lượt trước chỉ đọc được một nửa dòng, vd "- HANH CHI") thì dòng đầy đủ thay chỗ
 * dòng cụt. Trả chuỗi rỗng nếu không còn dòng hợp lệ nào.
 */
export function mergeOcrPasses(passes: string[]): string {
  const kept: { line: string; key: string }[] = [];
  for (const pass of passes) {
    for (const raw of pass.split(/\r?\n/)) {
      const line = raw.replace(/\s+/g, ' ').trim();
      if (!line || isNoiseLine(line)) continue;
      const key = normalizeOcrLine(line);
      if (key.length === 0) continue;
      if (
        isDuplicate(
          key,
          kept.map((k) => k.key),
        )
      )
        continue;

      // Dòng cụt đã giữ nằm trọn trong dòng mới -> bỏ dòng cụt, giữ dòng đầy đủ (ở vị trí của dòng cụt đầu tiên).
      const truncated = kept
        .map((k, i) => (k.key.length >= 4 && key.includes(k.key) ? i : -1))
        .filter((i) => i >= 0);
      if (truncated.length > 0) {
        kept[truncated[0]!] = { line, key };
        for (const i of truncated.slice(1).reverse()) kept.splice(i, 1);
        continue;
      }
      kept.push({ line, key });
    }
  }
  return kept.map((k) => k.line).join('\n');
}
