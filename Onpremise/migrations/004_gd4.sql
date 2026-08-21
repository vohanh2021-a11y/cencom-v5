-- migration 004_gd4.sql — Áp dụng GĐ-4 (Hồ sơ xe + Khách hàng) cho DB on-premise ĐÃ tồn tại.
-- Schema base (packages/db/schema.sql) đã có CREATE TABLE IF NOT EXISTS + ALTER IF NOT EXISTS,
-- nên file này dùng để áp dụng riêng biệt (không cần chạy lại toàn bộ schema).
-- Chạy: docker exec -i supabase-db psql -U postgres -d cencom_os -f /tmp/004_gd4.sql

-- 1) Bảng khách hàng (nếu chưa có)
CREATE TABLE IF NOT EXISTS khach_hang (
  id TEXT PRIMARY KEY,
  ten TEXT,
  sdt TEXT,
  dia_chi TEXT,
  email TEXT,
  ma_so_thue TEXT,
  ghi_chu TEXT,
  deleted_at TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'c1'
);

-- 2) Cột hồ sơ xe (bỏ qua nếu đã tồn tại)
ALTER TABLE xe ADD COLUMN IF NOT EXISTS chu_xe TEXT;
ALTER TABLE xe ADD COLUMN IF NOT EXISTS khach_hang_id TEXT;
ALTER TABLE xe ADD COLUMN IF NOT EXISTS so_khung TEXT;
ALTER TABLE xe ADD COLUMN IF NOT EXISTS so_may TEXT;
ALTER TABLE xe ADD COLUMN IF NOT EXISTS ngay_dang_ky TEXT;
ALTER TABLE xe ADD COLUMN IF NOT EXISTS han_dang_kiem TEXT;
ALTER TABLE xe ADD COLUMN IF NOT EXISTS ngay_dang_kiem TEXT;
ALTER TABLE xe ADD COLUMN IF NOT EXISTS han_bao_hiem TEXT;
ALTER TABLE xe ADD COLUMN IF NOT EXISTS ngay_bao_hiem TEXT;

-- 3) Index hỗ trợ tìm kiếm khách hàng
CREATE INDEX IF NOT EXISTS idx_khach_hang_ten ON khach_hang(ten);
CREATE INDEX IF NOT EXISTS idx_khach_hang_mst ON khach_hang(ma_so_thue);
