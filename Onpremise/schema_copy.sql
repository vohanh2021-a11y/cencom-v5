-- schema.sql — PostgreSQL schema for cencomOS_gara_4.0_supa (GĐ1)
-- Nguồn: server/db.js (SCHEMA + MIGRATIONS) + docs/rewrite/03_DATA_SCHEMA.md
-- Gi�� tên bảng/cột lowercase (mặc định PG), id `PREFIX-000001` (VARCHAR(12) PK), soft-delete `deleted_at TEXT DEFAULT ''`, JSON lưu TEXT.
-- Bỏ ảnh/OCR khỏi `bao_gia_ncc`. Thêm `tenant_id` cho multi-tenant (mặc định 'c1').

-- ===================== EXTENSIONS =====================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid, scrypt
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- fuzzy search
-- CREATE EXTENSION IF NOT EXISTS "pg_partman"; -- partition management (GĐ7)

-- ===================== HÀM TI��N ÍCH =====================
-- nextId counter (dùng bảng config counter)
CREATE OR REPLACE FUNCTION next_id(prefix TEXT) RETURNS TEXT AS $$
DECLARE
  counter BIGINT;
  new_id TEXT;
BEGIN
  -- Lấy và tăng counter trong transaction FOR UPDATE
  SELECT value::BIGINT + 1 INTO counter
  FROM config
  WHERE key = 'counter_' || prefix
  FOR UPDATE;
  
  IF counter IS NULL THEN
    counter := 1;
  END IF;
  
  new_id := prefix || '-' || LPAD(counter::TEXT, 6, '0');
  
  INSERT INTO config (key, value)
  VALUES ('counter_' || prefix, counter::TEXT)
  ON CONFLICT (key) DO UPDATE SET value = counter::TEXT;
  
  RETURN new_id;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- today() trả về YYYY-MM-DD
CREATE OR REPLACE FUNCTION today() RETURNS TEXT AS $$
SELECT TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD');
$$ LANGUAGE sql STABLE;

-- now_stamp() trả về YYYY-MM-DD HH24:MI:SS
CREATE OR REPLACE FUNCTION now_stamp() RETURNS TEXT AS $$
SELECT TO_CHAR(CURRENT_TIMESTAMP, 'YYYY-MM-DD HH24:MI:SS');
$$ LANGUAGE sql STABLE;

-- ===================== B��NG C��U H��NH =====================
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- ===================== B��NG GĐ2 (KI��M Đ��NH) =====================
CREATE TABLE IF NOT EXISTS phong_ban (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT,
  note TEXT,
  deleted_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS xe (
  id TEXT PRIMARY KEY,
  bks TEXT UNIQUE,
  bien_so_cu TEXT,
  hang TEXT,
  dong TEXT,
  nam_sx INT,
  lai_xe TEXT,
  phong_ban TEXT,
  trang_thai TEXT,
  loai_pt TEXT,
  ghi_chu TEXT,
  nguyen_gia REAL DEFAULT 0,
  lai_xe_id TEXT,
  deleted_at TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'c1'
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  role TEXT,
  phone TEXT,
  pass_hash TEXT,
  active INT DEFAULT 1,
  must_change INT DEFAULT 0,
  phong_ban TEXT,
  deleted_at TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'c1'
);

CREATE TABLE IF NOT EXISTS nhat_ky (
  id BIGSERIAL PRIMARY KEY,
  thoi_gian TIMESTAMPTZ DEFAULT NOW(),
  noi_dung TEXT,
  nguoi TEXT,
  tenant_id TEXT DEFAULT 'c1'
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- ===================== B��NG GĐ3 (S��A CH��A/KHO/TÀI S��N/QUY��N/AUDIT) =====================
CREATE TABLE IF NOT EXISTS congviec (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT,
  nhom TEXT,
  donvi TEXT,
  don_gia REAL,
  mo_ta TEXT,
  active INT DEFAULT 1,
  deleted_at TEXT DEFAULT '',
  gio_cong REAL,
  tenant_id TEXT DEFAULT 'c1'
);

CREATE TABLE IF NOT EXISTS vattu (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT,
  nhom TEXT,
  donvi TEXT,
  gia REAL,
  ton REAL,
  ton_min REAL,
  active INT DEFAULT 1,
  deleted_at TEXT DEFAULT '',
  ton_cu_hong REAL DEFAULT 0,
  tenant_id TEXT DEFAULT 'c1'
);

CREATE TABLE IF NOT EXISTS phieu_sua (
  id TEXT PRIMARY KEY,
  bks TEXT,
  phieu_kt TEXT,
  nguoi_lap TEXT,
  ngay TEXT,
  mo_ta TEXT,
  trang_thai TEXT DEFAULT 'de_xuat',
  nguoi_duyet TEXT,
  ngay_duyet TEXT,
  ly_do_tu_choi TEXT,
  nguoi_nghiem TEXT,
  ngay_nghiem TEXT,
  tong_cong REAL,
  tong_vt REAL,
  tong REAL,
  ghi_chu TEXT,
  deleted_at TEXT DEFAULT '',
  de_xuat_id TEXT,
  ngay_du_kien TEXT,
  ngay_bat_dau TEXT,
  tinh_trang_pt TEXT,
  la_sua_ngoai INT DEFAULT 0,
  don_vi_ngoai TEXT,
  tenant_id TEXT DEFAULT 'c1',
  CONSTRAINT chk_phieu_sua_trang_thai CHECK (trang_thai IN (
    'de_xuat','da_duyet','da_tong_duyet','dang_sua','cho_nghiem','da_hoan','da_quyet','tu_choi'
  ))
);

CREATE TABLE IF NOT EXISTS sc_congviec (
  id BIGSERIAL PRIMARY KEY,
  sc_id TEXT NOT NULL,
  congviec_id INT,
  ten TEXT,
  donvi TEXT,
  so_luong REAL DEFAULT 1,
  don_gia REAL,
  thanh REAL,
  ghi_chu TEXT,
  tho_id TEXT,
  tt TEXT DEFAULT 'todo',
  gio_cong REAL,
  stt INT,
  nguyen_nhan TEXT,
  loai_xu_ly TEXT,
  deleted_at TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'c1',
  CONSTRAINT chk_sc_congviec_tt CHECK (tt IN ('todo','dang','hoan')),
  CONSTRAINT chk_sc_congviec_loai_xu_ly CHECK (loai_xu_ly IN ('thay_the','khac_phuc'))
);

CREATE TABLE IF NOT EXISTS sc_vattu (
  id BIGSERIAL PRIMARY KEY,
  sc_id TEXT NOT NULL,
  vattu_id INT,
  ten TEXT,
  donvi TEXT,
  so_luong REAL,
  gd_dk REAL,
  gd_tt REAL,
  thanh REAL,
  tt TEXT DEFAULT 'can_mua',
  stt INT,
  nguyen_nhan TEXT,
  loai_xu_ly TEXT,
  ncc TEXT,
  gia_ngay REAL,
  deleted_at TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'c1',
  CONSTRAINT chk_sc_vattu_tt CHECK (tt IN ('can_mua','da_mua','da_xuat')),
  CONSTRAINT chk_sc_vattu_loai_xu_ly CHECK (loai_xu_ly IN ('thay_the','khac_phuc'))
);

CREATE TABLE IF NOT EXISTS de_nghi_mua (
  id TEXT PRIMARY KEY,
  nguoi_lap TEXT,
  ngay TEXT,
  trang_thai TEXT DEFAULT 'cho_duyet',
  nguoi_duyet TEXT,
  ngay_duyet TEXT,
  ly_do_tu_choi TEXT,
  tong REAL,
  ghi_chu TEXT,
  deleted_at TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'c1',
  CONSTRAINT chk_de_nghi_mua_trang_thai CHECK (trang_thai IN ('cho_duyet','da_duyet','tu_choi','da_nhap'))
);

CREATE TABLE IF NOT EXISTS dm_mua_ct (
  id BIGSERIAL PRIMARY KEY,
  dm_id TEXT NOT NULL,
  vattu_id INT,
  ten TEXT,
  donvi TEXT,
  so_luong REAL,
  dg_dk REAL,
  dg_tt REAL,
  tt TEXT DEFAULT 'cho_duyet',
  sc_id TEXT,
  deleted_at TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'c1',
  CONSTRAINT chk_dm_mua_ct_tt CHECK (tt IN ('cho_duyet','da_duyet','tu_choi','da_nhap'))
);

CREATE TABLE IF NOT EXISTS phieu_nhap (
  id TEXT PRIMARY KEY,
  ngay TEXT,
  nguoi_lap TEXT,
  nha_cc TEXT,
  nguoi_duyet TEXT,
  ref_dm TEXT,
  tong REAL,
  ghi_chu TEXT,
  deleted_at TEXT DEFAULT '',
  loai_nhap TEXT DEFAULT 'moi',
  nguoi_giao TEXT,
  ncc_dia_chi TEXT,
  ncc_sdt TEXT,
  tenant_id TEXT DEFAULT 'c1',
  CONSTRAINT chk_phieu_nhap_loai_nhap CHECK (loai_nhap IN ('moi','cu_hong'))
);

CREATE TABLE IF NOT EXISTS phieu_nh_ct (
  id BIGSERIAL PRIMARY KEY,
  ph_id TEXT NOT NULL,
  vattu_id INT,
  ten TEXT,
  donvi TEXT,
  so_luong REAL,
  dgia REAL,
  thanh REAL,
  ref_dm TEXT,
  ref_baogia INT,
  ref_sc TEXT,
  ncc TEXT,
  gia_ngay REAL,
  deleted_at TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'c1'
);

CREATE TABLE IF NOT EXISTS phieu_xuat (
  id TEXT PRIMARY KEY,
  ngay TEXT,
  nguoi_lap TEXT,
  ref_sc TEXT,
  ghi_chu TEXT,
  deleted_at TEXT DEFAULT '',
  nguoi_nhan TEXT,
  loai_xuat TEXT DEFAULT 'dung',
  tenant_id TEXT DEFAULT 'c1',
  CONSTRAINT chk_phieu_xuat_loai_xuat CHECK (loai_xuat IN ('dung','cu_hong'))
);

CREATE TABLE IF NOT EXISTS phieu_xuat_ct (
  id BIGSERIAL PRIMARY KEY,
  ph_id TEXT NOT NULL,
  vattu_id INT,
  ten TEXT,
  donvi TEXT,
  so_luong REAL,
  dgia REAL,
  thanh REAL,
  ref_sc TEXT,
  ncc TEXT,
  gia_ngay REAL,
  deleted_at TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'c1'
);

CREATE TABLE IF NOT EXISTS lich_sua (
  id BIGSERIAL PRIMARY KEY,
  sc_id TEXT NOT NULL,
  bks TEXT,
  ngay TEXT,
  tong_cong REAL,
  tong_vt REAL,
  tong REAL,
  nguoi TEXT,
  ghi_chu TEXT,
  deleted_at TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'c1'
);

CREATE TABLE IF NOT EXISTS phan_quyen (
  role TEXT,
  module TEXT,
  feature TEXT,
  PRIMARY KEY (role, module, feature)
);

CREATE TABLE IF NOT EXISTS log_audit (
  id BIGSERIAL PRIMARY KEY,
  thoi_gian TIMESTAMPTZ DEFAULT NOW(),
  nguoi TEXT,
  bang TEXT,
  id_dong TEXT,
  hanh_vi TEXT,
  noi_dung TEXT,
  tenant_id TEXT DEFAULT 'c1'
);

-- ===================== B��NG CHAT =====================
CREATE TABLE IF NOT EXISTS chat_threads (
  id TEXT PRIMARY KEY,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  kind TEXT,
  ref_id TEXT,
  last_msg TEXT,
  last_at TIMESTAMPTZ DEFAULT NOW(),
  unread INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  tenant_id TEXT DEFAULT 'c1'
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  thread_id TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  body TEXT,
  kind TEXT,
  source TEXT,
  ref_id TEXT,
  img_path TEXT,
  is_read INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  tenant_id TEXT DEFAULT 'c1'
);

-- ===================== B��NG GĐ3.6 — ĐỀ XUẤT SỬA CHỮA (DeXuat) =====================
-- Thay thế module Thăm khám (TK). Xưởng tạo đề xuất, quản lý/giám đốc duyệt,
-- sau đó chuyển thành phiếu sửa chữa (phieu_sua). Giữ nguyên hồ sơ 8 bước & phiếu kiểm tu.
CREATE TABLE IF NOT EXISTS de_xuat_sua_chua (
  id TEXT PRIMARY KEY,
  bks TEXT NOT NULL,
  ngay TEXT NOT NULL,
  nguoi_tao TEXT NOT NULL,
  mo_ta TEXT,
  dau_hieu TEXT,  -- JSON TEXT (các triệu chứng do xưởng ghi nhận)
  muc_uu_tien TEXT DEFAULT 'Binh_thuong',
  trang_thai TEXT DEFAULT 'cho_duyet',
  nguoi_duyet TEXT,
  ngay_duyet TEXT,
  ly_do_tu_choi TEXT,
  sc_id TEXT,  -- liên kết tới phieu_sua sau khi duyệt & tạo SC
  deleted_at TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'c1',
  CONSTRAINT chk_de_xuat_muc_uu_tien CHECK (muc_uu_tien IN ('Khan_cap','Xu_ly_som','Binh_thuong')),
  CONSTRAINT chk_de_xuat_trang_thai CHECK (trang_thai IN ('cho_duyet','da_duyet','tu_choi','da_chuyen_sc'))
);

CREATE INDEX IF NOT EXISTS idx_de_xuat_bks ON de_xuat_sua_chua (bks);
CREATE INDEX IF NOT EXISTS idx_de_xuat_trang_thai ON de_xuat_sua_chua (trang_thai);
CREATE INDEX IF NOT EXISTS idx_de_xuat_sc_id ON de_xuat_sua_chua (sc_id);

-- ===================== B��NG GĐ3.7 — B�� H�� S�� 8 B����C (ĐÃ B�� ��NH/OCR) =====================
CREATE TABLE IF NOT EXISTS bao_gia_ncc (
  id BIGSERIAL PRIMARY KEY,
  dm_id TEXT,
  sc_id TEXT,
  ncc_ten TEXT,
  ncc_dia_chi TEXT,
  ncc_sdt TEXT,
  ngay TEXT,
  loai_chung_tu TEXT DEFAULT 'bao_gia',
  ref_phieu_nhap TEXT,
  nguoi_lap TEXT,
  deleted_at TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'c1'
);

CREATE TABLE IF NOT EXISTS nhan_ky (
  id BIGSERIAL PRIMARY KEY,
  phieu_loai TEXT NOT NULL,
  phieu_id TEXT NOT NULL,
  vi_tri TEXT NOT NULL,
  nguoi_ky TEXT,
  chu_ky_data TEXT,
  ngay_ky TEXT,
  deleted_at TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'c1',
  UNIQUE (phieu_loai, phieu_id, vi_tri)
);

CREATE TABLE IF NOT EXISTS sc_phien_ban (
  id BIGSERIAL PRIMARY KEY,
  sc_id TEXT NOT NULL,
  nguoi_chot TEXT,
  ngay_chot TEXT,
  snapshot TEXT,  -- JSON TEXT
  deleted_at TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'c1'
);

CREATE TABLE IF NOT EXISTS vattu_gia_lich_su (
  id BIGSERIAL PRIMARY KEY,
  vattu_id INT,
  ten TEXT,
  ngay TEXT,
  gia REAL,
  phieu_id TEXT,
  nguon TEXT,
  ncc TEXT,
  deleted_at TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'c1'
);

CREATE TABLE IF NOT EXISTS bien_ban_nghiem (
  id BIGSERIAL PRIMARY KEY,
  sc_id TEXT NOT NULL,
  bks TEXT,
  ngay TEXT,
  ben_giao TEXT,
  ben_nhan TEXT,
  lai_xe TEXT,
  bao_hanh_ngay TEXT,
  ket_luan TEXT,
  nguoi_lap TEXT,
  tong_vat_tu REAL,
  tong_nhan_cong REAL,
  chi_tiet_json TEXT,
  deleted_at TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'c1'
);

CREATE TABLE IF NOT EXISTS phieu_kiem_tu (
  id TEXT PRIMARY KEY,
  sc_id TEXT,
  bks TEXT,
  nguoi_lap TEXT,
  ngay TEXT,
  chi_tiet TEXT,  -- JSON
  ket_luan TEXT,
  deleted_at TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'c1'
);

CREATE TABLE IF NOT EXISTS ke_hoach_sc (
  sc_id TEXT PRIMARY KEY,
  nguoi_bo_sung TEXT,
  ngay TEXT,
  hang_muc TEXT,  -- JSON
  tong_du_kien REAL,
  deleted_at TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'c1'
);

CREATE TABLE IF NOT EXISTS phieu_nhap_dm (
  dm_id TEXT NOT NULL,
  ph_id TEXT NOT NULL,
  PRIMARY KEY (dm_id, ph_id)
);

CREATE TABLE IF NOT EXISTS phieu_nhap_thanhly (
  id BIGSERIAL PRIMARY KEY,
  ph_id TEXT,
  vattu_id INT,
  ten TEXT,
  donvi TEXT,
  so_luong REAL,
  ly_do TEXT,
  gia_thanh_ly REAL,
  ngay_thanh_ly TEXT,
  deleted_at TEXT DEFAULT '',
  tenant_id TEXT DEFAULT 'c1'
);

-- ===================== INDEX B��T BU��C (Đ�� CHO WHERE/JOIN/ORDER) =====================
-- GĐ3
CREATE INDEX IF NOT EXISTS idx_phieu_sua_bks ON phieu_sua (bks);
CREATE INDEX IF NOT EXISTS idx_phieu_sua_de_xuat_id ON phieu_sua (de_xuat_id);
CREATE INDEX IF NOT EXISTS idx_sc_congviec_sc_id ON sc_congviec (sc_id);
CREATE INDEX IF NOT EXISTS idx_sc_vattu_sc_id ON sc_vattu (sc_id);
CREATE INDEX IF NOT EXISTS idx_dm_mua_ct_dm_id ON dm_mua_ct (dm_id);
CREATE INDEX IF NOT EXISTS idx_phieu_nh_ct_ph_id ON phieu_nh_ct (ph_id);
CREATE INDEX IF NOT EXISTS idx_phieu_xuat_ct_ph_id ON phieu_xuat_ct (ph_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON chat_messages (thread_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bao_gia_ncc_sc_id ON bao_gia_ncc (sc_id);
CREATE INDEX IF NOT EXISTS idx_bao_gia_ncc_dm_id ON bao_gia_ncc (dm_id);
CREATE INDEX IF NOT EXISTS idx_nhan_ky_phieu ON nhan_ky (phieu_loai, phieu_id);
CREATE INDEX IF NOT EXISTS idx_sc_phien_ban_sc_id ON sc_phien_ban (sc_id);
CREATE INDEX IF NOT EXISTS idx_vattu_gia_lich_su_vattu_id ON vattu_gia_lich_su (vattu_id);
CREATE INDEX IF NOT EXISTS idx_bien_ban_nghiem_sc_id ON bien_ban_nghiem (sc_id);
CREATE INDEX IF NOT EXISTS idx_phieu_kiem_tu_sc_id ON phieu_kiem_tu (sc_id);
CREATE INDEX IF NOT EXISTS idx_phieu_nhap_thanhly_ph_id ON phieu_nhap_thanhly (ph_id);
CREATE INDEX IF NOT EXISTS idx_phieu_nhap_dm_ph_id ON phieu_nhap_dm (ph_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_log_audit_thoi_gian ON log_audit (thoi_gian);

-- Partition lạnh (GĐ7) — chat_messages, log_audit, ket_qua partition theo tháng
-- CREATE SCHEMA IF NOT EXISTS part;
-- CREATE TABLE part.chat_messages_y2026m01 PARTITION OF chat_messages FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- ... (các partition khác tạo bằng pg_partman hoặc cron job)

-- ===================== RLS (GĐ10 — MULTI-TENANT) =====================
-- ALTER TABLE xe ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY xe_tenant ON xe USING (tenant_id = current_setting('app.tenant_id'));
-- ... (tương tự cho các bảng nghiệp vụ khác)
-- SET app.tenant_id = 'c1' mặc định.

-- ===================== SEED M��C Đ��NH (S�� CH��Y B��I seed.ts) =====================
-- INSERT INTO config (key, value) VALUES
--   ('duyet_sc_nguong', '5000000'),
--   ('duyet_mua_nguong', '5000000'),
--   ('khau_hao_nam', '10'),
--   ('counter_XE', '0'), ('counter_KT', '0'), ('counter_SC', '0'), ('counter_DX', '0'),
--   ('counter_DNM', '0'), ('counter_PXN', '0'), ('counter_PXX', '0'), ('counter_BD', '0');