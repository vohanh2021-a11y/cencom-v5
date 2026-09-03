#!/bin/bash
# =============================================================================
# setup_cron_backup.sh — Cài đặt cron job backup hàng ngày (2h sáng)
# Chạy trên Ubuntu Server: sudo bash setup_cron_backup.sh
# Backup script thực tế nằm ở Onpremise/scripts/backup.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="/opt/cencom/backups"
CRON_SCRIPT="$SCRIPT_DIR/backup.sh"
CRON_USER="root"

echo "=== Cài đặt cron backup hàng ngày ==="

# Tạo thư mục backup
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# Đảm bảo backup.sh tồn tại và executable
if [[ ! -f "$CRON_SCRIPT" ]]; then
  echo "❌ Không tìm thấy $CRON_SCRIPT"
  exit 1
fi
chmod +x "$CRON_SCRIPT"

# Thêm cron job (2h sáng hàng ngày)
CRON_JOB="0 2 * * * $CRON_SCRIPT >> $BACKUP_DIR/cron.log 2>&1"

# Kiểm tra xem đã có cron job chưa
if crontab -l 2>/dev/null | grep -q "backup.sh"; then
    echo "Cron job đã tồn tại, bỏ qua."
else
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "Đã thêm cron job: $CRON_JOB"
fi

echo ""
echo "=== Cron jobs hiện tại ==="
crontab -l

echo ""
echo "=== Thư mục backup ==="
ls -la "$BACKUP_DIR"
