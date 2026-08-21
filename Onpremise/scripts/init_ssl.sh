#!/usr/bin/env bash
set -euo pipefail
SSL_DIR="/etc/ssl/cencom"
mkdir -p "$SSL_DIR"
if [[ ! -f "$SSL_DIR/cert.pem" ]]; then
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$SSL_DIR/key.pem" \
    -out "$SSL_DIR/cert.pem" \
    -subj "/C=VN/ST=HCM/L=HCM/O=CencomOS/OU=IT/CN=localhost"
  chmod 600 "$SSL_DIR/key.pem"
  echo "✅ Self-signed cert created at $SSL_DIR"
else
  echo "ℹ️ Cert already exists"
fi