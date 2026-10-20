// multer/busboy giải mã tên file multipart bằng latin1 (mặc định), trong khi trình duyệt/curl gửi UTF-8. Tên có dấu tiếng
// Việt vì vậy bị hỏng khi lưu: "TÀI LIỆU" -> "TÃ\u0080I LIá»\u0087U" (hiện trong citation là "TÃI LIá»U HT VÃ…").
// Khôi phục: coi chuỗi như byte latin1, giải mã lại bằng UTF-8.
//
// An toàn với tên đã đúng: chỉ đổi khi (1) mọi ký tự đều ≤ U+00FF (chuỗi có chữ Việt đúng như "à", "ệ" luôn có ký tự > U+00FF
// hoặc ở khối mở rộng nên bị loại), và (2) kết quả giải mã UTF-8 hợp lệ (không sinh U+FFFD). Tên ASCII thuần giữ nguyên.
export function decodeUploadedFilename(name: string): string {
  if (!/[\u0080-ÿ]/.test(name)) return name; // ASCII thuần: không có gì để sửa
  for (const ch of name) {
    if (ch.codePointAt(0)! > 0xff) return name; // đã là Unicode thật (vd tên đúng "Tài liệu") -> giữ nguyên
  }
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('�') ? name : decoded;
}
