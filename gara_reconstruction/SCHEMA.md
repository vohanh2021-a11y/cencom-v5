# SCHEMA — PostgreSQL (LEAN v5.0, 12 bảng + is_test)

> Giữ: id `PREFIX-000001` (VARCHAR 12), soft-delete `deleted_at TEXT`, ngày TEXT.
> **v3 mới**: thêm `is_test SMALLINT DEFAULT 0` trên các bảng tạo được — đánh dấu
> dữ liệu thử của admin, **tự xoá (soft-delete) sau 1 ngày** qua cron.

```sql
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
```

## CHÍNH SÁCH DỮ LIỆU TEST (TEST DATA POLICY)

- Mọi bảng tạo được (`xe, sc, vattu, nhap_xuat, dm, baogia, ho_so`) có cờ `is_test`.
- Bảng con (`sc_congviec, sc_vattu, dm_chitiet, baogia_chitiet`) **kế thừa** `is_test`
  theo bảng cha (khi tạo, copy `is_test` từ sc/dm/baogia).
- **Admin** tạo dữ liệu test → hệ thống tự set `is_test=1`.
- **Cron hàng ngày** (hoặc khi startup): soft-delete (`deleted_at = ngày hôm nay`)
  mọi dòng `is_test=1` có `ts/ngay_tao` cũ hơn 1 ngày.
- Dữ liệu `is_test=0` (thật) **KHÔNG bao giờ** bị tự xoá.
- Giám đốc xem mọi thứ (kể cả test) để kiểm tra; nhưng report/chi phí chỉ tính
  dữ liệu thật (`is_test=0`) để không lệch số liệu.

## So với v2
- Thêm `is_test` 7 bảng + chính sách tự huỷ 1 ngày (yêu cầu admin test).
- Giữ nguyên: 12 bảng, baogia, activity_log, không duyệt/ngưỡng, không nhanKy.
