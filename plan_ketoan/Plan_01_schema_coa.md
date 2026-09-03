# Plan_01 — Schema Hệ thống tài khoản (CoA)  ·  Chức năng: CoA  ·  GĐ1

**Đầu vào:** `read_01` (danh sách CoA VAS).
**Đầu ra:** bảng `tai_khoan` + dữ liệu seed ~24 tài khoản.

## Các bước (TDD)
1. Thêm vào `packages/db/src/accounting.sql` (và paste vào `schema.sql`):
   ```sql
   CREATE TABLE IF NOT EXISTS tai_khoan (
     id VARCHAR(12) PRIMARY KEY, tenant_id TEXT DEFAULT 'c1',
     ma_so VARCHAR(16) NOT NULL, ten TEXT NOT NULL,
     loai TEXT NOT NULL CHECK (loai IN ('tai_san','no_phai_tra','von_chu_so_huu','doanh_thu','chi_phi')),
     cap INTEGER DEFAULT 1, deleted_at TEXT DEFAULT ''
   );
   CREATE UNIQUE INDEX IF NOT EXISTS idx_taikhoan_ms ON tai_khoan(tenant_id, ma_so) WHERE deleted_at='';
   ```
2. Seed (trong `ledgerSeed` / migration): insert các mã theo `read_01` §2 (bỏ 131/511/711).
3. Viết test `ledger.test.ts`: sau seed, `SELECT COUNT(*) FROM tai_khoan` ≥ 20; mỗi `ma_so` unique.
4. Áp dụng live DB (script `scripts/apply-ledger-schema.mjs`).

**Đối chiếu:** không đổi logic cũ; chỉ thêm bảng mới. `ke_toan_setting` cũng thêm ở Plan_02.
**Rủi ro:** trùng `ma_so` → unique index chặn. Seed dùng `INSERT ... ON CONFLICT DO NOTHING`.
