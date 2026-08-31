# AGENTS.md — CENCOMOS-GARA 4.0 SUPA (Cloud rewrite)

Hệ thống quản lý & giám sát xe đầu kéo — **bản cloud v4.0**: Next.js (App Router) + TypeScript + Tailwind (Vercel) + PostgreSQL + Realtime + Storage (Supabase). Viết lại toàn bộ từ v3.6 (Node/Express + SQLite) — giữ 100% logic nghiệp vụ.

> Lệnh cung: phải tuân thủ global AGENTS.md (Gatekeeper — bảo mật/async/kiến trúc/Production Check) và đọc TRƯỚC:
> 1. `PLAN_14.08_supa.md` — plan chi tiết tự chứa (mọi quyết định, schema, RPC, giai đoạn).
> 2. `docs/Architect.md` — kiến trúc + logic tính toán + UI/UX.
> 3. `docs/MASTER_PLAN.md` — lộ trình 10 giai đoạn.

## Stack & lệnh chạy

| Việc | Lệnh |
|---|---|
| Dev web | `cd apps/web; npm run dev` |
| Schema PG | `packages/db/schema.sql` (xem PLAN mục 6) |
| Migrate SQLite→PG | `packages/db/migrator.ts` (GĐ1) |
| Seed | `packages/db/seed.ts` (GĐ1) |
| Conformance test | `cd tests/conformance; npm test` (≥320 pass) |
| Type check | `npx tsc --noEmit` |
| Supabase | `npx supabase init` / `supabase db push` |

## Quy ước code (BẮT BUỘC)

- **TypeScript strict**; mọi hàm nghiệp vụ **async** (Postgres pool) — `await` đủ, wrapper bắt lỗi, không fire-and-forget.
- **Zod** (`packages/contract`) cho input RPC: validate + sanitize mọi đầu vào; whitelist enum (`trang_thai`, `tt`, `loai_xu_ly`, `muc_uu_tien`).
- Nghiệp vụ: thêm hàm trong `packages/core` → khai báo quyền trong bảng RPC (`adminOnly`/`rpcMeta` — **quên là lỗ hổng**) → test → cập nhật docs.
- Ghi: transaction PG + `db.audit` (log_audit) + soft-delete (`deleted_at TEXT DEFAULT ''`); không DELETE cứng.
- SQL: parameterized (`$1,$2`); không nối chuỗi.
- Id: `PREFIX-000001` (VARCHAR(12) PK) qua `db.nextId(prefix)` dùng counter `FOR UPDATE`.
- Ngày tháng: **giữ TEXT `YYYY-MM-DD`** (quyết định duy nhất — không đổi format khi migrate).
- Không hardcode secret — `.env` + `.gitignore`.

## Điều CẤM (khác bản cũ)

- ❌ Không viết lại logic nghiệp vụ — port NGUYÊN (so `docs/rewrite/02_BUSINESS_RULES.md`).
- ❌ Không thêm lại ảnh báo giá / AI-OCR (`baoGiaOcr`, `aiConfig*`, `aiTest`) — đã chốt BỎ.
- ❌ Không dùng polling 45s — dùng Supabase Realtime.
- ❌ Không sinh `.docx` — in HTML A4 (`/in/*`).
- ❌ Không bỏ route/contract `POST /api/rpc {fn,args}` — client mới vẫn theo contract này.

## Bàn giao

Bàn giao code PHAI kem muc "⚠️ Lưu ý hệ thống sản xuất (Production Check)" (4 câu: con thieu gi / rui ro dau / da chay test chua / de xuat tiep theo). Luôn chạy `tsc --noEmit` + conformance trước khi bàn giao; nếu thiếu môi trường, nói rõ CÁCH CHẠY.

## MCP Server

MCP server stdio (`mcp-server/`) — AI host (Claude Desktop, opencode, Cursor...) kết nối qua stdio, gọi tool tên **đồng nhất** fn RPC. Mặc định **read-only** (`MCP_WRITE_TOOLS=''`), bật ghi bằng allowlist. Mọi lệnh ghi audit `channel=mcp` vào `activity_log`. Chi tiết: [`gara_reconstruction_v5/mcp-server/README.md`](gara_reconstruction_v5/mcp-server/README.md).

## Tài liệu nguồn (đọc khi cần)

- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\docs\rewrite\01_DOMAIN.md` … `07_PARITY_TESTS.md` — SPEC gốc.
- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\server\*.js` — mã nguồn port (sc, kho, tk, xuong, chat, asset, baogia, nhanKy, perm, scoring, welcome, report, preview, auth, db).
- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\shared\data\seed_xe.json`, `seed_biemau.json` — seed.
- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\tests\` — 327 test nguồn.

## On-Premise Deployment (Intranet/LAN)

> Dự án hỗ trợ triển khai **on-premise** (Intranet/LAN) thay vì cloud (Vercel + Supabase managed). Xem `Onpremise/plan_onpremise.md` để biết cách triển khai trên Ubuntu Server + Docker.

**Core business logic (`packages/core`, `packages/db/schema.sql`) — KHÔNG THAY ĐỔI** khi chuyển giữa cloud ↔ on-premise. Chỉ thay đổi environment variables + Docker/Nginx config.

### Quick Start On-Premise

```bash
cd Onpremise

# 1. Tạo certs
bash scripts/init_certs.sh

# 2. Setup env
cp .env.onpremise .env.onpremise.local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# → dán SESSION_SECRET vào .env.onpremise.local

# 3. Build + run
bash scripts/deploy_local.sh

# 4. Init DB (1 lần)
bash scripts/init_db.sh
```

Truy cập: `https://localhost` (self-signed cert — trust để bỏ cảnh báo).

### Files cấu hình on-premise

| File | Mô tả |
|---|---|
| `Onpremise/docker-compose.yml` | Supabase stack + Next.js + Nginx |
| `Onpremise/Dockerfile.standalone` | Build Next.js standalone |
| `Onpremise/nginx/nginx.conf` | Reverse proxy + WebSocket + SSL |
| `Onpremise/.env.onpremise` | Template env (copy → `.env.onpremise.local`) |
| `Onpremise/scripts/*.sh` | Init certs, init DB, deploy, backup, restore |
| `Onpremise/README.md` | Hướng dẫn chi tiết |
| `Onpremise/plan_onpremise.md` | Kế hoạch triển khai toàn diện |