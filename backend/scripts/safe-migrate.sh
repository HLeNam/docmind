#!/usr/bin/env bash
# scripts/safe-migrate.sh — wrapper an toàn quanh `prisma migrate dev`
#
# Vấn đề (đã ghi ở docmind-phase1-implementation.md mục 2.5): `prisma migrate dev` tự diff
# schema.prisma với DB rồi sinh migration để "khớp" 2 bên. Vì các object tạo tay — HNSW index,
# tsvector index, mọi RLS policy, role docmind_app/docmind_system — KHÔNG có khai báo tương ứng
# trong schema.prisma, Prisma coi chúng là thừa và tự sinh DROP INDEX/DROP POLICY/DROP ROLE mỗi
# khi bạn sửa schema rồi migrate. Đây là giới hạn đã xác nhận của Prisma, không tự hết.
#
# Script này thay quy trình thủ công "nhớ làm 3 bước mỗi lần" bằng 1 lệnh:
#   1. migrate dev --create-only (sinh migration, KHÔNG apply)
#   2. quét file .sql vừa sinh, tìm DROP INDEX/POLICY/ROLE nhắm vào object tạo tay
#   3a. nếu thấy nguy hiểm -> DỪNG LẠI, in rõ dòng nào cần xoá, không tự ý apply
#   3b. nếu sạch -> tự động apply luôn, không cần chạy lệnh thứ 2
#
# Cách dùng:
#   bash scripts/safe-migrate.sh <ten_migration>
#       -> sinh + quét. Nếu sạch thì apply luôn. Nếu nguy hiểm thì dừng và hướng dẫn.
#
#   bash scripts/safe-migrate.sh <ten_migration> --apply
#       -> dùng SAU KHI đã tự tay mở file .sql và xoá các dòng DROP nguy hiểm, giờ mới apply.
#
# Cập nhật PROTECTED_PATTERNS bên dưới nếu sau này bạn thêm index/policy/role tạo tay mới.

set -euo pipefail

MIGRATION_NAME="${1:-}"
APPLY_FLAG="${2:-}"

if [[ -z "$MIGRATION_NAME" ]]; then
  echo "Usage: bash scripts/safe-migrate.sh <migration_name> [--apply]"
  exit 1
fi

# Danh sách object tạo tay cần bảo vệ khỏi bị Prisma tự xoá.
PROTECTED_PATTERNS=(
  "document_chunk_embedding_hnsw_idx"
  "document_chunk_content_tsv_idx"
  "docmind_app"
  "docmind_system"
)

if [[ "$APPLY_FLAG" == "--apply" ]]; then
  echo ">> Applying manually reviewed migration for '$MIGRATION_NAME'..."
  npx prisma migrate dev
  echo "✅ Applied."
  exit 0
fi

echo ">> Generating migration '$MIGRATION_NAME' (create-only — NOT applied yet)..."
npx prisma migrate dev --create-only --name "$MIGRATION_NAME"

LATEST_DIR=$(find prisma/migrations -maxdepth 1 -type d -name "*_${MIGRATION_NAME}" | sort | tail -n 1)
SQL_FILE="${LATEST_DIR}/migration.sql"

if [[ ! -f "$SQL_FILE" ]]; then
  echo "!! Could not find the newly generated migration file: $SQL_FILE"
  echo "   (Prisma might not have found any changes between the schema and DB — check schema.prisma.)"
  exit 1
fi

echo ">> Scanning $SQL_FILE for DROP INDEX / DROP POLICY / DROP ROLE targeting manually created objects..."
FOUND_DANGER=0

# Mọi DROP POLICY luôn đáng ngờ (toàn bộ policy trong hệ thống đều là tenant_isolation, tạo tay 100%)
if grep -inE "DROP POLICY" "$SQL_FILE" >/dev/null 2>&1; then
  echo ""
  echo "⚠️  Found DROP POLICY (all RLS policies in the system are manually created, not managed by Prisma):"
  grep -inE "DROP POLICY" "$SQL_FILE"
  FOUND_DANGER=1
fi

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if grep -inE "DROP (INDEX|ROLE)[^;]*${pattern}" "$SQL_FILE" >/dev/null 2>&1; then
    echo ""
    echo "⚠️  Found line targeting manually created object ('${pattern}'):"
    grep -inE "DROP (INDEX|ROLE)[^;]*${pattern}" "$SQL_FILE"
    FOUND_DANGER=1
  fi
done

if [[ "$FOUND_DANGER" -eq 1 ]]; then
  echo ""
  echo "🛑 STOP — Prisma just proposed dropping the manually created objects above (pgvector/tsvector index,"
  echo "   RLS policy, or docmind_app/docmind_system role)."
  echo ""
  echo "   Next steps:"
  echo "   1. Open file: $SQL_FILE"
  echo "   2. Manually delete the DROP lines mentioned above (keep the rest if there are other valid changes)"
  echo "   3. Run again: bash scripts/safe-migrate.sh $MIGRATION_NAME --apply"
  echo ""
  exit 1
else
  echo "✅ No DROP statements targeting manually created objects found — safe to apply."
  echo ">> Applying..."
  npx prisma migrate dev
  echo "✅ Applied migration '$MIGRATION_NAME'."
fi