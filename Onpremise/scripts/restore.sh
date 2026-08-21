#!/usr/bin/env bash
# =============================================================================
# restore.sh — Restore PostgreSQL từ bản backup (.sql.gz)
# Dùng: bash scripts/restore.sh <backup_file.sql.gz>
# CẢNH BÁO: ghi đè database hiện tại.
#
# Đọc DB_NAME / DB_USER từ ../.env; container DB mặc định "supabase-db".
# =============================================================================
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [[ -f "$ENV_FILE" ]]; then source "$ENV_FILE"; fi

DB_NAME="${DB_NAME:-cencom_os}"
DB_USER="${DB_USER:-postgres}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"

FILE="$1"
if [[ ! -f "$FILE" ]]; then
  echo "❌ File not found: $FILE"
  exit 1
fi

echo "⚠️ Restoring will REPLACE current database '$DB_NAME'. Continue? (y/N)"
read -r CONFIRM
if [[ "$CONFIRM" != "y" ]]; then
  echo "Aborted."
  exit 1
fi

echo "🔄 Restoring from $FILE ..."
gunzip -c "$FILE" | docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"
echo "✅ Restored from $FILE"
