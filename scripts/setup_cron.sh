#!/usr/bin/env bash
set -euo pipefail

# Cron job chạy cleanup + backup mỗi ngày 02:00
# Sử dụng DATABASE_URL từ .env.local của project

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env.local"

# Đọc DATABASE_URL từ .env.local (nếu có)
if [ -f "$ENV_FILE" ]; then
  DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2-)
else
  DATABASE_URL=""
fi

# Xây dựng cron job
CRON_JOB="0 2 * * * cd ${PROJECT_DIR}"

if [ -n "$DATABASE_URL" ]; then
  CRON_JOB="${CRON_JOB} && DATABASE_URL='${DATABASE_URL}' npx tsx scripts/cleanup_test.ts >> ${PROJECT_DIR}/logs/cleanup.log 2>&1"
fi

CRON_JOB="${CRON_JOB} && DATABASE_URL='${DATABASE_URL}' bash scripts/backup.sh >> ${PROJECT_DIR}/logs/cron.log 2>&1"

# Thêm crontab
(crontab -l 2>/dev/null | grep -v "cencom_cron\|cron:daily\|cleanup_test\|backup.sh" ; echo "$CRON_JOB") | crontab -

echo "✅ Daily cron installed: cleanup test data + backup at 02:00"
echo "   Crontab entry: $(crontab -l)"