#!/bin/bash
# =============================================================================
# Rollback Script — cencomOS Gara v5
# Khôi phục code về git tag + restore DB từ backup gần nhất
#
# Usage:
#   bash scripts/rollback.sh <git-tag>              # rollback code + DB
#   bash scripts/rollback.sh <git-tag> --code-only   # rollback code, giữ nguyên DB
#   bash scripts/rollback.sh <git-tag> --db-only     # giữ nguyên code, chỉ restore DB
#
# Ví dụ:
#   bash scripts/rollback.sh v5.0.0
#   bash scripts/rollback.sh v5.0.1 --code-only
#   bash scripts/rollback.sh v5.0.0 --db-only
#
# Yêu cầu:
#   - Git đã cài, repo đang ở branch main/master
#   - pg_restore / psql có trong PATH
#   - backups/ có ít nhất 1 file .sql/.backup từ backup.sh
# =============================================================================

set -euo pipefail

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[INFO]${NC}  $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── Parse args ──
TAG="${1:-}"
CODE_ONLY=false
DB_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --code-only) CODE_ONLY=true ;;
    --db-only)   DB_ONLY=true ;;
  esac
done

if [[ -z "$TAG" ]]; then
  log_error "Usage: bash scripts/rollback.sh <git-tag> [--code-only|--db-only]"
  log_error "Example: bash scripts/rollback.sh v5.0.0"
  exit 1
fi

if $CODE_ONLY && $DB_ONLY; then
  log_error "Không thể dùng đồng thời --code-only và --db-only"
  exit 1
fi

# ── Resolve paths ──
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${PROJECT_DIR}/backups"
DB_CONTAINER="${DB_CONTAINER:-cencom_v5_pg}"

# ── Load DB credentials from .env.local or .env ──
if [[ -f "${PROJECT_DIR}/.env.local" ]]; then
  set -a; source "${PROJECT_DIR}/.env.local"; set +a
elif [[ -f "${PROJECT_DIR}/.env" ]]; then
  set -a; source "${PROJECT_DIR}/.env"; set +a
fi

# ── 1. Validate git tag exists ──
if ! $DB_ONLY; then
  cd "$PROJECT_DIR"
  if ! git tag -l | grep -qx "$TAG"; then
    log_error "Git tag '$TAG' không tồn tại."
    log_warn "Các tag có sẵn:"
    git tag -l | head -20 || echo "  (không có tag nào)"
    exit 1
  fi
  log_info "Git tag '$TAG' — OK"
fi

# ── 2. Find latest backup file ──
find_latest_backup() {
  local latest
  latest=$(ls -1t "${BACKUP_DIR}"/cencom_*.sql 2>/dev/null | head -n1)
  if [[ -z "$latest" ]]; then
    echo ""
  else
    echo "$latest"
  fi
}

# ── 3. Rollback DB (restore) ──
rollback_db() {
  local backup_file
  backup_file=$(find_latest_backup)

  if [[ -z "$backup_file" ]]; then
    log_error "Không tìm thấy backup file trong $BACKUP_DIR"
    log_error "Hãy chạy 'bash scripts/backup.sh' trước hoặc đặt backup thủ công."
    exit 1
  fi

  log_info "Sử dụng backup: $(basename "$backup_file")"

  # Detect format: .backup = custom format (pg_restore), .sql = plain (psql)
  if [[ "$backup_file" == *.backup ]]; then
    log_info "Phát hiện format custom → dùng pg_restore"
    if ! command -v pg_restore &>/dev/null; then
      log_error "pg_restore không có trong PATH"
      exit 1
    fi
    pg_restore --clean --if-exists -U postgres -d cencom "$backup_file"
  else
    log_info "Phát hiện format SQL → dùng psql"
    if ! command -v psql &>/dev/null; then
      log_error "psql không có trong PATH"
      exit 1
    fi
    psql -U postgres -d cencom -f "$backup_file"
  fi

  log_info "DB restore hoàn tất"
}

# ── 4. Rollback code (git) ──
rollback_code() {
  cd "$PROJECT_DIR"

  # Auto-backup before rollback
  log_info "Tạo backup trước khi rollback..."
  bash "${SCRIPT_DIR}/backup.sh" || log_warn "Backup trước rollback thất bại, tiếp tục..."

  log_info "Đang checkout tag '$TAG'..."
  git checkout "$TAG"

  log_info "Code đã khôi phục về tag '$TAG'"
  log_info "BUILD LẠI: npm install && npm run build"
}

# ── Execute ──
echo ""
echo "==========================================="
echo "  cencomOS Gara v5 — ROLLBACK"
echo "  Tag: $TAG"
echo "  Mode: $(if $CODE_ONLY; then echo 'code-only'; elif $DB_ONLY; then echo 'db-only'; else echo 'code + DB'; fi)"
echo "==========================================="
echo ""

if ! $DB_ONLY; then
  rollback_code
fi

if ! $CODE_ONLY; then
  rollback_db
fi

echo ""
log_info "✅ Rollback hoàn tất!"
log_info "  → Kiểm tra: bash scripts/health_check.sh"
log_info "  → Hoặc: curl http://localhost:3001/api/health"
echo ""
