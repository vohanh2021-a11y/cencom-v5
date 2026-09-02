# MASTER PLAN — cencomOS gara v5.0 (cập nhật 2026-09-02 — release v5.2.0)

> Bản chi tiết: `gara_reconstruction_v5/docs/PLAN_14.08_supa.md`; kiến trúc: `docs/Architect.md`;
> kế hoạch GĐ2/GĐ3 chi tiết: `gara_reconstruction_v5/docs/PLAN_HOAN_THIEN_G2_G3.md`, `gara_reconstruction_v5/docs/PLAN_GIAIDOAN_3.md`;
> quy hoạch GĐ4+: `gara_reconstruction_v5/docs/PLAN_GIAIDOAN_4_5.md` (xem xét mở rộng).

> ⚠️ **TÁI TẠO DÀNH CHO V5.0.** File gốc là bản v4.0 (tạo 2026-08-14, commit `8c3f57e` — *GĐ1 Schema PG*). Bản v4.0 vẽ 10 GĐ tuần tự, cấu trúc Next.js đơn, cột trạng thái **lỗi thời (toàn bộ `⏳`)**. Dự án đã chuyển sang **v5.0 — monorepo workspace** (`packages/*` + `apps/*`) và **vượt xa kế hoạch tuyến tính**. Bản này viết lại hoàn toàn theo **GPS thực tế 2026-08-21**.

---

## 0. Tóm tắt GPS (đọc nhanh)

- **Vị trí hiện tại (02.09):** ✅ `GĐ1–GĐ5 xong` + `GĐ8 DONE` (714/714 conformance) — hội tụ v5.2.0 (`PLAN_HOI_TU_01.09` W0–W4, commits `aaf11c9`→`9e26015`); W5 release đang chạy docs/bump; 🛑 `GĐ6/GĐ9/GĐ10 chưa xong`.
- **App v5 đã dùng được:** build xanh, UAT 20/20, conformance 714/714 (27 suites), MCP 32+2+1+HTTP mở rộng động, PWA + workspace 4 trục + in A4.
- **Chiến lược deploy:** LAN (on-premise) trước → xuất về hệ thống công ty sau. **KHÔNG Vercel.**
- **Vấn đề còn lại:** gộp 2 codebase, rồi mới chạy full conformance + E2E + deploy LAN.

---

## 1. Cấu trúc v5 (KHÁC v4 — quan trọng)

v5 là **monorepo NPM workspaces** (root `package.json` có `"workspaces": ["packages/*","apps/*"]`), KHÁC với v4 (Next app đơn).

| Thành phần | Đường dẫn | Vai trò v5 | Trạng thái |
|---|---|---|---|
| workspace root | `cencomOS_gara_4.0_supa/` | Quản lý monorepo, scripts chung | ✅ |
| `@cencom/core` | `packages/core/` | Core nghiệp vụ (auth, perm, sc, kho, baogia, ho_so, ...) | ✅ GĐ1-3 + ⏳ GĐ4 draft (`ketoan/khachhang/baoduong/ledger/search/mail/list`) |
| `@cencom/db` | `packages/db/` | Schema PG + migrations | ✅ GĐ1 + ⏳ GĐ4 (`accounting.sql`, `coa_seed.sql`, migrations) |
| `@cencom/contract` | `packages/contract/` | Zod schemas (input RPC) | ✅ GĐ2 |
| `@cencom/web` | `apps/web/` | Next.js app (UI) | ✅ GĐ1-3 + ⏳ GĐ4/GĐ5 draft (audit/ke-toan/khach-hang/nhac-han/xe/sc dashboard/kanban) |
| Onpremise | `Onpremise/` (root) | Docker on-prem, nginx, certs, backup/restore | ✅ GĐ3 |
| CI/CD | `.github/workflows/` (root) | ci / deploy / k6-nightly / uat-video | ✅ GĐ3 (untracked, mới) |
| Tests | `tests/conformance/` (root) + `packages/core/tests/` | jest conformance + contract | ✅ 236/236 (GĐ2/3) + ⏳ GĐ4 (`-gd*.test.ts`) |

### ⚠️ Hai baseline đang song hành (cần hội tụ)
1. **`gara_reconstruction_v5/`** — app **standalone tự chứng** (Next riêng, `node_modules` riêng, `tests/conformance` riêng). Đây là **baseline GĐ1-3 đã commit **`3a84af4`** (build, UAT 20/20, conformance 236/236)**. Chưa gắn vào workspace.
2. **Root monorepo** (`packages/*` + `apps/web`) — codebase **canonical v5** chứa GĐ4/GĐ5 draft (ketoan, khachhang, baoduong, ledger, UI mới). **Chưa commit, chưa type-check, chưa test.**

→ **Quyết định cần thiết:** chuẩn hoá về **1 codebase** (nên giữ root monorepo `@cencom/web` + `@cencom/core` làm chính, migrate baseline `gara_reconstruction_v5` sang workspace) rồi mới chạy full conformance. Phần này nêu ở mục 6.

---

## 2. Hai hệ số GĐ

| Hệ thống | Dùng cho | Ghi chú |
|---|---|---|
| Master Plan gốc (G0–G10) | Kế hoạch v4.0 cũ | Đã lỗi thời |
| GĐ thực tế v5 (GĐ1..N) | Phát triển v5 thực tế | `reconstruct → harden → deploy → mở rộng` |

> ✅ = commit & verify (build xanh / test xanh) · ⏳ = draft / chưa verify · 🛑 = chưa bắt đầu

---

## 3. Lộ trình GĐ (thực tế v5)

| GĐ | Nội dung | Deliverable | Trạng thái thực tế |
|---|---|---|---|
| GĐ1 | Base reconstruction v5: schema PG + core port + POST /api/rpc + Realtime + auth/perm | App chạy, xe=42, biểu_ma=97 | ✅ (monorepo: `packages/core` + `packages/db`; baseline `gara_reconstruction_v5` đã commit) |
| GĐ2 | Pre-deploy/Security/Obs/Scripts/CI (Wave A) | OWASP + metrics + scripts + CI | ✅ (`lib/rateLimit.ts`, `middleware.ts`, `/api/health`, `/api/metrics`, `.github/workflows/*`) |
| GĐ3 | PRODUCTION deploy + monitoring + UX UAT (Wave B/C) | Docker on-prem, CI/CD, health/metrics, rollback, ops docs | ✅ **HOÀN THIỆN** (`3a84af4`, 2026-08-21): build xanh, UAT 20/20, 0 lỗi, conformance 236/236, sửa 5 lỗi thực |
| GĐ4 | Mở rộng nghiệp vụ (chủ xe·kế toán·bảo dưỗng·ledger·tìm kiếm·mail·list·init) | `packages/core/src/{ketoan,khachhang,baoduong,ledger,search,mail,list,init}.ts`; DB `accounting.sql`/`coa_seed.sql`; migrations `004_gd4.sql`/`005_chu_xe.sql`; 12 spec `*_gd*.test.ts` | ✅ **DONE qua hội tụ v5.2.0** (`PLAN_HOI_TU_01.09` W0–W4): race-kg `aaf11c9`, kho 2 tầng/GTTV `da3091e`, DM full + xưởng fn `a262dad`, admin+search+boss `9e26015`. (Nhánh draft ketoan/ledger gốc gộp vào UI v5 — không giữ song song.) |
| GĐ5 | UI toàn bộ màn hình (PC/tablet/ĐT, theme) | `apps/web/app/(app)/{audit,ke-toan,khach-hang,nhac-han,xe,sc/dashboard,kanban}` + components UI mới | ✅ **DONE** (W1–W4 trong `gara_reconstruction_v5`, commit `da3091e`→`9e26015`): UI kho 4 tab, `/kho/dm`, kanban 5 cột 1-xe-1-thẻ, `/sc` dashboard KPI, GlobalSearch, `/in/*` A4 8 mẫu, workspace 4 trục + 3 theme, PWA. |
| GĐ6 | Performance: pagination/index/MV/cache/export job | Hết nút thắt cũ | 🛑 |
| GĐ7 | Backup 7 ngày + Archive + partition | `Onpremise/scripts/backup.sh` / `restore.sh` / `init_*` | ✅-partial (committed trong GĐ3) |
| GĐ8 | Conformance full 327 + E2E | ≥320 pass + Playwright E2E | ✅ **DONE** tại `9e26015` (02.09, gate W5-check hiện trường): **714/714 (27 suites)** ≥ 320; Playwright e2e 13/13 (kho 4/4 · dm 4/4 · kanban 4/4 · sc 1/1); rbac 329/329. |
| GĐ9 | Deploy LAN (on-premise docker-nginx) + hardening | Docker compose, nginx SSE+SSL, localhost HTTPS | ⏳ |
| GĐ10 | Multi-tenant RLS + thương mại hoá + tag v5.0.0 | docs 2 nơi | 🛑 |

---

## 4. Trạng thái hiện tại (GPS 2026-09-02 — v5.2.0)

- **Phiên bản hiện hành: v5.2.0** (`package.json 5.2.0`; chuỗi commit `aaf11c9`→`da3091e`→`a262dad`→`9e26015`, 01–02.09). Tag `v5.2.0` chờ remote git (W5.4–W5.5).
- **Đã commit & verify (GĐ1–3):** `3a84af4` — baseline `gara_reconstruction_v5/` (build xanh, UAT 20/20, conformance 236/236, Docker + CI/CD + monitoring + rollback).
- **Hội tụ v5.2.0 (W0–W4) DONE:** race-condition kho + `recalcScTotals` (W0) · trục KHO 2 tầng/tonKho/cu_hong/GTTV (W1) · trục DM duyệt ngưỡng + UI `/kho/dm` (W2) · trục XƯỞNG kanban/KPI 11/sửa dòng/`scTongDuyet`+`sc_phien_ban` (W3) · cross-cutting admin+must_change/GlobalSearch/`/in/*` A4/workspace PA1+3 theme/PWA/NotificationCenter/boss-dashboard (W4). **Conformance 714/714 (27 suites), tsc=0, rbac 329/329, e2e 13/13.** MCP động theo registry (v5.1.0: 32+2+1+HTTP → hiện ~69 fn; resources `sc/xe/dm/kho-taisan/xuong-dashboard`, prompts QC206/mua-sam/xuong).
- **Chưa làm / còn treo:** GĐ6 (perf tune MV/pagination sâu), GĐ9 (deploy LAN production + hardening runbook), GĐ10 (multi-tenant RLS + thương mại hoá + tag lịch sử). **Push Git remote (việc của user — chưa có remote).**


---

## 5. Lộ trình đi tiếp (từ thời điểm hiện tại)

**Bước 1 — Quyết định hội tụ codebase (chặn tiến trình):**
- (A) Dùng **root monorepo** `@cencom/web` + `@cencom/core` làm canonical → migrate baseline `gara_reconstruction_v5` (GĐ1-3) sang workspace, hoặc
- (B) Giữ `gara_reconstruction_v5` làm canonical, đưa GĐ4 monorepo draft (`packages/core/src/*`, `apps/web/...`) vào.
→ Cần chọn 1 để tránh ké double-maintain. (Khuyến nghị: A — monorepo là chuẩn v5.)

**Bước 2 — GĐ4 (sau chọn codebase):**
1. Commit GĐ4 draft.
2. `npm run typecheck` (tsc --noEmit) — cả core + db + web.
3. Chạy `npm run test:contract` + 12 spec `*-gd*.test.ts` → conformance full.
4. Seed/ migrate (004_gd4, 005_chu_xe, accounting, coa_seed).

**Bước 3 — GĐ6/GĐ9/GĐ10 + release:**
- GĐ6: pagination/index/MV (tăng tốc danh sách 327).
- GĐ9: triển khai **LAN (on-premise)** — `docker build` + `docker compose -f docker-compose.prod.yml up -d` (hoặc `bash Onpremise/scripts/deploy_local.sh`), nginx HTTPS tự ký, chạy `gara_reconstruction_v5/scripts/smoke.mjs` + `health_check.sh` + audit security headers (X-Frame-Options, CSP, HSTS).
- GĐ9.5: **xuất về hệ thống công ty** — đóng gói data bundle (postgres dump) + migration bundle, chuyển cho team vận hành doanh nghiệp.
- GĐ10: bật RLS multi-tenant + docs 2 nơi, đặt tag `v5.0.0`.
- GĐ8: E2E Playwright đầy đủ.

---

## 6. Điều chuẩn & lệnh

- `tsc --noEmit` sạch; `next build` pass; tests xanh; docs cập nhật; Production Check.
- **Chiến lược deploy: LAN (on-premise) trước, xuất về công ty sau — KHÔNG dùng Vercel.**

Lệnh:

```bash
# root monorepo (dev LAN local)
npm run typecheck
npm run seed
npm run test:conformance          # jest tests/conformance

# triển khai LAN (on-premise)
cd Onpremise
bash scripts/deploy_local.sh      # build + docker compose (nginx HTTPS tự ký)
bash scripts/init_db.sh           # init DB (chỉ 1 lần)
bash scripts/health_check.sh      # kiểm tra health

# baseline gara_reconstruction_v5 (đã verify GĐ3)
cd gara_reconstruction_v5
npm run build                     # standalone build
npx playwright test --config=playwright.ux.config.ts   # UAT 20 case
npx jest tests/conformance        # 236 case
```

## 7. Nguồn
- `gara_reconstruction_v5/docs/PLAN_14.08_supa.md`
- `docs/Architect.md`
- `gara_reconstruction_v5/docs/PLAN_HOAN_THIEN_G2_G3.md`
- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\docs\rewrite\01-07` (SPEC gốc)
- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\server\*.js`, `shared\data\seed_xe.json` (seed)
