-- 005_chu_xe.sql — GĐ-4 fix: core/UI xe dùng cột chu_xe ("Chủ xe") nhưng migration 004
-- chỉ thêm khach_hang_id nên bỏ sót chu_xe -> INSERT xe lỗi (column does not exist).
-- Thêm cột này cho các DB on-premise đã chạy tới 004. Idempotent (IF NOT EXISTS).
ALTER TABLE xe ADD COLUMN IF NOT EXISTS chu_xe TEXT DEFAULT '';
