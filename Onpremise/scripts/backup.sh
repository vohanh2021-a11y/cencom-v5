#!/usr/bin/env bash
# =============================================================================
# backup.sh — Backup PostgreSQL của stack On-Premise
# Chạy trên server: bash scripts/backup.sh
# Tạo file <BACKUP_DIR>/cencom_<date>.sql.gz (giữ 30 ngày)
#
# Đọc DB_NAME / DB_USER / DB_PASSWORD từ ../.env (file nội suy của compose).
# Container DB mặc định là "supabase-db" (đổi qua biến DB_CONTAINER nếu deploy v5).
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [[ -f "$ENV_FILE" ]]; then source "$ENV_FILE"; fi

DB_NAME="${DB_NAME:-cencom_os}"
DB_USER="${DB_USER:-postgres}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/cencom}"

mkdir -p "$BACKUP_DIR"
DATE=$(date +%F_%H-%M-%S)
FILE="$BACKUP_DIR/cencom_${DATE}.sql.gz"

echo "[$(date)] Bắt đầu backup DB '$DB_NAME' từ container '$DB_CONTAINER'..."
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"

if [[ -s "$FILE" ]]; then
    echo "[$(date)] ✅ Backup thành công: $FILE ($(du -h "$FILE" | cut -f1))"
else
    echo "[$(date)] ❌ Lỗi: file backup rỗng."
    rm -f "$FILE"
    exit 1
fi

# Xóa bản cũ (30 ngày)
find "$BACKUP_DIR" -name "cencom_*.sql.gz" -mtime +30 -delete
echo "[$(date)] Đã dọn bản cũ. Dung lượng: $(du -sh "$BACKUP_DIR" | cut -f1)"
