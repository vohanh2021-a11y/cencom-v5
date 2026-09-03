#!/usr/bin/env bash
set -euo pipefail

# Backup script - pg_dump database cencom, giữ 7 bản gần nhất
# Dùng biến env PG* hoặc DATABASE_URL

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${PROJECT_DIR}/backups"

# Đọc DATABASE_URL từ env (ưu tiên .env.local)
DATABASE_URL="${DATABASE_URL:-}"
LOCAL_ENV="${PROJECT_DIR}/.env.local"

if [ -z "$DATABASE_URL" ] && [ -f "$LOCAL_ENV" ]; then
  DATABASE_URL=$(grep -E '^DATABASE_URL=' "$LOCAL_ENV" | cut -d= -f2-)
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ Thiếu DATABASE_URL - cung cấp qua env hoặc .env.local"
  exit 1
fi

# Tạo thư mục backup nếu chưa có
mkdir -p "$BACKUP_DIR"

# Tạo filename có timestamp
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/cencom_${DATE}.sql"

echo "📦 Bắt đầu dump database..."
if echo "$DATABASE_URL" | grep -qi "supabase"; then
  # Supabase-style connection
  pg_dump "$DATABASE_URL" --no-owner --no-acl -f "$BACKUP_FILE" 2>/dev/null \
    || pg_dump "$DATABASE_URL" --no-owner --no-acl > "$BACKUP_FILE" 2>/dev/null \
    || { echo "❌ pg_dump thất bại"; exit 1; }
else
  pg_dump "$DATABASE_URL" --no-owner --no-acl > "$BACKUP_FILE" 2>/dev/null \
    || { echo "❌ pg_dump thất bại"; exit 1; }
fi

echo "✅ Đump xong: $BACKUP_FILE"

# Giữ 7 bản gần nhất, xóa cũ hơn
echo "🧹 Dọn dẹp các bản backup cũ..."
COUNT=$(ls -1t "${BACKUP_DIR}"/cencom_*.sql 2>/dev/null | wc -l)
if [ "$COUNT" -gt 7 ]; then
  ls -1t "${BACKUP_DIR}"/cencom_*.sql 2>/dev/null | tail -n +8 | xargs rm -f
  echo "   Đã xóa $((COUNT - 7)) bản backup cũ"
else
  echo "   Chỉ có $COUNT bản backup, không cần xóa"
fi

echo "✅ Backup hoàn tất"