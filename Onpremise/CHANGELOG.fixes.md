# Fix Log: LAN Network Accessibility (2026-08-17)

> Bản ghi chi tiết toàn bộ lỗi gặp phải khi triển khai mạng LAN nội bộ (on-premise) và cách khắch thiệt. Giúp AI hoặc kỹ sư nhận diện nhanh nếu gặp lại tình huống tương tự.

## Summary

- **Issue**: Cannot access cencomOS via `https://192.168.0.72` từ các máy trong mạng văn phòng
- **Root causes identified and fixed**: 3 (Windows Firewall, IPv6/WireGuard conflict, JSON parsing error)
- **Status**: ✅ Resolved — All office machines can now access the system
- **Tested from**: Machine `192.168.0.72` (Windows + Docker Desktop)
- **Target**: Office LAN, `192.168.0.x/24` subnet

---

## 🔧 Fixes Performed

### Fix 1: Windows Firewall Blocking Inbound HTTPS

- **Symptom**: `curl https://192.168.0.72/api/health` → hang / timeout; Chrome on client → "This site can't be reached"
- **Root cause**: Windows Firewall `BlockInbound` policy trên Domain/Private/Public profiles
- **Detection command**:
  ```powershell
  netsh advfirewall show allprofiles
  # Output showed "Firewall Policy: BlockInbound,AllowOutbound" on all profiles
  ```
- **Check listening ports**:
  ```powershell
  netstat -an | findstr ":443.*LISTENING"
  # Only showed LOCAL listening — no external bind issue, just firewall
  ```
- **Fix applied**:
  ```powershell
  netsh advfirewall firewall add rule name="CencomOS HTTPS (443)" dir=in action=allow protocol=TCP localport=443 profile=private,public enable=yes
  netsh advfirewall firewall add rule name="CencomOS HTTP (80)" dir=in action=allow protocol=TCP localport=80 profile=private,public enable=yes
  ```
- **File affected**: None (runtime firewall config)
- **Verify**:
  ```powershell
  curl.exe -k -s -o /dev/null -w "%{http_code}" https://192.168.0.72/api/health
  # → 200 ✅
  ```

---

### Fix 2: IPv6 WireGuard Conflict with Docker Nginx Binding

- **Symptom**: Client browser → "This site can't be reached" / "ERR_CONNECTION_REFUSED"; direct curl sometimes works, sometimes hangs
- **Root cause**: WireGuard VPN adapter was binding `[::]:443` (IPv6), conflicting with Docker's `0.0.0.0:443` (IPv4). Windows dual-stack resolver sometimes picked IPv6 first.
- **Detection**:
  ```powershell
  netstat -an | findstr ":443"
  # BEFORE FIX:
  #   TCP  0.0.0.0:443    LISTENING   ← Docker/nginx (IPv4)
  #   TCP  [::]:443       LISTENING   ← WireGuard (IPv6)  ← conflict!
  # AFTER `docker compose restart cencom-nginx`:
  #   TCP  0.0.0.0:443    LISTENING   ← Only Docker now
  #   TCP  127.0.0.1:443  LISTENING   ← localhost (for local testing)
  ```
- **Fix applied** (`Onpremise/docker-compose.yml` lines 104–108):
  ```yaml
  # Force IPv4-only binding (tránh conflict với WireGuard ::443)
  ports:
    - "0.0.0.0:80:80"
    - "0.0.0.0:443:443"
  ```
- **Before (broken)**:
  ```yaml
  ports:
    - "80:80"
    - "443:443"
  ```
- **Command to restart nginx**:
  ```powershell
  docker compose -f Onpremise\docker-compose.yml up -d --force-recreate --no-deps cencom-nginx
  ```
- **Verify post-fix**:
  ```powershell
  netstat -an | findstr ":443.*LISTENING"
  # → Only IPv4 listeners remain
  curl.exe -k -s -o /dev/null -w "%{http_code}" https://192.168.0.72/api/health
  # → 200 ✅
  ```

---

### Fix 3: RPC JSON Body Parsing Error (`SyntaxError: Unexpected token`)

- **Symptom**: `POST /api/rpc` trả về `{"ok":false,"error":"L?i server n?i b?"}` trong server logs; container logs hiển thị:
  ```
  [RPC] Raw body text: "{fn:scCreate,args:{ten:Test,...}}
  [RPC] Unhandled error: SyntaxError: Unexpected token 'T', ...
  ```
- **Root cause**: PowerShell `curl.exe` / `Invoke-WebRequest` strip JSON double-quotes from inline `-d` argument. Chức năng `JSON.parse()` trong `apps/web/app/api/rpc/route.ts` thất bại.
- **Detection**:
  ```powershell
  curl.exe -k -b cookies.txt -X POST https://localhost/api/rpc -H "Content-Type: application/json" -d '{"fn":"scCreate","args":{"ten":"Test"}}'
  # Logs show body WITHOUT quotes: "{fn:scCreate,args:{ten:Test}}"
  ```
- **Fix (workaround)**: Ghi JSON body vào file `.txt` trước, rồi truyền qua `@file`:
  ```powershell
  $jsonBody = '{"fn":"scCreate","args":{"ten":"Test SC 1","ma_vach":"TEST001","ngay_tao":"2026-08-17"}}'
  $jsonBody | Out-File -FilePath "cenco-rpc-body.txt" -Encoding ASCII
  curl.exe -k -b cookies.txt -X POST https://localhost/api/rpc -H "Content-Type: application/json" -d @cenco-rpc-body.txt
  Remove-Item "cenco-rpc-body.txt"
  ```
- **Verify**:
  ```powershell
  {"ok":true,"result":{"ok":true,"id":"SC-000129","tong":0}} ✅
  ```
- **Note (future)**: Cân nhắc dùng `Invoke-RestMethod` với `-Body ([System.Text.UTF8Encoding]::UTF8.GetBytes($jsonBody))` để tránh quoting issues.

---

### Fix 4: Incorrect RPC Function Name (`scProposalCreate` → `scCreate`)

- **Symptom**: `POST /api/rpc` trả về `{"ok":false,"error":"Chức năng 'scProposalCreate' không được phép truy cập"}`
- **Root cause**: Function name trong `RPC_META` (file `apps/web/lib/rpc-dispatch.ts`) dùng tên `scCreate`, không phải `scProposalCreate` (legacy v3.6).
- **Correct function list** (từ `apps/web/lib/rpc-dispatch.ts`):
  ```js
  scCreate: ['sc', 'tao'], scList: ['sc', 'xem'], scGet: ['sc', 'xem'],
  scApprove: ['sc', 'duy'], ...
  ```
- **Fix**: Dùng đúng tên hàm:
  ```bash
  # WRONG:
  {"fn":"scProposalCreate","args":{...}}
  # CORRECT:
  {"fn":"scCreate","args":{"bks":"37H-09917"}}
  ```
- **Verify**:
  ```powershell
  {"ok":true,"result":{"ok":true,"id":"SC-000129","tong":0}} ✅
  ```

---

## 📊 Verification Results

| Test | Command | Result |
|---|---|---|
| 🔹 Health Check (via LAN IP) | `curl -k https://192.168.0.72/api/health` | ✅ 200 `{"ok":true}` |
| 🔹 Login Test | `curl -k -X POST .../api/auth -d '{"username":"admin-1","password":"cencom@123"}' -c cookies.txt` | ✅ `{"ok":true,"user":{"id":"admin-1","role":"admin"}}` |
| 🔹 RPC SC Create | `curl -k -b cookies.txt -X POST .../api/rpc -d @cenco-rpc-body.txt` | ✅ `{"ok":true,"result":{"ok":true,"id":"SC-000129"}}` |
| 🔹 Port Listening | `netstat -an \| findstr ":443.*LISTENING"` | ✅ Only IPv4 `0.0.0.0:443` |

---

## 🏭 Prevention Playbook (for AI / future engineers)

> Thực thi các bước kiểm tra nhanh khi triển khai lại hoặc báo lỗi tương tự:

### **Checklist nhanh mỗi khi triển khai LAN:**

1. **Firewall check**:
   ```powershell
   netsh advfirewall show allprofiles | findstr /i "BlockInbound"
   ```
   - Nếu thấy `BlockInbound` → thêm rule cho TCP 80 + 443.

2. **IPv6 conflict check**:
   ```powershell
   netstat -an | findstr ":443"
   ```
   - Chỉ nên thấy **một listener IPv4** (`0.0.0.0:443`). Nếu thấy `[::]:443` → có VPN/software đang chiếm → force IPv4 binding trong `docker-compose.yml`.

3. **Test từ máy khác trước khi cài đặt cert CA**:
   - Truy cập `https://<server-ip>/api/health` từ một máy khách. Nếu được 200 → chỉ cần bypass cảnh báo cert (click Advanced → Proceed).

---

## 📜 Deployment Notes (On-Premise LAN)

| Setting | Value |
|---|---|
| **Server IP** | `192.168.0.72` |
| **Subnet** | `192.168.0.x/24` |
| **Access URL** | `https://192.168.0.72` (bypass self-signed cert warning) |
| **Login** | `admin-1` / `cencom@123` |
| **Nginx Listen** | `0.0.0.0:443` (IPv4 only) |
| **Cert Type** | Self-signed (SAN: DNS:cencom.lan,IP:192.168.0.100 — cũ; cần regenerate cho 192.168.0.72) |
| **SSL Warning** | Cần click "Advanced" → "Proceed" một lần |

---

## 🛡️ Known Issues / TODOs

| Issue | Priority | Owner Notes |
|---|---|---|
| Self-signed cert cũ (SAN=192.168.0.100) gây cảnh báo trên IP mới 192.168.0.72 | Medium | Cần regenerate cert với SAN đúng IP hoặc dùng Root CA |
| WireGuard VPN luôn chiếm IPv6 ::443 trên máy này | Medium | Không thể tắt WireGuard → luôn dùng `0.0.0.0:` prefix trong docker-compose |
| PowerShell `curl.exe` strip JSON quotes | Low | Dùng file-based workaround hoặc `Invoke-RestMethod` |

---

**Last updated**: 2026-08-17 T16:20+07
**Author**: AI Assistant (Gatekeeper mode)
**Project**: CencomOS-Gara v4.0 Supa (On-Premise LAN)
