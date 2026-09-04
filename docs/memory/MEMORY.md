# MEMORY — CencomOS Gara v5.3.0

> Kiến thức lõi ≤80 dòng. Ghi WHY, không chỉ WHAT.

## Kiến trúc
- **Modular monolith** trong `gara_reconstruction_v5/` — Next.js 14 App Router + PostgreSQL thuần (KHÔNG Supabase).
- `lib/rpc.ts` là dispatch center: `FN_LIST` đăng ký 85 functions, `META` gán quyền `[module, hành-động]` cho 5 vai.
- Contract bất biến: `POST /api/rpc {fn, args}` — client mới vẫn theo contract này.
- MCP nhúng: stdio (`index.ts`) + HTTP LAN (`http.ts`, Bearer timing-safe), 55 tools tự sinh từ `getToolInputSchema()`.

## Business Rules (QUAN TRỌNG)
- **SC 8 trạng thái**: draft → cho_duyet → da_duyet → dang_sua → hoan_thanh → quyet_toan → da_dong / tu_choi
- **DM ngưỡng 5tr**: `dmDecide` — admin/giamdoc vô hạn, ketoan ≤ `duyet_mua_nguong` (seed 5,000,000đ)
- **GTTV**: `nguyen_gia - (khau_hao_nam * so_nam) + chi_phi_sua_chua` — 1 GROUP BY, không N+1
- **Race condition fix**: `withTransaction()` + row-guard `ton >= sl RETURNING` (atomic, không check-then-act)
- **`tong_vt`**: ưu tiên `gd_tt` (giá thực tế), fallback `gd_dk` (giá dự kiến)

## Hiệu năng (GĐ6 — đã chốt cách tiếp cận)
- KHÔNG có MV thống kê nào thực sự cần: `tonKho` đọc cột `vattu.ton` ĐÃ maintain
  (không SUM theo nhap_xuat) + `dashboardAll` TTL 60s cache — MV chỉ thêm phức tạp.
- `ledgerReport` = điểm nóng lớn nhất còn lại → cached 5' theo key kỳ, clear khi
  kyClose/kyOpen (WHY: 5 câu SUM ledger; số báo cáo trễ ≤5' chấp nhận được).
- Phân trang: limit clamped + tie-breaker `id DESC` (WHY: OFFSET không tiebreaker
  sẽ TRÙNG/LỘC dòng khi nhiều dòng cùng ngay_tao), default 1.000(SC)/2.000.
- pg_trgm GIN cho ILIKE '%%' — guard DO block vì managed cloud có thể thiếu quyền.
- CẢNH GIÁC: `SELECT ... WHERE deleted_at=''` literal + mảng params mới tinh →
  đếm placeholder thủ công (bug vattuList làm đỏ 3 suite — xem CHANGELOG Fixed).

## RPC & MCP
- 85 fn trong `FN_LIST` (strip comment) — tên fn = tên MCP tool
- Tools **động từ FN_LIST** (04.09 boot = **81 tools** khi write allowlist bật;
  read-only mặc định ít hơn — ĐỪNG hardcode con số trong docs khi bàn giao)
- 4 resources: `sc://`, `xe://`, `dm://`, `kho://tai-san`
- 2 prompts: `ho-so-sc-chuan-qc206`, `quy-trinh-mua-sam`, `quy-trinh-xuong`
- `MCP_WRITE_TOOLS=''` → read-only mặc định, 18 write tools cần bật explicit
- MCP HTTP CẦN 3 bí mật: MCP_USER+MCP_PASS (+ MCP_API_KEY cho đường dây) —
  fail-closed thiếu thì từ chối boot-toÀN-bo; tài khoản app tạo bằng
  `scripts/create-mcp-user.ts` (must_change=0, RPC route chặn must_change=1!)

## Deployment
- **Docker dev-local**: `cencom_v5_pg` (port 5432) — cho chạy migration + test.
- **On-premise stack**: `node:20-ALPINE` hỏng `exec format error` trên Docker
  Desktop/WSL2 kernel 6.6 (musl) → Dockerfile dùng `node:20-slim` + stage `mcp`
  riêng (COPY lib/ + mcp-server/ + devDeps node_modules; runner standalone KHÔNG
  có SDK/tsx → compose đặt `target`).
- **Nginx**: upstream tĩnh chết theo mcp → biến + `resolver 127.0.0.11`; prod
  bind 80/443, máy dev có `docker-compose.override.yml` (gitignored) 18443/5433.
- **Init**: `init_db.sh` đọc .env.onpremise.local → migrate 3-file → seed →
  create-mcp-user → `node scripts/smoke_onpremise.mjs` (PASS 6/6 Windows).
- **Electron**: `electron/main.js` → NSIS installer 84MB (cần rebuild sau menu-bar)
- **CI**: `.github/workflows/ci.yml` — lint→tsc→test→build→docker.
- **PWA**: icon 192/512, manifest.json, sw.js, PwaRegister.tsx

## Windows pitfall (LẶNG QUÊN 2 LẦN)
- `Set-Content`/`Out-File -Encoding UTF8` (PS 5.1) ghi **BOM EF BB BF** → JSON
  import/webpack/seed reader nổ `Unexpected token '﻿'` (đã gặp: seed_xe.json
  UTF-16, health import package.json). LUÔN dùng `[IO.File]::WriteAllText` hoặc
  converter UTF8(no-BOM) khi sửa file máy khách đọc = JSON.

## Tags & Versions
- `v4.0.0` → `v5.0.0-beta` → `v5.0.0` → `v5.1.0` → `v5.2.0` → 5.3.0 (chưa tag)
- Branch `main` (clean), `draft/gd4-gd5-v4` (két sắt 103 file)
