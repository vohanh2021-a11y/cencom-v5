# Plan: Host LAN — CencomOS-Gara 4.0 Server trên mạng nội bộ công ty

> **Phiên bản**: 2026-08-17  
> **Tác giả**: Gatekeeper  
> **Trạng thái**: Draft (chờ execute)  
> **Mục tiêu**: Biến máy tính hiện tại thành server on-premise để các máy trong cùng LAN truy cập CencomOS-Gara qua HTTPS

---

## 0. TÓM TẮT MỘT CÂU

Triển khai CencomOS-Gara v4.0 (Docker stack + Next.js + PostgreSQL + Supabase Realtime/Storage + Nginx SSL) trên máy Windows này để **các máy trong mạng LAN công ty** (192.168.0.0/22) truy cập qua `https://192.168.0.72` hoặc `https://cencom.lan`, với SSL cert self-signed được tin cậy trên máy client.

---

## 1. NETWORK INFO (đã quét)

| Thành phần | Giá trị |
|---|---|
| LAN IP | `192.168.0.72` |
| Subnet | `255.255.252.0` (/22 → range 192.168.0.0 – 192.168.3.255) |
| Gateway / DNS | `192.168.1.1` |
| Hostname Windows | `HanhVo` |
| App hostname | `cencom.lan` (đăng ký trong cert) |
| Docker mode | WSL2 backend (IP: 172.18.0.1) |
| Docker version | Desktop 4.86.0, Engine 29.7.2, Compose v5.3.1 |
| Ports đang dùng | 80→nginx, 443→nginx, 54322→pg, 54324→realtime, 54325→storage |

---

## 2. TRẠNG THÁI HIỆN TẠI (đã quét)

| Container | Status | Healthy? |
|---|---|---|
| `supabase-db` | Up | ✅ pg_isready OK |
| `supabase-realtime` | Up | ✅ kết nối DB |
| `supabase-storage` | Up | ✅ chạy trên 54325 |
| `cencom-web` | Up | ✅ HEALTHCHECK 200 |
| `cencom-nginx` | Up | ✅ proxy HTTP→HTTPS |

**Health check**: `https://192.168.0.72/api/health` → `{"ok":true,"status":"healthy","timestamp":"..."}` ✅

**Database**: 59 xe, 11 users (admin-1 / cencom@123)

---

## 3. VẤN ĐỀ & LỖI HIỆN TẠI

| ID | Vấn đề | Severity | File liên quan |
|---|---|---|---|
| V-01 | SSL cert chỉ có SAN `cencom.lan, localhost, 127.0.0.1` — thiếu `192.168.0.72` | ⚠️ Medium | Onpremise/nginx/certs/ |
| V-02 | env_file order sai: `.env.onpremise` (placeholder) override `.env.onpremise.local` (real secrets) → SESSION_SECRET & LOGIN_RATE_LIMIT sai | 🔴 High | Onpremise/docker-compose.yml:79-81 |
| V-03 | `cencom.lan` chưa có hosts entry trên máy này | ⚠️ Low | C:\Windows\System32\drivers\etc\hosts |
| V-04 | Client chưa trust self-signed cert | ⚠️ Medium | Phân phối server.crt tới client |

---

## 4. KẾ HOẠCH THỰC THI (6 Tasks)

Thứ tự thực thi **tuần tự** từ T1 → T5. T6 là cấu hình tùy chọn.

### T1. Regenerate SSL Certificate (fix V-01)
- **Mục tiêu**: Cert bao gồm `192.168.0.72` trong SAN
- **File thực thi**: `01_fix_cert.sh` — chạy qua WSL2 openssl
- **Input**: `.env.onpremise` (đọc `NEXT_PUBLIC_BASE_URL`)
- **Output**: `Onpremise/nginx/certs/server.crt` + `server.key` (mới)
- **Thời gian**: ~30s
- **Dependency**: chưa có — chạy trước restart nginx
- **Verify**: `openssl x509 -text -noout` → SAN chứa `IP Address:192.168.0.72`

### T2. Fix env_file Order (fix V-02)
- **Mục tiêu**: `.env.onpremise.local` được load CUỐI để override template
- **File thực thi**: `02_fix_env_order.ps1`
- **Input**: `Onpremise/docker-compose.yml`
- **Thay đổi**:
  ```yaml
  # TRƯỚC:
  env_file:
    - .env.onpremise.local    # real secrets (bị override!)
    - .env.onpremise          # template (override)
  # SAU:
  env_file:
    - .env.onpremise          # template (base)
    - .env.onpremise.local    # real secrets (override final)
  ```
- **Verify**: `docker compose config` → `SESSION_SECRET` = `0d9e2fbf...` (từ .env.onpremise.local)

### T3. Restart Docker Stack (pickup cert + env changes)
- **Mục tiêu**: nginx reload cert, cencom-web reload env
- **File thực thi**: `03_restart_stack.ps1`
- **Lệnh**:
  ```bash
  docker compose -f Onpremise/docker-compose.yml restart
  ```
- **Down**: ~30s (Next.js cold start ~5s, DB ~10s)
- **Verify**: 3 containers healthy, `/api/health` trả về 200

### T4. Add Hosts Entry (fix V-03)
- **Mục tiêu**: `192.168.0.72 cencom.lan` trong hosts file
- **File thực thi**: `04_hosts_entry.ps1`
- **Hành động**: Thêm dòng vào `C:\Windows\System32\drivers\etc\hosts` (nếu chưa có)
- **Verify**: `ping cencom.lan` → resolve về `192.168.0.72`

### T5. Verify LAN Accessibility (end-to-end)
- **Mục tiêu**: Health, login, RPC đều hoạt động qua IP và hostname
- **File thực thi**: `05_verify.sh` (chạy trong WSL2)
- **Tests**:
  1. `curl -k https://192.168.0.72/api/health` → `{"ok":true}`
  2. `curl -k https://cencom.lan/api/health` → `{"ok":true}`
  3. `POST /api/auth` với admin-1 → nhận `cen_session` cookie
  4. `POST /api/rpc {fn:"currentUser"}` với cookie → nhận user data
  5. `GET /realtime` (WebSocket handshake) → 101 Switching Protocols
- **Verify output**: PASS/FAIL cho từng test

### T6. Windows Firewall (optional — nếu client không connect được)
- **Mục tiêu**: Mở inbound 443/80 cho subnet 192.168.0.0/16
- **File thực thi**: `06_firewall.ps1`
- **Docker Desktop** đã tạo rule nhưng chưa chắc cho phép LAN inbound
- **Lệnh**:
  ```powershell
  New-NetFirewallRule -DisplayName "CencomOS HTTPS LAN" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow -RemoteAddress 192.168.0.0/16
  New-NetFirewallRule -DisplayName "CencomOS HTTP LAN" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow -RemoteAddress 192.168.0.0/16
  ```

---

## 5. CLIENT-SIDE SETUP (phân phối cho máy khách)

Bộ cài trong `client-setup/`:

| File | Mô tả |
|---|---|
| `install_cert_win.bat` | Thêm `server.crt` vào Trusted Root CA (Windows) |
| `install_cert_linux.sh` | Thêm `server.crt` vào CA bundle (Linux) |
| `install_cert_mac.sh` | Thêm `server.crt` vào keychain (Mac) |
| `cencom-lan-hosts.txt` | Dòng hosts entry để copy |
| `server.crt` | Bản sao cert public (copy từ Onpremise/nginx/certs/) |

### Hướng dẫn client (1 máy khác trên LAN):
1. Copy `client-setup/server.crt` sang máy client
2. Chạy `install_cert_win.bat` (Admin) — thêm cert vào Trusted Root
3. Thêm `192.168.0.72 cencom.lan` vào hosts file (hoặc dùng IP trực tiếp)
4. Truy cập `https://cencom.lan` hoặc `https://192.168.0.72`

---

## 6. FILE MANIFEST

```
Onpremise/plan_host_LAN/
├── README.md                  ← File này (master plan)
├── manifest.json              ← Task manifest (machine-readable)
├── 01_fix_cert.sh             ← Regenerate SSL cert với IP LAN
├── 02_fix_env_order.ps1       ← Fix env_file order trong docker-compose.yml
├── 03_restart_stack.ps1       ← Restart Docker stack
├── 04_hosts_entry.ps1         ← Thêm hosts entry
├── 05_verify.sh               ← End-to-end verification
├── 06_firewall.ps1            ← Windows Firewall rules (optional)
└── client-setup/
    ├── README.md              ← Hướng dẫn client setup
    ├── install_cert_win.bat   ← Cài cert Windows
    ├── install_cert_linux.sh  ← Cài cert Linux
    ├── install_cert_mac.sh    ← Cài cert Mac
    ├── cencom-lan-hosts.txt   ← Hosts entry template
    └── server.crt             ← Cert public (copy từ nginx/certs)
```

---

## 7. EXECUTION ORDER (để AI thực thi)

```
T1 → T2 → T3 → T4 → T5 → [T6 nếu cần]
  ↓      ↓      ↓      ↓      ↓      ↓
cert   env    stack  hosts  verify  fw (optional)
```

Chạy từng task bằng cách gọi script tương ứng. Mỗi script có `--dry-run` để preview (trừ firewall).

---

## 8. RUIRO & MITIGATION

| Rủi ro | Nguyên nhân | Mitigation |
|---|---|---|
| Cert mới không được nginx load | Restart nginx thành công nhưng volume mount lỗi | `docker exec cencom-nginx nginx -T` verify cert path |
| env_file order sai vẫn | File `.env.onpremise` được cập nhật sau này | Thêm comment warning trong docker-compose.yml |
| Client không connect được | Windows Firewall block inbound | Chạy T6, verify `docker ps` ports |
| Realtime WebSocket lỗi | Nginx không proxy Upgrade header | Nginx config đã có `proxy_set_header Upgrade` — verify |

---

## 9. VERIFICATION CHECKLIST

- [ ] T1: `openssl x509 -text` → SAN chứa `192.168.0.72`
- [ ] T2: `docker compose config` → `SESSION_SECRET=0d9e2fbf...` (thật)
- [ ] T3: `docker compose ps` → 5 containers UP + healthy
- [ ] T4: `ping cencom.lan` → `192.168.0.72`
- [ ] T5: `curl -k https://192.168.0.72/api/health` → `{"ok":true}`
- [ ] T5: Login `admin-1`/`cencom@123` → nhận cookie
- [ ] T5: `POST /api/rpc {fn:"currentUser"}` → trả về user data
- [ ] Client: trust cert + resolve hostname + login thành công

> ⚠️ Lưu ý hệ thống sản xuất (Production Check):
> - Con thieu gi? Hosts entry, client cert trust, firewall inbound rules chưa verify từ máy client thực.
> - Rui ro dau? Cert regenerate → nếu script lỗi, nginx sẽ fail startup → downtime. Có rollback plan (cert cũ trong git history).
> - Da chay test chua? Chưa — đây là plan, cần execute T1-T5 rồi verify.
> - De xuat cai thien? Thêm Let's Encrypt proxy nếu LAN có domain nội bộ; dùng cert truy cập qua hostname thay vì IP.
