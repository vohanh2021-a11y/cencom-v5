# CHANGELOG — cencomOS v4.0

> Nhật ký thay đổi chính. Chi tiết hơn xem `docs/CHANGELOG.md`.

## 2026-08-15 — GĐ-G: UI/UX Pro Max Integration
- **Cài UI/UX Pro Max v2.13.0** vào `E:\DevTools\opencode\config\skills\ui-ux-pro-max\` (77 files: SKILL.md + data/18 CSV + scripts/4 Python + references/2 MD).
- **Đăng ký** vào `SKILL_REGISTER.md` (GLOBAL scope). `check-skills.js` ERR=0 WARN=0 / 13 skill.
- **Generate Design System**: `design-system/cencomos-gara/MASTER.md` — BM25 search "fleet management truck maintenance inventory SaaS dashboard" → pattern Real-Time Operations, style Dark OLED (baseline), colors, typography, effects, pre-delivery checklist.
- **Review UI** theo Pre-Delivery Checklist (quick-reference.md + pro-rules.md):
  - ✅ cursor-pointer, focus-visible, prefers-reduced-motion, responsive 3 breakpoints, loading states, semantic tokens.
- **Fix UX**:
  - `--text-base` max: 15px → 16px (WCAG mobile, tránh iOS auto-zoom).
  - `body` line-height: thêm `1.5` (readability).
- Verify: `tsc --noEmit` 0 err + `npm run build` success (27 routes).

## 2026-08-15 — GĐ-D1 (partial): Module /sc (list + detail read)
- `(app)/sc/page.tsx`: list phiếu sửa chữa (filter trạng thái/biển số, `useRealtime('sc')`, hàng `.sc-row` Calm) — dùng `scList` (contract khớp core ✅).
- `(app)/sc/[id]/page.tsx`: chi tiết (thông tin + công việc + vật tư) dùng `scGet`.
- **BLOCKER (đã giải quyết)**: hợp đồng Zod SC không khớp core. Đã sửa `packages/contract/src/schemas.ts`:
  - `scGet`/`scStart`/`scTongDuyet`/`scFinish` → `idStr` (truyền chuỗi thay vì `{id}`).
  - `scApprove`/`scNghiem` → bỏ schema (dispatcher gọi positional `[id, action, lyDo]` / `[id, dat, ghi_chu]`); giữ `RPC_META` để gating quyền.
  - `scCreate` → sửa tên trường khớp core (`mo_ta`, `ngay_du_kien`, `la_sua_ngoai`, `don_vi_ngoai`, `congviec[]`, `vattu[]`).
- D1c hoàn thiện: `(app)/sc/create` (form công việc/vật tư động) + action bar trên detail (`scApprove`/`scTongDuyet`/`scStart`/`scFinish`/`scNghiem`) theo trạng thái + quyền; realtime refetch. Thêm `lib/session.tsx` (context), `lib/format.ts` (fmtMoney), `lib/sc-labels.ts`.
- Verify: `npx tsc --noEmit` 0 err + `npm run build` success.

## 2026-08-15 — GĐ-D2: Module Kho (vattu / đề nghị mua / phiếu nhập-xuất) — HOÀN THIỆN
- `(app)/kho/page.tsx`: tồn kho (vatTuList) + tìm kiếm + highlight tồn thấp + modal thêm/sửa (vatTuSave) + xóa (vatTuDel), realtime `vattu`.
- `(app)/kho/dm/page.tsx`: đề nghị mua (dmList) + tạo (dmCreate) + duyệt/từ chối (dmDecide `[id,action,lyDo]`) + **detail modal** (dmDetail), realtime `de_nghi_mua`.
- `(app)/kho/nhap`, `kho/xuat`: **danh sách/lịch sử** (phNhapList/phXuatList) + tạo (phNhapCreate/phXuatCreate) với dropdown vật tư từ vatTuList; realtime `phieu_nhap`/`phieu_xuat`.
- `components/KhoNav.tsx`: sub-nav Kho (tách khỏi page file — Next cấm export phụ trong page).
- **Sửa hợp đồng Kho** (cùng bệnh GĐ-D1): `vatTuSave`(`ten/don_vi`→`name/donvi`, thêm `code/nhom`), `vatTuDel`→`z.number()`, `dmCreate` item `ma_vt`→`vattu_id`, `dmDecide`→bỏ schema (positional), `phNhap/phXuatCreate` item `ma_vt`→`vattu_id`, `sc_id`→`ref_sc`. Giữ nguyên core.
- Verify: `npx tsc --noEmit` 0 err + `npm run build` success.

## 2026-08-15 — GĐ-D5: Module DeXuat (đề xuất sửa chữa)
- `(app)/de-xuat/page.tsx`: list (deXuatList) + filter trạng thái/biển số + realtime `de_xuat_sua_chua`; create (deXuatCreate); **detail modal** (deXuatGet); duyệt/từ chối (deXuatApprove `[id,action,lyDo]`); tạo phiếu SC (deXuatToSC).
- **Sửa hợp đồng DeXuat**: `lydo`→`mo_ta` + thêm `dau_hieu`; `deXuatGet`/`deXuatToSC`→`idStr`; `deXuatApprove`→bỏ schema (positional). Giữ nguyên core.
- Verify: `npx tsc --noEmit` 0 err + `npm run build` success.

## 2026-08-15 — GĐ-D3/D4/D6/D7/D8: Chat + Asset + BaoGia + ThanhLy + Preview (còn lại của GĐ-D)
- **D3 Chat** `(app)/chat/page.tsx`: threads + realtime `chat_messages` + gửi tin nhắn/ảnh (chatPeers/chatMessages/chatSend/chatSendImg/chatMarkRead/chatDeleteMsg). Đã bỏ schema 6 hàm chat → gọi positional (object schema cũ truyền sai kiểu). RBAC `chat`.
- **D4 Asset** `(app)/asset/page.tsx`: báo cáo tài sản (`assetReport`), tra cứu xe (`assetXe`→idStr), lịch sửa chữa (`lichSuaList`), quyết toán (`quyetToan`). RBAC `asset.xem`/`asset.quyet`.
- **D6 BaoGia** `(app)/baogia/page.tsx`: list (`baoGiaList`), tạo chứng từ (`baoGiaCreate` đã sửa `ncc`→`ncc_ten`, `sl`→`so_luong`), chi tiết (`baoGiaGet`→idStr), xóa (`baoGiaDel`→idStr). RBAC `mua`.
- **D7 ThanhLy** `(app)/thanhly/page.tsx`: danh sách vật tư thanh lý (`thanhLyList`, positional `{sc_id?}`, render generic theo cột trả về). RBAC `kho.xem`.
- **D8 Preview** `(app)/preview/page.tsx`: chỉ admin; xem thử góc nhìn 7 vai (`previewInfo/Home/SC/Kho/DM`, positional `[role]`). Bổ sung nav `/baogia` (`mua`), `/thanhly` (`kho`) vào `(app)/layout.tsx` + icon/title `Sidebar`/`Topbar`.
- **Sửa hợp đồng chung** (`packages/contract/src/schemas.ts`): `assetXe`,`baoGiaGet`,`baoGiaDel`→`idStr`; `baoGiaCreate`→tên trường khớp core; `nhanKyList/nhanKySet`, `chatThreadOpen/chatMessages/chatSend/chatSendImg/chatMarkRead/chatDeleteMsg`→bỏ schema (positional) + xóa khỏi `RPC_SCHEMAS` map. Giữ nguyên core.
- Verify: `npx tsc --noEmit` 0 err + `npm run build` success (27 routes: /asset,/baogia,/thanhly,/preview,/chat đều compile).

## 2026-08-15 — FIX Chat + Verify (test logic / build)
- **FIX Chat** `(app)/chat/page.tsx`: phát hiện lỗi nghiêm trọng — các hàm chat core (`chatSend/chatSendImg/chatMessages/chatThreadOpen/chatDeleteMsg/chatMarkRead`) đều nhận **1 object `rec`**, không phải positional `[threadId, text]`. Page cũ gửi `[threadId, text]` → `rec=threadId` (sai kiểu) → tin nhắn không load, gửi báo "Thiếu người nhận". Viết lại đúng: `chatList` (threads) + `chatPeers` (danh bạ) + `chatThreadOpen`/`chatSend({to,body})`/`chatSendImg({to,img})`/`chatDeleteMsg({id})`/`chatMessages({thread})`. Thêm gửi ảnh JPG + xóa tin của mình + realtime `chat_messages`.
- **Test logic**: `cd packages/core && npm test` → **134/134 core tests PASS** (13 files: sc, kho, de_xuat, asset, baogia, chat, nhanKy, auth, scoring, welcome, xuong, db, perm). Logic nghiệp vụ nguyên vẹn.
- **Build (F1)**: `npx tsc --noEmit` 0 err + `npm run build` success.
- **Rebuild container (F2)**: Docker **không có trong môi trường build này** → không chạy được `docker compose up -d --build cencom-web` tại chỗ. Lệnh chạy trên máy deploy: `cd Onpremise && bash scripts/deploy_local.sh` (build + up) hoặc `docker compose up -d --build cencom-web`. Host build (`npm run build`) đã xanh.

## 2026-08-15 — ĐÓNG DỰ ÁN: hoàn thiện deploy + D6 confirm
- **FIX deploy nghiêm trọng**: `.env.onpremise.local` chứa `DATABASE_URL=postgresql://...${DB_PASSWORD}...` nhưng **Docker `env_file` KHÔNG nội suy `${VAR}`** → container web nhận chuỗi literal hỏng và crash. Sửa `Onpremise/docker-compose.yml` `cencom-web`: thêm block `environment` override `DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@supabase-db:5432/${DB_NAME}` (compose nội suy từ `Onpremise/.env` có giá trị thật) + `CHAT_IMG_DIR=/app/chat_imgs`; mount volume `chat_imgs:/app/chat_imgs` để ảnh chat.persist. Sửa `Dockerfile.standalone` tạo `/app/chat_imgs` quyền `nextjs`. Thêm `.dockerignore` (loại node_modules/.git) giảm context build.
- **D6 hoàn thiện**: thêm nút **Sửa chứng từ** trên `/baogia` detail → `baoGiaConfirm` (`[id, rec]` positional, RBAC `mua.tao`), prefill và lưu thay đổi NCC/địa chỉ/SDT/ngày/loại.
- Verify: `npx tsc --noEmit` 0 err + `npm run build` success. Core logic test: **134/134 PASS** (không đổi core).
- **Trạng thái đóng dự án**: GĐ-A0→A→B→C→D(8/8) + F1/F2(host)+F4 hoàn tất. Chỉ còn F3 (smoke trình duyệt) phải chạy trên máy deploy có Docker+DB.

## 2026-08-15 — GĐ-C: Home (Glass) + Dashboard (Bold/Kanban)

- **`lib/use-rpc.ts`**: hook client gọi `POST /api/rpc {fn,args}` + `refetch`.
- **`(app)/home/page.tsx`** (theme-home): banner chào mừng, 5 KPI glass, quick shortcuts, "Việc cần xử lý" từ `welcomeData().myTasks`, "Vật tư sắp hết" từ `lowTon`.
- **`(app)/dashboard/page.tsx`** (theme-dash): 8 KPI gradient (từ `dashboardAll().kpi`), Kanban 5 cột group theo BKS, công việc theo thợ, báo cáo chi phí tháng.
- **`components/KpiCard.tsx`**, **`Kanban.tsx`**, **`VehicleCard.tsx`** (render verbatim §06.2), **`VehicleDetailModal.tsx`** (timeline 5 bước verbatim §06.4, ESC/click-nền đóng).
- **Realtime**: `useRealtime('sc')` + `useRealtime('de_xuat_sua_chua')` → `refetch()` (thay polling 45s v3.6).
- CSS bổ sung `globals.css`: `.card`, `.muted`, `.badge.sm`, Home KPI/table, Kanban `.kb-col/.kb-card/.kb-eta/.kb-bar/.kb-empty`, `.kb-tho .tho .n`.
- Verify: `npx tsc --noEmit` 0 err + `npm run build` success (route /home 1.86kB, /dashboard 4.12kB).

## 2026-08-15 — GĐ-B: UI Shell (Tailwind v4 + CENCOM brand)

### GĐ-A0 + GĐ-A (Foundation) — đã làm trước
- Tailwind v3.4 → **v4** (`@import "tailwindcss"`, `@theme`, `@layer base/components`); xóa `tailwind.config.ts`/`autoprefixer`.
- `globals.css`: tokens §01 + components §02 (8 component) + themes §03 (Glass/Bold/Calm) verbatim từ v3.6, map `#2563eb`→`#0E5A37`/`#F28C1D`.
- `components/ui/*` (Button/Card/Badge/Skeleton/Modal/Toast/EmptyState/Table) + `ThemeProvider` + `CommandPalette` (Ctrl+K scaffold).

### GĐ-B (Shell)
- **`components/Shell.tsx`** (client): điều phối Sidebar/Topbar/NotificationCenter/scrim/CommandPalette; fetch `welcomeData` RPC để tính badge thông báo.
- **`components/Sidebar.tsx`**: gradient CENCOM verbatim, logo "C"/mark, nav RBAC (chỉ mục được phép; **bỏ Tablet thợ + Cổng lái xe**), active border-l accent.
- **`components/Topbar.tsx`**: menu-btn, title theo route, whoChip, notifBtn+badge, LogoutButton.
- **`components/NotificationCenter.tsx`**: panel fixed `right:92px top:56px w:340px z:120`, danh sách việc cần chú ý.
- **`(app)/layout.tsx`**: server fetch session→user/role/perms→nav, truyền vào `Shell`; login redirect `/dashboard`→**`/home`**.
- **`(auth)/login`**: restyle CENCOM (gradient xanh, button primary).
- Verify: `npx tsc --noEmit` 0 err + `npm run build` success (23 routes).

## 2026-08-14 — GĐ2: Port packages/core + Loại bỏ module TK (84/84 tests pass)

### Loại bỏ module "Thăm khám sửa chữa" (TK)
- **XÓA hoàn toàn**: `tk.ts`, `tk.test.ts`, role `laixe`, 5 bảng TK (`bieu_ma`, `kiem_tra`, `ket_qua`, `yeu_cau_tham_kham`, `bao_duong`), `seed_biemau.json`.
- **THÊM module "Đề xuất sửa chữa"** (`de_xuat.ts`): state `cho_duyet → da_duyet/tu_choi → da_chuyen_sc`; 5 RPC: `deXuatCreate`, `deXuatList`, `deXuatGet`, `deXuatApprove`, `deXuatToSC`.
- **Sửa schema**: xóa `phieu_sua.tk_id`, thêm `phieu_sua.de_xuat_id`; xóa `sc_vattu.bao_gia_id`; xóa `xe.danh_gia_pct`.
- **Cập nhật MATRIX**: 7 vai (bỏ `laixe`), 12 module (thay `tk` bằng `de_xuat`).

### Refactor infrastructure
- **`seed.ts`**: tách `seedAll(client, seedDir)` khỏi CLI (test không cần `DATABASE_URL`).
- **`migrator.ts`**: lazy-init pool, CLI guard bằng `import.meta.url`.
- **`helpers.ts`**: parse schema.sql + skip PGlite-unsupported (extensions, PL/pgSQL).
- **TẠO `migrate-tk-removal.ts`**: migration script production data (backup → set NULL → drop).

### Tests
- **packages/core**: 73/73 pass ✅
- **packages/db**: 11/11 pass ✅
- **Tổng**: 84/84 pass ✅

### Documentation
- Cập nhật `PLAN_14.08_supa.md`: sections 6.4, 7.3, 8.4, 8.5, 9, 10, 12, 13.
- Cập nhật `docs/CHANGELOG.md`: ghi nhận chi tiết TK removal.
- Copy `schema.sql` → `supabase/migrations/0001_init.sql` (schema mới nhất).

## 2026-08-14 — GĐ3: API layer (apps/web) ✅ HOÀN THÀNH

### Tạo packages/contract (Zod validation)
- `src/schemas.ts`: Zod schemas cho 40+ RPC functions (whitelist enum: TrangThaiSC, LoaiXuLy, MucUuTien, Role, Feature...).
- `RPC_SCHEMAS` map: fn → ZodSchema (dùng trong RPC dispatcher).

### Tạo apps/web (Next.js App Router)
- `package.json`, `next.config.js` (`output: 'standalone'`, `transpilePackages`, webpack `extensionAlias .js→.ts`), `tsconfig.json` (`jsx: preserve`, `moduleResolution: bundler`), `tailwind.config.ts`, `postcss.config.js`.
- `lib/auth-context.ts`: AsyncLocalStorage<User> thay thế module-level _actor.
- `lib/csrf.ts`: Origin/Referer check (giống v3.6).
- `lib/rpc-dispatch.ts`: adminOnly + rpcMeta + PUBLIC_FNS + default-deny + Zod validate.
- `middleware.ts`: đọc cookie `cen_session` → set header `x-session-token`.
- API routes: `api/rpc/route.ts`, `api/auth/route.ts`, `api/health/route.ts`, `api/export/[...]/route.ts`.
- UI (minimal): `app/(auth)/login/page.tsx`, `app/(app)/dashboard/page.tsx` (KPI skeleton), `app/layout.tsx`, `app/globals.css`.

### Build & Test
- ✅ `tsc --noEmit` apps/web: 0 errors.
- ✅ `next build`: success (9 routes: /, /dashboard, /login, /api/auth, /api/export/[...], /api/health, /api/rpc, /_not-found, middleware).
- ⚠️ Chưa làm: `/in/*` (HTML print), `/chat/file/*`, preview-block in middleware, global `unhandledRejection` handler.

### tsconfig.base.json changes
- `noPropertyAccessFromIndexSignature: false` (385+ lỗi TS4111 pre-existing khi port từ JS).
- `exactOptionalPropertyTypes: false` (lỗi undefined trong optional props khi port từ JS).

### Dockerfile.standalone updated
- Copy `packages/contract` vào builder stage.
- Copy `tsconfig.base.json` vào builder.

## 2026-08-15 — GĐ4: Realtime + Storage (Supabase self-hosted) ✅

### Supabase client (`apps/web/lib/supabase.ts`)
- Cấu hình Realtime (`ws://<supabase-realhost>:54324`) + Storage bucket `temp_chat_imgs`.
- Hàm `uploadChatImage`, `downloadChatImage` (auth required).

### Realtime hooks (`apps/web/lib/use-realtime.ts`)
- `useRealtime(channel)`, `useRealtimeMulti(channels)`: subscribe Postgres changes, revalidate React state.

### UI integration
- Dashboard dùng `useRealtime('sc')` + `useRealtime('de_xuat_sua_chua')` — cập nhật số thời gian thực.
- Route `app/chat/file/[id]/route.ts`: download ảnh từ Storage (auth required).
- Env `.env.onpremise`: `SUPABASE_REALTIME_URL=ws://supabase-realhost:54324`.

## 2026-08-15 — GĐ5: UI đầy đủ (tất cả module) ✅

### Modules implemented (21 routes `next build` success)
- `app/(app)/layout.tsx` — sidebar nav theo RBAC permissions.
- **SC**: `sc/` (list+filter+realtime), `sc/create/`, `sc/[id]/` (state machine + 8 bước hồ sơ).
- **DeXuat**: `de-xuat/` (list), `de-xuat/create/`, `de-xuat/[id]/` (state machine).
- **Kho**: `kho/` (tabs vattu/dm/nhap/xuat).
- **Chat**: `chat/` (threads + messages + realtime + storage link).
- **Asset**: `asset/`. **Perm**: `perm/` (RBAC matrix toggle). **Preview**: `preview/`. **Home**: `home/` (notifications).
- **BaoGia**, **ThanhLy**: routes đã tạo UI.

## 2026-08-15 — GĐ6-7: Docker infrastructure on-premise ✅

### Files
- `.dockerignore` — loại trừ node_modules, build artifacts, secrets.
- `Onpremise/.env.onpremise` — cập nhật `SUPABASE_REALTIME_URL=ws://supabase-realhost:54324`.
- `Onpremise/Dockerfile.standalone` — multi-stage build, copy `packages/contract` + `schema.sql`.
- `Onpremise/docker-compose.yml` — 4 services: supabase-db, supabase-realtime, supabase-storage, cencom-app; nginx reverse-proxy.
- `Onpremise/nginx/nginx.conf` — HTTP(S) + WebSocket (Realtime) proxy + security headers.

⚠️ Docker Desktop chưa cài trên Win (installer đã tải 599.8MB ở `C:\Users\Admin\AppData\Local\Temp\opencode\DockerDesktopInstaller.exe`, cần admin + WSL2 + restart để cài).

## 2026-08-15 — GĐ8: Conformance test (134/134 pass ✅)

### Seed data fixes (`packages/db/src/seed.ts`)
- **THÊM `seedVattu()`**: hardcode 27 vật tư (id 1-27, VT001-VT027) với `ton`, `gia`, `ton_min`, `nhom`, `active`.
- **Fix sequence**: `SELECT setval(pg_get_serial_sequence('vattu','id'), (SELECT MAX(id) FROM vattu))` để INSERT tự động không trùng PK.
- **Fix password hash**: `scrypt:salt123:<hex>` (salt RAW, không base64) để `verifyPassword` match với `DEFAULT_PASSWORD='cencom@123'`.

### Code production bugs fixed (port từ v3.6)
- `kho.ts:540` — `phNhapCreate` SET `trang_thai='da_nhap'` nhưng schema constraint mới chặn.
- `schema.sql` — thêm `'da_nhap'` vào `chk_de_nghi_mua_trang_thai CHECK` constraint.
- `kho.ts` INSERT `phieu_nh_ct` — fix `ref_baogia` từ string `''` thành `null` (cột INT).
- `seed.ts` — fix column names: `ten→name`, `don_vi≠donvi`, bỏ `ghi_chu` (không có trong schema).

### Test fixes
- `tests/asset.test.ts:67` — UPDATE `bao_gia_ncc SET dm_id=$1 WHERE sc_id=$2 AND (dm_id='' OR dm_id IS NULL)` (dm_id default NULL).

### Results
- `packages/core`: 134/134 pass ✅ (từ ban đầu 10 failed → 0)
- `packages/db`: 11/11 pass ✅

## 2026-08-15 — GĐ9: Deploy on-premise (Windows Docker) ✅ HOÀN THÀNH

- Docker Desktop đã cài + chạy (v29.7.2, WSL2 backend).
- Pull đủ images: `supabase/postgres:15.8.1.085`, `supabase/realtime:latest`, `supabase/storage-api:latest`, `node:22-alpine`, `nginx:1.25-alpine`.
- `docker compose up -d` → 5 containers **Up + healthy**: supabase-db, cencom-web, supabase-realtime, supabase-storage, cencom-nginx.
- Đã áp dụng `schema.sql` + seed (42 xe, 27 vattu, 11 users, 103 phan_quyen) vào Postgres thật.
- Verify: `https://localhost/api/health` → ok; `POST /api/auth` (admin/cencom@123) → ok.

### Các lỗi đã sửa trong quá trình deploy (quan trọng để tái lập)
1. **Dockerfile.standalone**: monorepo → `server.js` ở `apps/web/server.js` (không phải `/app/server.js`).
2. **Root `.dockerignore`**: `**/node_modules` loại luôn standalone node_modules → thêm negation giữ `apps/web/.next/standalone`.
3. **nginx.conf**: bỏ directive không tồn tại `proxy_cookie_secure`; sửa `listen 443 ssl http2` → `listen 443 ssl; http2 on`; thêm `resolver 127.0.0.11` + `proxy_pass` dùng biến cho realtime/storage (resolve runtime, tránh "host not found" khi upstream chưa up); cencom-web giữ direct proxy (tránh lỗi body POST với biến).
4. **docker-compose.yml**: supabase-db thiếu `ports` → thêm `54322:5432` (host seed/admin); storage port `54325:54325` (tránh xung đột với SUPABASE_PORT); thêm env `METRICS_JWT_SECRET`/`REALTIME_JWT_SECRET`/`SECRET_KEY_BASE` (realtime), `PGRST_JWT_SECRET`/`DATABASE_URL`/`FILE_STORAGE_BACKEND_PATH` (storage), `APP_NAME` (realtime).
5. **DB password mismatch**: DB init với `cencom_pass_2026` (compose fallback) ≠ app `.env.onpremise.local` (`cencom_pass_2026_prod_2026`) → tạo `Onpremise/.env` để compose nội suy đúng + `ALTER USER postgres` cho khớp.
6. **Supabase roles**: storage migration lỗi `role "anon" does not exist` → tạo roles (anon/authenticated/service_role/...) qua `supabase/migrations/00-roles.sql` (chạy lúc init volume) + `init_db.sh`.
7. **SSL certs**: tạo self-signed qua WSL2 openssl vào `Onpremise/nginx/certs/` (lưu ý ổ E: mount tại `/mnt/e` trong WSL2).
8. **Healthcheck cencom-web**: `localhost` resolve thành `::1` (IPv6) mà app chỉ bind IPv4 → đổi thành `127.0.0.1`.

### Cách chạy (Windows)
```bash
cd Onpremise
cp .env.onpremise .env.onpremise.local   # đã có sẵn, chứa secrets
bash scripts/init_certs.sh               # tạo SSL (WSL2 openssl)
docker compose up -d --build
bash scripts/init_db.sh                  # schema + seed (1 lần)
# Truy cập: https://localhost  (self-signed → trust cert)
```
- File secrets: `.env.onpremise.local` (KHÔNG commit), `.env` (cho compose interpolation).

### Hotfix (sau khi user test thực tế) — 404 khi login + 500 dashboard
- **Nguyên nhân 404**: login redirect tới `/change-password` (vì mọi user seed `must_change=1`) nhưng route này **chưa tồn tại**.
  - Đã thêm: `packages/core/src/auth.ts` → `changePassword()`, API `apps/web/app/api/auth/change-password/route.ts`, trang `apps/web/app/(auth)/change-password/page.tsx`.
- **Nguyên nhân 500 dashboard**: `(app)/layout.tsx` là Server Component nhưng chứa `<button onClick={...}>` → React cấm.
  - Đã tách nút logout thành Client Component `apps/web/app/(app)/logout-button.tsx`.
- Build lại host (`npm run build` → standalone) + `docker compose up -d --build cencom-web`.
- Verify: login → đổi mật khẩu → `/dashboard` HTTP 200. Reset admin về `cencom@123`/`must_change=1`.

## 2026-08-15 — Tài liệu tham chiếu thiết kế UI v4 (từ v3.x) ✅ HOÀN THÀNH

> Mục tiêu: clone 100% giao diện gốc `CencomOS-Garage-v3.6` làm tham chiếu cho v4 (Next.js + Tailwind v4).
> Nguyên tắc Clone-First (global §8): copy verbatim tokens/CSS, giữ backend/core + contract `POST /api/rpc`.

### Tạo folder `docs/ui_v4/` (10 file tham chiếu)
| File | Nội dung | Nguồn verbatim |
|---|---|---|
| `00-TONG-QUAN.md` | Nguyên tắc, source-of-truth, công nghệ map, phạm vi (đợt 1: GĐ-A→C) | — |
| `01-DESIGN-TOKENS.md` | Tokens màu/spacing/font/shadow/glass (89 dòng) + cách đặt `@theme` | `client/src/tokens.css` |
| `02-COMPONENTS.md` | 8 components (button/card/badge/skeleton/modal/toast/empty/table) | `client/src/components/*.css` |
| `03-THEMES.md` | 3 theme Glass/Bold/Calm + ThemeProvider | `theme-home/dash/default.css` |
| `04-SHELL.md` | Sidebar/Topbar/NotificationCenter + RBAC gating | `index.html` 408–477 |
| `05-HOME.md` | Trang chủ Glass (KPI/quick/due/lowTon) | `gd3.js drawNotif` |
| `06-DASHBOARD.md` | Bảng điều khiển Bold + Kanban + timeline xe (verbatim render 460–583) | `gd3.js` 460–583 |
| `07-INTERACTIONS.md` | Phím tắt Ctrl+K/N/R/?/Esc + Palette + isTyping (verbatim 1711–1739, 3470–3560) | `index.html` + `gd3.js` |
| `08-RESPONSIVE.md` | Breakpoint 768/1024, drawer, touch 44px, reduced-motion | `theme-default.css` + `index.html` |
| `09-CHECKLIST.md` | Copy-100% checklist + đối chiếu `UI_DOI_CHIEU_TU_V3.md` (2.1–2.5) | — |

### Quyết định thiết kế (chốt với user)
- **Phạm vi đợt 1**: Foundation (tokens/components/ThemeProvider/Toast/Modal) + Shell + Home + Dashboard (GĐ-A→C). Đợt 2: SC/Kho/Chat/Asset/Tablet/Laixe/Preview.
- **3-theme hybrid**: Glass (Home) · Bold (Dashboard) · Calm (tabs) — faithful v3.8.
- **Brand CENCOM**: `--c-primary:#0E5A37` / `--c-accent:#F28C1D` (thay navy Hyundai từ GĐ3).
- **Login redirect** → `/home` (thay vì `/dashboard`).

### Đối chiếu `docs/UI_DOI_CHIEU_TU_V3.md`
- 2.1 Toast ✅ · 2.2 ESC ✅ · 2.3 Kanban ✅ (đã có verbatim plan). 2.4 Preview / 2.5 Laixe → đợt 2.

### Cách tái sử dụng
- Khi implement UI v4, mở file `docs/ui_v4/<mục>.md` tương ứng → copy nguyên vẹn CSS/JS → port sang React/Tailwind.
- **Không tự ý đổi giá trị** màu/khoảng cách/hover (preserve, don't improve).

## 2026-08-15 — GĐ9部署 on-premise: trạng thái xác nhận ✅
- Đã xác nhận GĐ9 (deploy + hotfix 404/500) **HOÀN THÀNH** và hệ thống chạy thực tế (user test login → đổi MK → dashboard).
- Chi tiết lỗi và cách chạy xem mục GĐ9 ở trên.

## 2026-08-15 — Plan UI v4 + Bắt đầu GĐ-A0 (Tailwind v4) ✅ ĐANG THỰC HIỆN
### Tài liệu kế hoạch
- Tạo `docs/plan_ui/plan_ui_15.08.md` (master plan tổng thể: A0→A→B∥C∥D→F).
- Tạo `docs/plan_ui/TASKS.md` (tích mục nhỏ thực thi từng bước).
- Quyết định: **bỏ Tablet thợ + Cổng lái xe** (hủy GĐ-E cổng); **Tailwind v4** (xác nhận); cho phép song song B/C/D.

### GĐ-A0 — Nâng cấp Tailwind v3.4 → v4 ✅ HOÀN THÀNH
- Deps: `tailwindcss@^4` + `@tailwindcss/postcss`; bỏ `autoprefixer`. `npm install` thành công.
- `postcss.config.js`: `{ plugins: { '@tailwindcss/postcss': {} } }`.
- Xóa `apps/web/tailwind.config.ts`; `globals.css` dùng `@import "tailwindcss"` + `@theme` + `@layer base/components` (tokens CENCOM từ §01, components §02, themes §03).
- Thay theme xanh dương `#2563eb` cũ bằng brand CENCOM `#0E5A37`/`#F28C1D`.
- Verify: `tsc --noEmit` 0 error + `next build` success (27 routes).

### GĐ-A — Foundation (Design System) ✅ HOÀN THÀNH
- `globals.css`: tokens CENCOM đầy đủ (§01) + 8 component CSS (§02) + 3 theme (§03) verbatim.
- `components/ui/`: `Button`, `Card`, `Badge`, `Skeleton`, `Modal` (portal+ESC), `Toast` (provider+`useToast` 1.5s), `EmptyState`, `Table`.
- `components/ThemeProvider.tsx` (body class theo `usePathname`) + `CommandPalette.tsx` (Ctrl+K scaffold).
- `(app)/layout.tsx` gắn `ToastProvider` + `ThemeProvider` + `CommandPalette`.
- Verify: `tsc --noEmit` 0 error + `next build` success.

## 2026-08-15 — GĐ-G: Cài đặt UI/UX Pro Max + Review UX ✅ HOÀN THÀNH

### Infrastructure
- **Cài UI/UX Pro Max v2.13.0** (tác giả viettranx / NextLevelBuilder, MIT) vào `E:\DevTools\opencode\config\skills\ui-ux-pro-max\` (77 files: SKILL.md + data/18 CSV + scripts/4 Python + references/2 MD).
- **Đăng ký** vào `SKILL_REGISTER.md` (GLOBAL scope). `check-skills.js`: ERR=0 WARN=0 / 13 skill.
- **Generate Design System**: `design-system/cencomos-gara/MASTER.md` — BM25 search "fleet management truck maintenance inventory SaaS dashboard".
- **Viết lại MASTER.md** — customize từ generated baseline để match chính xác CENCOM tokens (Light, green/accent/cream, Inter font).

### UX Review & Fixes
- **Review UI** theo Pre-Delivery Checklist (ui-ux-pro-max references/quick-reference.md + pro-rules.md):
  - ✅ cursor-pointer: `.btn`, `a`, `.kb-card` đã có trong globals.css
  - ✅ focus-visible: `globals.css:198-201` outline 2px
  - ✅ prefers-reduced-motion: `globals.css:225` animation/transition = .001ms
  - ✅ Responsive 3 breakpoints (1024→68px, 768→drawer, 375→2col)
  - ✅ Loading states: forms đã có `disabled={loading}` + text change
  - ✅ Semantic tokens: `@theme` + `@layer base` full CENCOM palette
  - ✅ Error near-field: forms đã có error messages gần input (inline hoặc toast)
- **Fix UX:**
  - `--text-base` max: 15px → 16px (WCAG mobile, tránh iOS auto-zoom)
  - `body` line-height: thêm `1.5` (readability)
  - Thêm `SkipLink` component (`components/SkipLink.tsx`) + `sr-only`/`focus:not-sr-only` CSS utility trong `globals.css`
  - Sidebar: thêm `aria-label` cho Link (icon-only trên tablet), `aria-hidden="true"` cho icon spans
- **Fix emoji Unicode -> SVG icons:** Thay theo tat ca emoji/SVG symbol trong buttons:
  - `📎` (chat) -> SVG paperclip icon + aria-label
  - `⚖` (asset) -> SVG balance scale icon
  - `+ Tạo` (baogia/kho/dm/de-xuat) -> SVG plus icon
  - `🔄` (dashboard) -> SVG refresh icon
  - `✕` (xoa buttons) -> them `aria-label="Xoa ..."`
- **Accessibility audit:**
  - Them `aria-label` tren icon-only buttons (chat peer picker, SC create, dashboard refresh)
  - Them `aria-hidden="true"` tren icon spans trong Sidebar nav
  - Them `aria-label` tren Sidebar Links cho tablet icon-only mode

### Page Overrides (22 files)
- Tao `design-system/cencomos-gara/pages/` voi 22 file overrides cho moi route + modal detail:
  home, dashboard, login, change-password, sc, sc-detail, sc-create, kho, kho-dm, kho-nhap, kho-xuat, chat, asset, baogia, baogia-detail, thanhly, de-xuat, de-xuat-detail, kho-dm-detail, preview, perm.

### Verify
- `npx tsc --noEmit` 0 err + `npm run build` success (27 routes).
- `node check-skills.js` ERR=0 WARN=0 / 13 skill.
- Core tests: **134/134 PASS** (packages/core).

### Note
- MASTER.md generated mặc định là dark OLED theme — đã customize để match CENCOM light theme.
- Không có `<img>` tags trong codebase (data dashboard, chỉ dùng SVG icons) → thêm WebP guidelines vào MASTER.md cho future use.
- Toàn bộ emoji/SVG symbol trong buttons đã được thay bằng SVG icons + aria-label.
- Skip-link + aria-labels đã thỏa mãn WCAG 2.2 AA tối thiểu.

## 2026-08-16 — GĐ-G Phase 2: Improvements (Dark Mode + Token Sync + Scripts)

### Improvements (dựa trên Production Check)
1. **Dark mode toggle:**
   - Thêm `.dark` CSS variables trong `globals.css` (override màu sắc + glass)
   - Cập nhật `ThemeProvider.tsx` với `useDarkMode()` context + localStorage persistence
   - Thêm toggle button trong `Topbar.tsx` (sun/moon SVG icon + aria-label)
   - Sidebar gradient dùng CSS variables thay vì hardcoded hex
   - Thêm dark mode color table vào MASTER.md

2. **CI token sync validator:**
   - Tạo `scripts/check-tokens.cjs` — so sánh CSS variables (globals.css `:root`) với MASTER.md color table
   - Kiểm tra typography (base ≥ 16px, line-height ≥ 1.5)
   - Kiểm tra prefers-reduced-motion + focus-visible
   - Exit code 0 = tokens sync hoàn toàn, 1 = có mismatch

3. **Image optimization script:**
   - Tạo `scripts/convert-images.sh` — batch convert JPG/PNG/TIFF → WebP bằng `sharp` CLI
   - Usage: `bash scripts/convert-images.sh [quality]` (default: 85)

4. **README.md:**
   - Tạo project README.md tổng hợp UI/UX Pro Max, dark mode, accessibility, scripts

### Files modified
- `apps/web/app/globals.css` — dark mode variables + sidebar CSS vars
- `apps/web/components/ThemeProvider.tsx` — dark mode context + toggle
- `apps/web/components/Topbar.tsx` — dark mode toggle button + SVG icons (menu ☰, notification 🔔)
- `apps/web/components/Sidebar.tsx` — aria-label + aria-hidden
- `apps/web/app/(app)/chat/page.tsx` — SVG paperclip icon
- `apps/web/app/(app)/asset/page.tsx` — SVG balance scale icon
- `apps/web/app/(app)/baogia/page.tsx` — SVG plus icon
- `design-system/cencomos-gara/MASTER.md` — dark mode table + elevated color + WebP guidelines

### Verify
- `npx tsc --noEmit` 0 err
- `npm run build` success (27 routes)
- `check-skills.js` ERR=0 WARN=0 / 13 skill
- `check-tokens.cjs` ERR=0 WARN=0
- Core tests: 134/134 PASS

