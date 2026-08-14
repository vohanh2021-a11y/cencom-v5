# CHANGELOG — cencomOS_gara_4.0_supa

> Nhật ký thay đổi của dự án v4. Bản tại thư mục v3.6 (`docs/CHANGELOG.md`) ghi nhận theo dõi Workspace.
> Định dạng: `## YYYY-MM-DD — tiêu đề`.

## 2026-08-14 — Khởi tạo dự án v4.0 (GĐ0)

- Tạo thư mục `E:\APP-LAPTOP-SYNC\cencomOS_gara_4.0_supa\` (ngoài v3.6, git repo riêng).
- Viết `PLAN_14.08_supa.md` — plan chi tiết tự chứa (quyết định, kiến trúc, schema PG, business rules, RPC, test, 10 giai đoạn).
- Viết `docs/Architect.md` — kiến trúc + logic tính toán + điều kiện UI/UX.
- Viết `docs/MASTER_PLAN.md` — lộ trình 10 giai đoạn.
- Viết `docs/CHANGELOG.md` (file này), `AGENTS.md`, `.gitignore`.
- Chốt các quyết định với chủ dự án:
  - Stack: Next.js + TS + Tailwind (Vercel) + PostgreSQL + Realtime + Storage (Supabase).
  - Custom auth + CBAC trên PG; gói Free; subdomain `.vercel.app`.
  - BỎ ảnh báo giá + AI-OCR (chỉ nhập tay); bỏ GAS/Electron/docx.
  - GIỮ Preview vai trò, CencomBot; contract RPC bất biến.
  - Ảnh chat/TK: file tạm Storage TTL 1 ngày, người nhận tải về máy.
  - Gộp nhánh `CencomOS_v2_nextJS/` vào v4.
- Ghi nhận hướng v4 vào v3.6 (`GHI_NHO_HUONG_PHAT_TRIEN_V2.md`, `docs/CHANGELOG.md`, `docs/memory/`).

**Kế tiếp (GĐ1)**: khởi tạo schema PostgreSQL + migrations + migrator SQLite→PG + seed — mở phiên mới tại thư mục dự án 4.0.

## 2026-08-14 — GĐ1: Schema PostgreSQL + Migrator + Seed (HOÀN THÀNH)

- Tạo monorepo npm workspaces: root `package.json` + `tsconfig.base.json` + `.env.example` + `tsconfig.json`.
- `packages/db/schema.sql` — 36 bảng PG theo PLAN mục 6 (giữ tên/cột/id `PREFIX-000001`, soft-delete `deleted_at TEXT DEFAULT ''`, ngày TEXT `YYYY-MM-DD`); bỏ cột ảnh/OCR `bao_gia_ncc`; `sessions.created_at/expires_at` dùng TIMESTAMPTZ; CHECK constraint whitelist cho `phieu_sua.trang_thai`, `sc_congviec.tt/loai_xu_ly`, `sc_vattu.tt/loai_xu_ly`, `de_nghi_mua.trang_thai`, `phieu_nhap.loai_nhap`, `phieu_xuat.loai_xuat`, `yeu_cau_tham_kham.muc_uu_tien/trang_thai`; đủ index mục 6.6 + index hiệu năng Phase 5.
- `packages/db/src/seed.ts` — port `server/seed.js`: phòng ban, 42 xe + nguyên giá theo năm SX, 97 biểu mẫu, users mặc định + user lái xe (33 TK) + `must_change=1` + mật khẩu `cencom@123` (scrypt), `phan_quyen` từ MATRIX, config ngưỡng/khấu hao, 29 công việc + 37 vật tư; idempotent (ON CONFLICT DO NOTHING).
- `packages/db/src/migrator.ts` — copy SQLite v3.6 → PG qua `node:sqlite` + `pg`: giữ id/ngày/JSON, tự bỏ cột ảnh/OCR (intersection information_schema), sessions epoch-ms → timestamptz, setval sequence bảng BIGSERIAL.
- `packages/db/src/cli.ts` — lệnh `schema | seed | migrate | reset` (env `DATABASE_URL`, `SQLITE_PATH`, `ALLOW_RESET`).
- `supabase/config.toml` + `supabase/migrations/0001_init.sql` (copy schema).
- Test `packages/db/tests/gd1.test.ts` — **12/12 pass** trên PGlite (Postgres WASM, không cần server thật): đủ bảng, không còn cột OCR, CHECK hoạt động, seed 42/97/users, mật khẩu scrypt đúng, MATRIX + config, idempotent, migrator copy dữ liệu SQLite thật giữ id.
- `npm run typecheck` sạch; `npm test` (workspace @cencom/db) pass.

**Kế tiếp (GĐ2)**: port `packages/core` theo thứ tự db.ts → auth.ts → perm.ts → scoring.ts → sc.ts → kho.ts → chat.ts → tk.ts → xuong.ts → asset.ts → baogia.ts → nhanKy.ts → welcome.ts → report.ts → preview.ts (mỗi module kèm test vitest).

## 2026-08-14 — GĐ2: Port toàn bộ `packages/core` (134 test pass)

- Monorepo `packages/core` (TS thuần, mọi hàm async + `api = { db, auth, perm }`):
  - `src/db.ts` — Pool PG + transaction + audit + softDelete + nextId (`counter FOR UPDATE`); PGlite executor cho test.
  - `src/auth.ts` — scrypt (`scrypt:salt:hash`), session `cen_session`, `must_change`, reset pw.
  - `src/perm.ts` — MATRIX CBAC (8 vai, 12 module) + fallback MATRIX; `canApproveSC`/`canApproveMua` theo ngưỡng.
  - `src/scoring.ts` — thang A–E, `scoreVehicle`/`scoreSystem`.
  - `src/sc.ts` (21 test) — luồng `de_xuat → da_duyet → dang_sua → cho_nghiem → da_hoan → da_quyet`; `scApprove` (ngưỡng), `scStart`/`scFinish`/`scNghiem` (biên bản); `scWorkAdd`/`scVtAdd`/`scTongDuyet` + snapshot; `congViecSave`/`scVtUpd`.
  - `src/kho.ts` (21 test) — vật tư tồn, ĐM mua (tạo/từ SC/auto BOM), nhập/xuất kho, thanh lý, auto xuất từ nhập, lịch sử giá.
  - `src/chat.ts` (9 test) — thread 1-1, lưu img JPG local/Storage, bot trả lời (tồn kho/SC), read/unread.
  - `src/tk.ts` (10 test) — yêu cầu thăm khám: lái xe tạo → quản lý duyệt → xưởng nhận/giao → th�� start/finish; `tkCreateSC` nối tiếp SC; lọc theo BKS.
  - `src/xuong.ts` (7 test) — dashboard xưởng (TK chờ/đang xử lý, SC theo trạng thái, công việc th��, vật tư thiếu); `dashboardAll` Kanban 5 cột (1 xe=1 card, group by BKS, ưu tiên trễ hạn).
  - `src/asset.ts` (7 test) — quyết toán (check 8 bước hồ sơ), lý lịch sửa chữa, GTTV = nguyên giá − khấu hao + chi phí tích lũy; cache báo cáo 60s.
  - `src/baogia.ts` (10 test) — **v4: B�� ảnh/OCR**, nhập tay NCC + items qua `dm_id` (dm_mua_ct); `baoGiaCreate`/`Confirm`/`Del`; `baoGiaOcr` stub l��i.
  - `src/nhanKy.ts` (5 test) — chữ ký phiếu (vị trí nguoi_lap/thu_kho/lai_xe/kt_truong/xuong/ben_giao/ben_nhan/giam_doc); soft-delete.
  - `src/welcome.ts` (8 test) — trang chủ theo vai (shortcut/stats/myTasks/lowTon); greeting/viDate/dateVN.
  - `src/handlers.ts` — `vehicleHealthLog`/`fleetReport`/`accountingReport` (pre-fetch, không async trong map).
  - `src/report.ts` — ExcelJS export: lý lịch xe, đội xe, kế toán, tồn kho, phiếu xuất, quyết toán, TK, có header/footer Times New Roman.
  - `src/preview.ts` — admin xem thử 7 vai (giamdoc/quanly/ketoan/tho/khoa/xuong/laixe) dữ liệu DEMO, nav/actions theo MATRIX.
- `src/index.ts` export tất cả module.
- Test: **134/134 pass** (PGlite, vitest hookTimeout 30s).
- `npm run typecheck` (root + @cencom/db + @cencom/core) sạch.
- Toàn bộ repo: typecheck + test pass.

## 2026-08-14 — Ghi nhớ: Kanban v3.6.2 requirements (từ v3.6)

- **Kanban Bảng điều khiển**: 1 xe = 1 card (group by `bks`), KHÔNG phải 1 SC = 1 card.
- **5 cột simplified**: Đề xuất / Đã duyệt / Đang sửa / Chờ nghiệm thu / Từ chối.
  - BỎ cột: Đã tổng duyệt, Hoàn thành, Đã quyết toán (không cần trên dashboard).
- **Ưu tiên xếp cột**: `dang_sua(5) > cho_nghiem(4) > da_duyet(3) > de_xuat(2) > tu_choi(1)`.
- **Card hiển thị**: BKS + hãng/model + tổng số SC + tổng tiền + progress bar + ETA + badge breakdown theo trạng thái.
- **Click card → modal timeline**: hiển thị 5 bước (Lập → Duyệt → Bắt đầu → Hẹn trả → Nghiệm thu) cho từng SC của xe.
- **Lái xe**: KHÔNG yêu cầu đổi mật khẩu mặc định khi đăng nhập (bỏ modal mustChange ở `laixe.html`). Server vẫn giữ logic `must_change` ở backend.
- **KPI giữ nguyên8 ô**: xe, SC chờ duyệt, SC đang sửa, chờ nghiệm thu, TK chờ duyệt, TK đang xử lý, hoàn hôm nay, quyết toán hôm nay.
- **Schema PG v4**: cần bảng `phieu_sua` có cột `ngay_bat_dau`, `ngay_du_kien`, `ngay_nghiem`, `la_sua_ngoai`, `tk_id` (đã có trong schema GĐ1). Dashboard query PostgreSQL group by `bks` thay vì theo `trang_thai` đơn lẻ.