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

## Tài liệu nguồn (đọc khi cần)

- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\docs\rewrite\01_DOMAIN.md` … `07_PARITY_TESTS.md` — SPEC gốc.
- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\server\*.js` — mã nguồn port (sc, kho, tk, xuong, chat, asset, baogia, nhanKy, perm, scoring, welcome, report, preview, auth, db).
- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\shared\data\seed_xe.json`, `seed_biemau.json` — seed.
- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\tests\` — 327 test nguồn.