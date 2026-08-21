#!/bin/bash
# === 01_fix_cert.sh — Regenerate self-signed SSL cert với IP LAN trong SAN ===
# Chạy trong WSL2 (để dùng openssl):  bash 01_fix_cert.sh [LAN_IP] [DOMAIN]
#
# Input:
#   $1 = LAN_IP    (default: 192.168.0.72 — đọc từ ipconfig)
#   $2 = DOMAIN    (default: cencom.lan — đọc từ NEXT_PUBLIC_BASE_URL trong .env.onpremise)
#
# Output:
#   Onpremise/nginx/certs/server.crt  (public cert — chứa SAN)
#   Onpremise/nginx/certs/server.key  (private key — CHỈ 600)
#
# Verify: openssl x509 -in server.crt -text -noout | grep -A2 "Subject Alternative"
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"       # .../Onpremise
REPO_ROOT="$(dirname "$PROJECT_ROOT")"        # .../cencomOS_gara_4.0_supa
CERTS_DIR="$PROJECT_ROOT/nginx/certs"

# ─── Parse args ───
LAN_IP="${1:-192.168.0.72}"
DOMAIN="${2:-cencom.lan}"

# ─── Fallback: detect LAN IP từ ip command (Linux/WSL) ───
if command -v hostname &>/dev/null; then
  DETECTED_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  if [ -n "$DETECTED_IP" ] && [ "$DETECTED_IP" != "$LAN_IP" ]; then
    echo "[WARN] LAN_IP=$LAN_IP nhưng máy phát hiện IP khác: $DETECTED_IP"
    echo "       Dùng --arg nếu muốn thay đổi."
  fi
fi

mkdir -p "$CERTS_DIR"

echo "=== [01_fix_cert] Sinh self-signed SSL cert ==="
echo "  Domain:  $DOMAIN"
echo "  LAN IP:  $LAN_IP"
echo "  Cert dir: $CERTS_DIR"

# ─── Backup cert cũ nếu tồn tại ───
if [ -f "$CERTS_DIR/server.crt" ]; then
  cp "$CERTS_DIR/server.crt" "$CERTS_DIR/server.crt.bak.$(date +%s)"
  cp "$CERTS_DIR/server.key" "$CERTS_DIR/server.key.bak.$(date +%s)" 2>/dev/null || true
  echo "  ✓ Đã backup cert cũ"
fi

# ─── Sinh cert mới với SAN bao gồm IP LAN ───
openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout "$CERTS_DIR/server.key" \
  -out "$CERTS_DIR/server.crt" \
  -subj "/C=VN/ST=HoChiMinh/O=CencomOS/OU=IT Department/CN=$DOMAIN" \
  -addext "subjectAltName=DNS:$DOMAIN,DNS:cencom.local,DNS:localhost,IP:127.0.0.1,IP:$LAN_IP"

# ─── Permissions ───
chmod 600 "$CERTS_DIR/server.key"
chmod 644 "$CERTS_DIR/server.crt"

echo ""
echo "=== ✓ Certificate tạo xong ==="
echo "  server.crt → $(ls -la "$CERTS_DIR/server.crt" | awk '{print $5" bytes"}')"
echo "  server.key → $(ls -la "$CERTS_DIR/server.key" | awk '{print $5" bytes"}')"
echo ""
echo "=== SAN verification ==="
openssl x509 -in "$CERTS_DIR/server.crt" -text -noout 2>/dev/null | grep -A1 "Subject Alternative Name"

# ─── Copy cert to client-setup/ để phân phối ───
CLIENT_SETUP_DIR="$SCRIPT_DIR/client-setup"
if [ -d "$CLIENT_SETUP_DIR" ]; then
  cp "$CERTS_DIR/server.crt" "$CLIENT_SETUP_DIR/server.crt"
  echo "  ✓ Đã copy server.crt → client-setup/server.crt (phân phối cho client)"
fi

echo ""
echo "=== [DONE] Chạy T3: 03_restart_stack.ps1 để reload nginx ==="
