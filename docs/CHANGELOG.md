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