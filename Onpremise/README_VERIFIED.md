# Onpremise — README_VERIFIED (Rà soát triển khai On-Premise)

> Worker: **worker-g (WS6)** — nhiệm vụ từ `PLAN_GIAIDOAN_2_3.md` (dòng 30):
> `WS6 | On-premise deploy verify | worker-g | Onpremise/* + Onpremise/README_VERIFIED.md`
> Ngày rà soát: 2026-08-21
> Phạm vi: **CHỈ thư mục `Onpremise/`**. Không sửa app code (kể cả `next.config.js`).

---

## 0. TÓM TẮT TRẠNG THÁI SẴN SÀNG (VERIFIED STATUS)

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Onpremise khớp với **app v5** hiện tại? | ⚠️ **BỔ SUNG** | Onpremise gốc shaped cho **v4 Supabase stack** (monorepo `apps/web` + `packages/*` + `supabase/`). **Tuy nhiên, v5 đã có bộ Docker riêng** tại `gara_reconstruction_v5/` (Dockerfile + docker-compose.yml + nginx.conf + scripts). Xem `gara_reconstruction_v5/DEPLOY.md` để deploy v5 on-premise. `Onpremise/` giữ nguyên cho v4, KHÔNG cần adapt thêm. |
| Onpremise có chạy được cho **v4** không? | ✅ Có (sau khi sửa lỗi dưới) | `volumes/pg_data` đã có data thật → từng chạy. |
| `next.config.js` v5 có `output:'standalone'`? | ❌ **CHƯA** | Do **WS7** giữ; chỉ ghi chú, không sửa. |
| Lỗi nội bộ đã sửa? | ✅ Đã sửa | nginx (2 bug), backup/restore/cron/deploy/win-certs. |

**Kết luận:** Onpremise chưa sẵn sàng deploy **v5** (cần thêm bước từ WS7/C9 + adapt). Đã sửa các lỗi làm hỏng ngay cả deploy v4, và chuẩn bị sẵn nginx hỗ trợ realtime SSE của v5.

---

## 1. KIỂM TRA CHI TIẾT (4 điểm theo task)

### (1) App có bật `output: 'standalone'` trong `next.config.*`?

- **File đọc:** `gara_reconstruction_v5/next.config.js`
- **Kết quả:** **CHƯA bật.** File chỉ có `reactStrictMode` + `headers()` (security headers). Không có `output: 'standalone'`.
- **Hệ quả:** `Onpremise/Dockerfile.standalone` phụ thuộc vào `.next/standalone` / tarball `standalone-build.bin` → **không build được app v5**.
- **Hành động:** 📌 **CHỈ GHI CHÚ** (theo task: "đừng sửa next.config vì WS7 phụ trách"). Để deploy v5 bằng Dockerfile.standalone cần WS7 thêm `output: 'standalone': true`. Trước mắt, container v5 bắt buộc dùng Dockerfile chạy `next build` + `next start` (non-standalone) — nằm ngoài scope `Onpremise/`.

### (2) DB connection trong container có đúng (POSTGRES_* env, migrate/seed khi init)?

- **Cho v4 (hiện tại):** ✅ Đúng. `supabase-db` dùng `POSTGRES_PASSWORD=${DB_PASSWORD}`, `POSTGRES_DB=${DB_NAME}`, `POSTGRES_USER=${DB_USER}` + mount `../supabase/migrations:/docker-entrypoint-initdb.d`. `.env` (Onpremise) cung cấp `DB_PASSWORD/DB_NAME` cho nội suy compose. `cencom-web.environment` ép `DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@supabase-db:5432/${DB_NAME}` → khớp DB container.
- **⚠️ Lưu ý nhỏ:** `.env.onpremise` (template env_file) có `DB_PASSWORD=cencom_pass_2026` khác với `.env` (`cencom_pass_2026_prod_2026`). Runtime vẫn khớp vì `DATABASE_URL` bị ép bởi `environment` (lấy từ `.env`). Nên giữ 2 file đồng bộ về mặt khái niệm.
- **Cho v5 (mục tiêu):** ❌ Chưa khớp. v5 KHÔNG dùng Supabase. DB init = `tsx db/migrate.ts` + `tsx db/seed.ts` + `db/realtime_triggers.sql` (Postgres LISTEN/NOTIFY), **không** dùng `../supabase/migrations` hay `packages/db/schema.sql`. `init_db.sh`/`init_db.ps1` hiện copy `../packages/db/schema.sql` → **sai đường dẫn cho v5**.

### (3) nginx có cấu hình WebSocket/realtime (Supabase realtime) và SSL self-signed?

**ĐÃ SỬA 3 bug nghiêm trọng trong `nginx/nginx.conf`:**
1. **Thiếu wrapper `events{}` + `http{}`** → file ghi đè toàn bộ `/etc/nginx/nginx.conf` nhưng đặt `upstream`/`server` ở root → nginx **từ chối khởi động** ("no events section" / "directive not allowed"). Đã bọc đúng cấu trúc `events { ... } http { ... }` (kèm `mime.types`, gzip, logging).
2. `upstream cencom_backend { server 127.0.0.1:3000; }` → **SAI**. Nginx chạy trong container riêng → `127.0.0.1` không tới được `cencom-web`. Đã đổi thành `cencom-web:3000` (tên service Docker network).
3. `ssl_certificate /etc/ssl/cencom/cert.pem` + `ssl_certificate_key .../key.pem` → **SAI**. Compose mount `./nginx/certs:/etc/nginx/certs`. Đã đổi thành `/etc/nginx/certs/server.crt` + `/etc/nginx/certs/server.key` (khớp với `init_certs.sh` / `init_certs_win.ps1` sinh ra).

- **WebSocket / SSE:** thêm `map $http_upgrade $connection_upgrade` (chuẩn nginx) và location `/api/realtime` (SSE, `proxy_buffering off`, timeout 3600s). **Quan trọng:** realtime của v5 là **SSE qua `EventSource` tới `/api/realtime`** (không phải WebSocket/Supabase Realtime) → đã được hỗ trợ. Với v4, có sẵn block `location /realtime` (Supabase Realtime WebSocket) **đã comment sẵn** để bật khi deploy bản v4.
- **SSL self-signed:**
  - `init_certs.sh` (Linux/WSL): sinh `server.crt`+`server.key` (PEM) vào `nginx/certs` → ✅.
  - `init_certs_win.ps1`: **ĐÃ SỬA** — trước đây chỉ sinh `server.crt`+`server.pfx`, **thiếu `server.key` (PEM)** → nginx container không chạy được. Giờ ưu tiên WSL openssl sinh cả cặp, fallback qua cert store + openssl Win.
  - `init_ssl.sh`: ghi vào `/etc/ssl/cencom` (host Linux) → **trái với mount container** (`nginx/certs`). Coi như redundant; khuyên dùng `init_certs.sh`.
- **Health:** `location /api/health` proxy tới app. App v5 `app/api/health/route.ts` trả JSON có `"ok": true` → healthcheck Dockerfile `grep 'ok'` hoạt động.

### (4) Scripts init_certs / init_db / deploy / backup có hợp lệ không?

| Script | Trạng thái | Ghi chú |
|---|---|---|
| `init_certs.sh` | ✅ OK | Sinh PEM đúng thư mục. |
| `init_certs_win.ps1` | ✅ **ĐÃ SỬA** | Trước: thiếu `server.key` (PEM). Giờ sinh cả cặp. |
| `init_certs_node.js` | ⚠️ VẪN LỖI | Dùng `crypto.X509Certificate.create` (không tồn tại) → không chạy. Script phụ trợ, khuyên dùng `init_certs.sh`. (Chưa sửa: cần thư viện `selfsigned`, nằm ngoài luồng chính.) |
| `init_db.sh` | ✅ OK cho v4 / ❌ sai path cho v5 | Copy `../packages/db/schema.sql` + `tsx src/seed.ts` → chỉ đúng v4. |
| `init_db.ps1` | ⚠️ Windows/v4 | Hardcode `E:\...\packages\db` + password khác `.env`. |
| `deploy_local.sh` | ✅ OK | Build + up. |
| `deploy_server.sh` | ✅ OK (nhỏ) | Remote script dùng `docker-compose` v1 → nên nâng `docker compose` v2. Copy `supabase/migrations` (v4). |
| `deploy.sh` | ✅ **ĐÃ SỬA** | Trước: trỏ `docker-compose.prod.yml` + `.env.prod` (không tồn tại) → script chết. Giờ mặc định `docker-compose.yml` + `.env.onpremise.local`. |
| `backup.sh` | ✅ **ĐÃ SỬA** | Trước: `source .env.prod` (không tồn tại) + container `cencom_v5_db` (không tồn tại). Giờ đọc `../.env`, container `supabase-db` (override `DB_CONTAINER`), giữ 30 ngày. |
| `restore.sh` | ✅ **ĐÃ SỬA** | Tương tự backup.sh. |
| `setup_cron_backup.sh` | ✅ **ĐÃ SỬA** | Trước: trỏ `scripts/backup/pg_backup.sh` (không tồn tại; thực tế là `scripts/backup.sh`). Giờ trỏ đúng. |
| `setup_firewall.sh` | ✅ OK | LAN-only. |

Tất cả script đã sửa đều qua `bash -n` (RC=0) và `.ps1` qua PowerShell parser.

---

## 2. CÁC ĐIỂM CẦN BỔ SUNG / CHƯA KHỚP (GAP ANALYSIS)

1. **`next.config.js` v5 thiếu `output:'standalone'`** → Dockerfile.standalone chưa dùng được cho v5. (WS7)
2. **Onpremise đang shaped cho v4 Supabase**, không khớp v5 (pure PG, flat `gara_reconstruction_v5/`, không `apps/web`, không `packages/*`, không `supabase/`). **Cập nhật (GĐ3):** v5 đã có bộ Docker riêng tại `gara_reconstruction_v5/` (Dockerfile + docker-compose.yml + nginx.conf + scripts/rollback.sh + scripts/backup.sh). Deploy v5 on-premise dùng trực tiếp `gara_reconstruction_v5/DEPLOY.md` — **KHÔNG cần adapt `Onpremise/`**.
3. **Realtime:** v5 = SSE (`/api/realtime`, Postgres LISTEN/NOTIFY) → nginx mới đã hỗ trợ. v4 = Supabase Realtime (WebSocket) → cần bật block `/realtime` đã comment.
4. **DB init v5:** cần script chạy `tsx db/migrate.ts && tsx db/seed.ts` + `psql ... db/realtime_triggers.sql` (không dùng supabase migrations).
5. **Storage:** v5 lưu file local (`CHAT_IMG_DIR`) → không cần `supabase-storage`.
6. **`.env` vs `.env.onpremise`** password mismatch (cosmetic, runtime vẫn khớp do `environment` override).
7. **`init_certs_node.js`** broken (non-canonical).
8. (Tùy chọn) docker-compose nên dùng `docker compose` v2 nhất quán.

---

## 3. CÁC BƯỚC THỰC TẾ ĐỂ DEPLOY

### 3.1 Hiện tại (stack v4 Supabase — đã verify scripts)
```bash
cd Onpremise
# 1. Cert self-signed
bash scripts/init_certs.sh        # Linux/WSL (Win: powershell -ep Bypass scripts\init_certs_win.ps1)
# 2. Env
cp .env.onpremise .env.onpremise.local
#    sửa SESSION_SECRET = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#    sửa DB_PASSWORD, NEXT_PUBLIC_BASE_URL
# 3. Build + chạy
bash scripts/deploy_local.sh      # hoặc: bash scripts/deploy.sh start | deploy_server.sh
# 4. Init DB (1 lần)
bash scripts/init_db.sh
# 5. Truy cập https://localhost (trust self-signed cert)
# 6. Cron backup: sudo bash scripts/setup_cron_backup.sh
```

### 3.2 Để deploy v5 (sau khi WS7 thêm `output:'standalone'` + C9 tạo Dockerfile v5)
- `docker-compose.yml`: build context → `../gara_reconstruction_v5`, dockerfile v5 mới; thay `supabase-db` bằng `postgres:16-alpine`; **bỏ** `supabase-realtime` / `supabase-storage`.
- `init_db`: đổi thành `tsx db/migrate.ts && tsx db/seed.ts` + apply `db/realtime_triggers.sql`.
- Giữ `nginx/nginx.conf` mới (đã hỗ trợ SSE `/api/realtime`).
- `DATABASE_URL` trong `cencom-web.environment` trỏ `postgresql://postgres:${DB_PASSWORD}@<db-service>:5432/${DB_NAME}`.

---

## 4. ⚠️ LƯU Ý HỆ THỐNG SẢN XUẤT (Production Check)

1. **Còn thiếu gì?** `output:'standalone'` cho v5 (WS7); init DB v5 (`tsx db/migrate.ts`) chưa tự động trong compose; cert self-signed chưa trust trên máy user; firewall chưa chạy; backup chưa test restore thực tế; `init_certs_node.js` đang lỗi (không canonical). **Đã bổ sung:** v5 có Dockerfile + docker-compose.yml + rollback.sh + backup.sh riêng.
2. **Rủi ro ở đâu?** Self-signed gây cảnh báo trình duyệt; nếu sai đường dẫn cert (đã sửa) nginx không khởi động; `${DB_PASSWORD}` nội suy từ `.env` phải khớp với `POSTGRES_PASSWORD` của DB; `supabase-realtime` v4 có thể cần tune memory.
3. **Đã chạy test chưa?** Không deploy thật (task cấm deploy). Đã check cú pháp `bash -n` (RC=0) cho mọi script đã sửa + PowerShell parser cho `.ps1`. Chưa có môi trường Docker thực tế để `docker compose up`.
4. **Đề xuất tiếp theo?** (a) WS7 bật `output:'standalone'`; (b) C9 tạo Dockerfile + `docker-compose.prod.yml` v5; (c) adapt `Onpremise/` theo mục 3.2; (d) test `docker compose up` trên máy dev + verify health + 1 lần restore backup.

---

## 6. V5 DOCKER SETUP (Giai đoạn 3 — P3-B/P3-E)

> **Cập nhật 2026-08-21:** v5 đã có bộ Docker **riêng** tại `gara_reconstruction_v5/`, không phụ thuộc `Onpremise/`.

| File | Vai trò |
|---|---|
| `gara_reconstruction_v5/Dockerfile` | Multi-stage build → standalone Next.js |
| `gara_reconstruction_v5/docker-compose.yml` | Service `web` + `postgres:16-alpine` |
| `gara_reconstruction_v5/nginx.conf` | Reverse proxy → web:3000, SSE `/api/realtime`, SSL |
| `gara_reconstruction_v5/scripts/backup.sh` | pg_dump + retention 7 backups |
| `gara_reconstruction_v5/scripts/rollback.sh` | Git tag checkout + DB restore |
| `gara_reconstruction_v5/scripts/health_check.sh` | Health check `/api/health` |
| `gara_reconstruction_v5/DEPLOY.md` | Hướng dẫn deploy đầy đủ (on-premise + cloud) |

**Quick deploy v5:**
```bash
cd gara_reconstruction_v5
cp .env.example .env    # cấu hình DB
docker compose build
docker compose up -d
bash scripts/rollback.sh v5.0.0  # nếu cần rollback
```

> `Onpremise/` giữ nguyên cho **v4 Supabase stack**. KHÔNG cần merge/resolve giữa v4 và v5.

---

## 5. DANH SACH FILE DA DOI (trong `Onpremise/`)

- `nginx/nginx.conf` — sửa bọc `events{}/http{}` (nginx mới khởi động được); sửa upstream→`cencom-web:3000`; sửa đường dẫn cert→`/etc/nginx/certs/server.{crt,key}`; thêm `map` upgrade + location `/api/realtime` (SSE); comment sẵn block `/realtime` cho v4.
- `scripts/backup.sh` — sửa nguồn env (`../.env`) + container (`supabase-db`).
- `scripts/restore.sh` — sửa tương tự backup.sh.
- `scripts/setup_cron_backup.sh` — sửa đường dẫn script backup thực tế.
- `scripts/deploy.sh` — sửa trỏ `docker-compose.yml` + `.env.onpremise.local` (bỏ `.prod` không tồn tại).
- `scripts/init_certs_win.ps1` — sửa sinh cả `server.key` (PEM) cho nginx container.

> Chưa đổi (chỉ ghi chú): `docker-compose.yml`, `Dockerfile.standalone`, `init_db.sh`/`init_db.ps1` (path v4), `init_certs_node.js`, `init_ssl.sh`, `deploy_server.sh` (v1→v2).
