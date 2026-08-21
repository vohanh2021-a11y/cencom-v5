#!/bin/bash
# Cron setup script for cencomOS gara reconstruction v5
# Adds daily cleanup and backup jobs to crontab at 02:00 AM
# Usage: bash scripts/setup_cron.sh

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
SCRIPTS_DIR="${PROJECT_DIR}/scripts"

# Verify scripts directory exists
if [[ ! -d "$SCRIPTS_DIR" ]]; then
  echo "ERROR: Scripts directory not found: $SCRIPTS_DIR" >&2
  exit 1
fi

# Remove any existing cencomOS cron jobs to avoid duplicates
(crontab -l 2>/dev/null | grep -v "cencomOS" ) | crontab - 2>/dev/null || true

# Add cleanup job: run tsx cleanup script at 02:00 daily
# Use npx tsx from the project's node_modules
CLEANUP_CMD="cd ${PROJECT_DIR} && npx tsx scripts/cleanup_test.ts"
CLEANUP_CRON="0 2 * * * ${CLEANUP_CMD}"

# Add backup job at 02:01 (give cleanup a moment to finish)
BACKUP_CMD="cd ${PROJECT_DIR} && bash scripts/backup.sh"
BACKUP_CRON="0 2 * * * ${BACKUP_CMD}"

# Write the new crontab
{
  # Preserve existing non-cencomOS jobs
  (crontab -l 2>/dev/null | grep -v "cencomOS") 2>/dev/null
  echo "$CLEANUP_CRON"
  echo "$BACKUP_CRON"
} | crontab -

echo "Cron job setup complete."
echo "Added cleanup job: 0 2 * * * cd ${PROJECT_DIR} && npx tsx scripts/cleanup_test.ts"
echo "Added backup job:    0 2 * * * cd ${PROJECT_DIR} && bash scripts/backup.sh"
echo "Both run daily at 02:00."