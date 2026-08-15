#!/bin/bash
# === backup/pg_restore.sh — Khôi phục từ bản backup ===
# Dùng: bash backup/pg_restore.sh /path/to/backup.sql.gz
# Yêu cầu: Docker đang chạy

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo "Ví dụ: $0 /opt/cencom/backups/cencom_20260814_020000.sql.gz"
    exit 1
fi

BACKUP_FILE=$1
DB_NAME=${DB_NAME:-cencom_os}
DB_USER=${DB_USER:-postgres}

if [ ! -f "$BACKUP_FILE" ]; then
    echo "ERROR: File backup không tồn tại: $BACKUP_FILE"
    exit 1
fi

echo "=== Restore từ $BACKUP_FILE ==="

# 1. Dừng stack (giữ DB chạy)
echo "=== [1/5] Dừng services (giữ DB) ==="
docker-compose stop cencom-web cencom-nginx supabase-realtime supabase-storage 2>/dev/null || true

# 2. Đảm bảo DB đang chạy
echo "=== [2/5] Khởi động PostgreSQL ==="
docker-compose up -d supabase-db
sleep 15

# 3. Xóa DB cũ (restore toàn bộ)
echo "=== [3/5] Xóa database cũ ==="
docker exec -i supabase-db psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS ${DB_NAME}_old;" 2>/dev/null || true
docker exec -i supabase-db psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS ${DB_NAME}_backup;" 2>/dev/null || true
docker exec -i supabase-db psql -U "$DB_USER" -c "ALTER DATABASE ${DB_NAME} RENAME TO ${DB_NAME}_backup;" 2>/dev/null || true
docker exec -i supabase-db psql -U "$DB_USER" -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null || {
    echo "Database đã tồn tại, restore trực tiếp..."
}

# 4. Restore
echo "=== [4/5] Restore dữ liệu ==="
gunzip -c "$BACKUP_FILE" | docker exec -i supabase-db psql -U "$DB_USER" -d "$DB_NAME"

# 5. Khởi động lại toàn bộ stack
echo "=== [5/5] Khởi động lại stack ==="
docker-compose up -d

echo ""
echo "=== Restore hoàn tất ==="
echo "Kiểm tra: https://localhost/api/health"
