#!/usr/bin/env bash
# backup_cloud.sh — Sao lưu cho bản cloud (Supabase managed).
# Yêu cầu: Supabase CLI (supabase) đã đăng nhập + biến môi trường:
#   SUPABASE_PROJECT_REF, SUPABASE_DB_URL, BACKUP_DIR
# Chạy: bash backup_cloud.sh
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Dump DB cloud..."
supabase db dump --project-ref "$SUPABASE_PROJECT_REF" -f "$BACKUP_DIR/cencom_cloud_$DATE.sql" \
  || { echo "dump thất bại"; exit 1; }

# Storage: tải về qua Supabase CLI storage API (tuỳ cấu hình bucket)
echo "[$(date)] Backup xong: $BACKUP_DIR/cencom_cloud_$DATE.sql"
find "$BACKUP_DIR" -name 'cencom_cloud_*.sql' -mtime +14 -delete
