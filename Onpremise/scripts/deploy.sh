#!/usr/bin/env bash
set -euo pipefail
# Usage: ./scripts/deploy.sh [start|stop|restart|status|logs|update]
# Quản lý stack On-Premise bằng docker compose (file mặc định: docker-compose.yml).
# Biến môi trường:
#   COMPOSE_FILE  (mặc định: docker-compose.yml)
#   ENV_FILE      (mặc định: .env.onpremise.local, fallback .env.onpremise)
#
# LƯU Ý: bản v4 từng dùng docker-compose.prod.yml + .env.prod (không tồn tại trong
# repo này) → script đã cập nhật để trỏ đúng file thực tế. Nếu sau này có file .prod,
# đặt COMPOSE_FILE=/ENV_FILE tương ứng khi gọi.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
ENV_FILE="${ENV_FILE:-$PROJECT_ROOT/Onpremise/.env.onpremise.local}"
if [[ ! -f "$ENV_FILE" ]]; then ENV_FILE="$PROJECT_ROOT/Onpremise/.env.onpremise"; fi
if [[ -f "$ENV_FILE" ]]; then source "$ENV_FILE"; fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "❌ Không tìm thấy $COMPOSE_FILE"
  exit 1
fi

# Chọn lệnh compose (V2 ưu tiên, fallback V1)
if docker compose version >/dev/null 2>&1; then
  C="docker compose -f $COMPOSE_FILE"
elif command -v docker-compose >/dev/null 2>&1; then
  C="docker-compose -f $COMPOSE_FILE"
else
  echo "❌ Không tìm thấy 'docker compose'/'docker-compose'."; exit 1
fi

case "${1:-start}" in
  start)   $C up -d --build ;;
  stop)    $C down ;;
  restart) $C restart ;;
  status)  $C ps ;;
  logs)    $C logs -f ;;
  update)  git pull; $C up -d --build ;;
  *) echo "Usage: $0 {start|stop|restart|status|logs|update}"; exit 1 ;;
esac
