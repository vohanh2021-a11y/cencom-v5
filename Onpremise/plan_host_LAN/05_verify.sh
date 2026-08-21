#!/bin/bash
# === T5_verify.sh — End-to-end verification ===
set -uo pipefail
LAN_IP="${1:-192.168.0.72}"
DOMAIN="cencom.lan"
BASE_URL="https://$LAN_IP"
COOKIE_FILE="/tmp/cencom_verify_cookie.txt"
PASS=0
FAIL=0

echo "=============================================="
echo "  CencomOS-Gara LAN Host Verification"
echo "  Target: ${BASE_URL} (domain: ${DOMAIN})"
echo "  Date:   $(date)"
echo "=============================================="
echo ""

# T1: Health via IP (HTTPS)
echo "[T1] Health check qua IP (HTTPS)..."
T1=$(curl -ksS "${BASE_URL}/api/health" 2>&1) || true
if echo "$T1" | grep -q '"ok":true'; then
  echo "  [PASS] Health API qua IP: $T1"
  ((PASS++))
else
  echo "  [FAIL] Health API qua IP: $T1"
  ((FAIL++))
fi
echo ""

# T2: Health via hostname
echo "[T2] Health check qua hostname (cencom.lan)..."
HOSTS_FILE="/mnt/c/Windows/System32/drivers/etc/hosts"
if grep -q "$LAN_IP.*cencom.lan" "$HOSTS_FILE" 2>/dev/null; then
  T2=$(curl -ksS "https://${DOMAIN}/api/health" 2>&1) || true
  if echo "$T2" | grep -q '"ok":true'; then
    echo "  [PASS] Health API qua hostname: $T2"
    ((PASS++))
  else
    echo "  [FAIL] Health API qua hostname: $T2"
    ((FAIL++))
  fi
else
  echo "  [SKIP] cencom.lan chua co hosts entry"
fi
echo ""

# T3: Login
echo "[T3] Login admin-1 / cencom@123..."
T3=$(curl -ksS -c "$COOKIE_FILE" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin-1","password":"cencom@123"}' \
  "${BASE_URL}/api/auth" 2>&1) || true

if echo "$T3" | grep -q '"ok":true'; then
  echo "  [PASS] Login thanh cong"
  echo "       Response: $(echo $T3 | head -c 200)"
  # Kiem tra cookie
  if grep -q "cen_session" "$COOKIE_FILE" 2>/dev/null; then
    echo "  [PASS] Session cookie (cen_session) da luu"
    ((PASS++))
  else
    echo "  [FAIL] Session cookie khong tim thay"
    ((FAIL++))
  fi
  ((PASS++))
else
  echo "  [FAIL] Login that bai: $T3"
  ((FAIL++))
fi
echo ""

# T4: RPC currentUser
echo "[T4] RPC dispatch: currentUser..."
TOKEN=$(grep "cen_session" "$COOKIE_FILE" 2>/dev/null | awk '{print $NF}')
if [ -n "$TOKEN" ]; then
  T4=$(curl -ksS -b "$COOKIE_FILE" \
    -H "Content-Type: application/json" \
    -H "x-session-token: $TOKEN" \
    -d '{"fn":"currentUser","args":[]}' \
    "${BASE_URL}/api/rpc" 2>&1) || true

  if echo "$T4" | grep -q '"ok":true'; then
    echo "  [PASS] RPC currentUser: $(echo $T4 | head -c 200)"
    ((PASS++))
  else
    echo "  [FAIL] RPC currentUser: $T4"
    ((FAIL++))
  fi
else
  echo "  [FAIL] RPC currentUser: khong co session token"
  ((FAIL++))
fi
echo ""

# T5: WebSocket Realtime (kiem tra port)
echo "[T5] WebSocket Realtime (port 54324)..."
if command -v nc &>/dev/null; then
  if nc -z "$LAN_IP" 54324 2>/dev/null; then
    echo "  [PASS] Port 54324 (Realtime) dang mo"
    ((PASS++))
  else
    echo "  [FAIL] Port 54324 khong mo"
    ((FAIL++))
  fi
else
  echo "  [SKIP] nc khong co - check docker ps"
fi
echo ""

# Cleanup
rm -f "$COOKIE_FILE"

# Summary
echo "=============================================="
echo "  KET QUA VERIFICATION"
echo "  PASS: $PASS | FAIL: $FAIL"
echo "=============================================="

if [ $FAIL -eq 0 ]; then
  echo ""
  echo "  ALL TESTS PASSED - Server san sang phuc vu LAN!"
  echo "  Truy cap: https://$LAN_IP hoac https://$DOMAIN"
  echo "  Tai khoan: admin-1 / cencom@123"
  exit 0
else
  echo ""
  echo "  CO LOI - kiem tra logs:"
  echo "    docker logs cencom-nginx --tail 50"
  echo "    docker logs cencom-web --tail 50"
  exit 1
fi
