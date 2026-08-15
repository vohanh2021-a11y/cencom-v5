#!/bin/bash
# === backup/pg_backup.sh — PostgreSQL backup hàng ngày ===
# Cron: 0 2 * * * docker exec supabase-db /backup/pg_backup.sh
# Hoặc chạy trực tiếp từ host: bash backup/pg_backup.sh

set -e

BACKUP_DIR=${BACKUP_DIR:-/opt/cencom/backups}
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${RETENTION_DAYS:-7}
DB_NAME=${DB_NAME:-cencom_os}
DB_USER=${DB_USER:-postgres}

mkdir -p "$BACKUP_DIR"

echo "[$(date)] === Bắt đầu backup ==="

# 1. PostgreSQL dump (logical backup)
echo "[$(date)] Dump PostgreSQL..."
if command -v docker > /dev/null 2>&1; then
    # Chạy qua Docker
    docker exec -i supabase-db pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_DIR/cencom_$DATE.sql" 2>&1
else
    # Chạy trực tiếp (nếu psql cài trên host)
    PGPASSWORD="$DB_PASSWORD" pg_dump -h localhost -U "$DB_USER" "$DB_NAME" > "$BACKUP_DIR/cencom_$DATE.sql" 2>&1
fi

if [ $? -eq 0 ]; then
    gzip -f "$BACKUP_DIR/cencom_$DATE.sql"
    echo "[$(date)] Backup SQL thành công: cencom_$DATE.sql.gz"
else
    echo "[$(date)] ERROR: Backup SQL thất bại!"
    exit 1
fi

# 2. Docker volume backup (binary backup - full copy)
echo "[$(date)] Backup Docker volumes..."
docker run --rm \
    -v cencom_pg_data:/data \
    -v "$BACKUP_DIR":/backup \
    alpine tar czf "/backup/pg_volume_$DATE.tar.gz" -C /data . 2>&1
echo "[$(date)] Volume backup thành công: pg_volume_$DATE.tar.gz"

# 3. Xóa bản cũ hơn RETENTION_DAYS
echo "[$(date)] Dọn bản backup cũ (giữ $RETENTION_DAYS ngày)..."
find "$BACKUP_DIR" -name "cencom_*.sql.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "pg_volume_*.tar.gz" -mtime +$RETENTION_DAYS -delete

# 4. Báo cáo
echo "[$(date)] === Backup hoàn tất ==="
echo "[$(date)] Dung lượng:"
du -sh "$BACKUP_DIR"
echo "[$(date)] Danh sách backup:"
ls -lh "$BACKUP_DIR/cencom_*.sql.gz" | tail -5
