#!/bin/bash
# === install_cert_mac.sh — Cài đặng SSL cert vào keychain (macOS) ===
# Chạy: sudo bash install_cert_mac.sh
set -e

CERT_DIR="$(cd "$(dirname "$0")" && pwd)"
CERT_FILE="$CERT_DIR/server.crt"

if [ ! -f "$CERT_FILE" ]; then
    echo "[ERROR] Không tìm thấy $CERT_FILE"
    exit 1
fi

echo "=== Cài đặt SSL cert vào Keychain (macOS) ==="
echo "  Cert: $CERT_FILE"

# Thêm cert vào System keychain — tin cậy
sudo security add-trusted-cert -d -r -k /Library/Keychains/System.keychain "$CERT_FILE"

echo "[OK] Đã thêm cert vào System keychain (trusted)"
echo ""
echo "=== Hoàn tất ==="
echo "  Truy cập: https://192.168.0.72"
echo "  Hoặc:     https://cencom.lan"
echo ""
echo "  Thêm hosts entry:"
echo "    echo '192.168.0.72 cencom.lan' | sudo tee -a /etc/hosts"
