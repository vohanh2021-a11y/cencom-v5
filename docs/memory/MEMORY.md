# MEMORY — CencomOS Gara v5.2.0

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

## RPC & MCP
- 85 fn trong `FN_LIST` (strip comment) — tên fn = tên MCP tool
- 55 MCP tools (dynamic, không hardcode count)
- 4 resources: `sc://`, `xe://`, `dm://`, `kho://tai-san`
- 2 prompts: `ho-so-sc-chuan-qc206`, `quy-trinh-mua-sam`, `quy-trinh-xuong`
- `MCP_WRITE_TOOLS=''` → read-only mặc định, 18 write tools cần bật explicit

## Deployment
- **Docker**: `cencom_v5_pg` (postgres:16-alpine, port 5432) — container đang chạy
- **Electron**: `electron/main.js` → NSIS installer 84MB (`CencomOS Gara Setup 5.2.0.exe`)
- **On-premise**: `Onpremise/docker-compose.yml` — PostgreSQL thuần + Next.js standalone + Nginx
- **CI**: `.github/workflows/ci.yml` — lint→tsc→test→build→docker (xanh trên `ab9fcfa`)
- **PWA**: icon 192/512, manifest.json, sw.js, PwaRegister.tsx

## Tags & Versions
- `v4.0.0` → `v5.0.0-beta` → `v5.0.0` → `v5.1.0` → `v5.2.0` (current)
- Branch `main` (clean), `draft/gd4-gd5-v4` (két sắt 103 file)
