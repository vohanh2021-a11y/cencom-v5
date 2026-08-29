-- schema.sql — cencomOS v5.0 (LEAN, plain PostgreSQL)
-- COPY chính xác từ gara_reconstruction/SCHEMA.md (dòng 7–181)
-- ============ AUTH ============
CREATE TABLE users (
  id          VARCHAR(12) PRIMARY KEY,
  name        TEXT NOT NULL,
  role        VARCHAR(20) NOT NULL CHECK (role IN ('admin','giamdoc','xuong','ketoan','kho')),
  pass_hash   TEXT NOT NULL,
  must_change SMALLINT DEFAULT 1,
  deleted_at  TEXT DEFAULT ''
);
CREATE INDEX idx_users_role ON users(role);

-- ============ XE ============
CREATE TABLE xe (
  id         VARCHAR(12) PRIMARY KEY,
  bien_so    TEXT NOT NULL,
  chu_xe     TEXT,
  nam_sx     INT,
  nguyen_gia NUMERIC(14,2) DEFAULT 0,
  is_test    SMALLINT DEFAULT 0,          -- admin test data
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX idx_xe_bien ON xe(bien_so);

-- ============ SC ============
CREATE TABLE sc (
  id         VARCHAR(12) PRIMARY KEY,
  xe_id      VARCHAR(12) NOT NULL REFERENCES xe(id),
  trang_thai VARCHAR(20) NOT NULL DEFAULT 'de_xuat'
             CHECK (trang_thai IN ('de_xuat','dang_sua','da_hoan','da_quyet','tu_choi')),
  ngay_tao   TEXT NOT NULL,
  nguoi_tao  VARCHAR(12) REFERENCES users(id),
  tong_cong  NUMERIC(14,2) DEFAULT 0,
  tong_vt    NUMERIC(14,2) DEFAULT 0,
  tong       NUMERIC(14,2) DEFAULT 0,
  is_test    SMALLINT DEFAULT 0,
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX idx_sc_trang ON sc(trang_thai);
CREATE INDEX idx_sc_xe ON sc(xe_id);

CREATE TABLE sc_congviec (
  id          VARCHAR(12) PRIMARY KEY,
  sc_id       VARCHAR(12) NOT NULL REFERENCES sc(id),
  stt         INT,
  mo_ta       TEXT,
  nguyen_nhan TEXT,
  loai_xu_ly  VARCHAR(20) CHECK (loai_xu_ly IN ('thay_moi','sua_chua','bao_duong','khac')),
  tt          VARCHAR(10) DEFAULT 'cho' CHECK (tt IN ('cho','dang','hoan')),
  so_luong    NUMERIC(10,2) DEFAULT 1,
  don_gia     NUMERIC(14,2) DEFAULT 0,
  deleted_at  TEXT DEFAULT ''
);
CREATE INDEX idx_sc_cv_sc ON sc_congviec(sc_id);

-- ============ KHO ============
CREATE TABLE vattu (
  id      VARCHAR(12) PRIMARY KEY,
  ten     TEXT NOT NULL,
  don_vi  TEXT,
  ton     NUMERIC(12,2) DEFAULT 0,
  gia     NUMERIC(14,2) DEFAULT 0,
  ton_min NUMERIC(12,2) DEFAULT 0,
  is_test SMALLINT DEFAULT 0,
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX idx_vattu_ten ON vattu(ten);

CREATE TABLE sc_vattu (
  id       VARCHAR(12) PRIMARY KEY,
  sc_id    VARCHAR(12) NOT NULL REFERENCES sc(id),
  vattu_id VARCHAR(12) NOT NULL REFERENCES vattu(id),
  so_luong NUMERIC(10,2) DEFAULT 0,
  gd_dk    NUMERIC(14,2) DEFAULT 0,
  gd_tt    NUMERIC(14,2) DEFAULT 0,
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX idx_sc_vt_sc ON sc_vattu(sc_id);

CREATE TABLE nhap_xuat (
  id       VARCHAR(12) PRIMARY KEY,
  vattu_id VARCHAR(12) NOT NULL REFERENCES vattu(id),
  loai     VARCHAR(10) CHECK (loai IN ('nhap','xuat')),
  so_luong NUMERIC(12,2),
  don_gia  NUMERIC(14,2),
  ly_do    TEXT,
  nguoi    VARCHAR(12) REFERENCES users(id),
  ngay     TEXT,
  sc_id    VARCHAR(12) REFERENCES sc(id),
  is_test  SMALLINT DEFAULT 0,
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX idx_nx_vattu ON nhap_xuat(vattu_id);

-- ============ DM ============
CREATE TABLE dm (
  id         VARCHAR(12) PRIMARY KEY,
  sc_id      VARCHAR(12) REFERENCES sc(id),
  trang_thai VARCHAR(20) DEFAULT 'cho_duyet'
             CHECK (trang_thai IN ('cho_duyet','da_nhap','tu_choi')),
  tong       NUMERIC(14,2) DEFAULT 0,
  nguoi_tao  VARCHAR(12) REFERENCES users(id),
  ngay_tao   TEXT,
  is_test    SMALLINT DEFAULT 0,
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX idx_dm_trang ON dm(trang_thai);

CREATE TABLE dm_chitiet (
  id       VARCHAR(12) PRIMARY KEY,
  dm_id    VARCHAR(12) NOT NULL REFERENCES dm(id),
  vattu_id VARCHAR(12) NOT NULL REFERENCES vattu(id),
  so_luong NUMERIC(12,2) DEFAULT 1,
  don_gia  NUMERIC(14,2) DEFAULT 0,
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX idx_dm_ct ON dm_chitiet(dm_id);

-- ============ BÁO GIÁ (GIỮ — 8 bước) ============
CREATE TABLE baogia (
  id        VARCHAR(12) PRIMARY KEY,
  sc_id     VARCHAR(12) REFERENCES sc(id),
  ncc       TEXT,
  ngay      TEXT,
  tong      NUMERIC(14,2) DEFAULT 0,
  nguoi_tao VARCHAR(12) REFERENCES users(id),
  is_test   SMALLINT DEFAULT 0,
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX idx_bg_sc ON baogia(sc_id);

CREATE TABLE baogia_chitiet (
  id        VARCHAR(12) PRIMARY KEY,
  baogia_id VARCHAR(12) NOT NULL REFERENCES baogia(id),
  ten       TEXT,
  so_luong  NUMERIC(12,2) DEFAULT 1,
  don_gia   NUMERIC(14,2) DEFAULT 0,
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX idx_bg_ct ON baogia_chitiet(baogia_id);

-- ============ HỒ SƠ KẾ TOÁN ============
CREATE TABLE ho_so (
  id         VARCHAR(12) PRIMARY KEY,
  sc_id      VARCHAR(12) NOT NULL REFERENCES sc(id),
  so_chung_tu TEXT,
  ngay       TEXT,
  ghi_chu    TEXT,
  nguoi_lap  VARCHAR(12) REFERENCES users(id),
  ngay_quyet TEXT,
  is_test    SMALLINT DEFAULT 0,
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX idx_hoso_sc ON ho_so(sc_id);

-- ============ ACTIVITY LOG ============
CREATE TABLE activity_log (
  id          BIGSERIAL PRIMARY KEY,
  ts          TIMESTAMPTZ DEFAULT now(),
  actor_id    VARCHAR(12) REFERENCES users(id),
  actor_role  VARCHAR(20),
  hanh_dong   TEXT NOT NULL,
  doi_tuong   TEXT,
  doi_tuong_id VARCHAR(12),
  sc_id       VARCHAR(12) REFERENCES sc(id),
  is_test     SMALLINT DEFAULT 0,
  mo_ta       TEXT
);
CREATE INDEX idx_act_ts ON activity_log(ts DESC);
CREATE INDEX idx_act_role ON activity_log(actor_role);
CREATE INDEX idx_act_sc ON activity_log(sc_id);

-- ============ CONFIG ============
CREATE TABLE config ( key TEXT PRIMARY KEY, value TEXT );

-- ============ KẾ HOẠCH SC (mẫu 01) — bước 1 hồ sơ 8 bước ============
CREATE TABLE ke_hoach_sc (
  id         VARCHAR(12) PRIMARY KEY,
  sc_id      VARCHAR(12) NOT NULL REFERENCES sc(id),
  mo_ta      TEXT,
  nguoi_lap  VARCHAR(12) REFERENCES users(id),
  ngay       TEXT,
  is_test    SMALLINT DEFAULT 0,
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX idx_kh_sc ON ke_hoach_sc(sc_id);

-- ============ PHIẾU KIỂM TU — bước 2 hồ sơ 8 bước ============
CREATE TABLE phieu_kiem_tu (
  id         VARCHAR(12) PRIMARY KEY,
  sc_id      VARCHAR(12) NOT NULL REFERENCES sc(id),
  mo_ta      TEXT,
  nguoi_kiem VARCHAR(12) REFERENCES users(id),
  ngay       TEXT,
  is_test    SMALLINT DEFAULT 0,
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX idx_kt_sc ON phieu_kiem_tu(sc_id);

-- ============ BIÊN BẢN NGHIỆM THU — bước 7 hồ sơ 8 bước ============
CREATE TABLE bien_ban_nghiem (
  id             VARCHAR(12) PRIMARY KEY,
  sc_id          VARCHAR(12) NOT NULL REFERENCES sc(id),
  ngay_nghiem    TEXT,
  nguoi_nghiem   VARCHAR(12) REFERENCES users(id),
  tong_vat_tu    NUMERIC(14,2) DEFAULT 0,
  tong_nhan_cong NUMERIC(14,2) DEFAULT 0,
  is_test        SMALLINT DEFAULT 0,
  deleted_at     TEXT DEFAULT ''
);
CREATE INDEX idx_nn_sc ON bien_ban_nghiem(sc_id);

-- ============ BÁO GIÁ NCC (v4) — bước 3 hồ sơ 8 bước ============
CREATE TABLE bao_gia_ncc (
  id           VARCHAR(12) PRIMARY KEY,
  sc_id        VARCHAR(12) REFERENCES sc(id),
  ncc          TEXT,
  ngay         TEXT,
  tong         NUMERIC(14,2) DEFAULT 0,
  ocr_xac_nhan SMALLINT DEFAULT 0,
  anh_bao_gia  TEXT DEFAULT '',
  nguoi_tao    VARCHAR(12) REFERENCES users(id),
  is_test      SMALLINT DEFAULT 0,
  deleted_at   TEXT DEFAULT ''
);
CREATE INDEX idx_bgn_sc ON bao_gia_ncc(sc_id);
