#!/usr/bin/env bash
# scripts/init_certs.sh — Sinh self-signed cert cho nginx (CencomOS Gara v5 on-premise)
# Tạo nginx/certs/server.crt + server.key (CN=localhost).
# Trình duyệt sẽ cảnh báo self-signed → cần "trust" thủ công (hoặc thay bằng cert thật).
#
# Cách chạy: bash scripts/init_certs.sh
# Env: CERT_DIR (mặc định ./nginx/certs)

set -euo pipefail

CERT_DIR="${CERT_DIR:-./nginx/certs}"
mkdir -p "$CERT_DIR"
KEY="$CERT_DIR/server.key"
CRT="$CERT_DIR/server.crt"

if [ -f "$KEY" ] && [ -f "$CRT" ]; then
  echo "[certs] Đã tồn tại ($CRT, $KEY). Xoá để sinh lại."
  exit 0
fi

if ! command -v openssl >/dev/null 2>&1; then
  echo "[certs] LỖI: openssl không tìm thấy. Cài openssl hoặc đặt cert vào $CERT_DIR." >&2
  exit 1
fi

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$KEY" -out "$CRT" \
  -subj "/C=VN/ST=Local/L=Local/O=CencomOS/CN=localhost"

echo "[certs] Đã sinh: $CRT và $KEY (self-signed, CN=localhost)."
echo "[certs] Mount vào nginx qua volume ./nginx/certs:/etc/nginx/certs (đã cấu hình sẵn trong compose)."
