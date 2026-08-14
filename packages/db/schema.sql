-- =====================================================================
-- cencomOS-Garage v4.0 — SCHEMA PostgreSQL (Supabase)
-- Nguồn: PLAN_14.08_supa.md mục 6 (quyết định duy nhất) + server/db.js v3.6
-- Quy ước:
--   * Giữ tên bảng/cột lowercase (mặc định PG).
--   * id TEXT PK định dạng `PREFIX-000001` (KHÔNG ép VARCHAR(12) — có
--     bảng dùng id dài hơn, ví dụ chat_threads 'CHT-...').
--   * Soft-delete: `deleted_at TEXT DEFAULT ''` (không NULL).
--   * Ngày tháng: GIỮ TEXT `YYYY-MM-DD` (quyết định duy nhất — không đổi format).
--   * JSON lưu TEXT.
--   * Đã BỎ ảnh báo giá/AI-OCR khỏi bao_gia_ncc (quyết định #9).
--   * Multi-tenant: tenant_id + RLS thêm ở GĐ10 (mục 6.8) — không làm ở GĐ1.
-- =====================================================================

-- ============ GĐ2 — KIỂM ĐỊNH ============

CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS phong_ban (
  id         TEXT PRIMARY KEY,
  code       TEXT,
  name       TEXT,
  note       TEXT,
  deleted_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS xe (
  id           TEXT PRIMARY KEY,
  bks          TEXT UNIQUE,
  bien_so_cu   TEXT,
  hang         TEXT,
  dong         TEXT,
  nam_sx       INTEGER,
  lai_xe       TEXT,
  danh_gia_pct REAL,
  phong_ban    TEXT,
  trang_thai   TEXT,
  loai_pt      TEXT,
  ghi_chu      TEXT,
  nguyen_gia   REAL DEFAULT 0,
  lai_xe_id    TEXT DEFAULT '',
  deleted_at   TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS bieu_ma (
  item_id    INTEGER PRIMARY KEY,
  group_id   INTEGER,
  group_name TEXT,
  group_short TEXT,
  item_name  TEXT,
  priority   TEXT,
  deleted_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS kiem_tra (
  id         TEXT PRIMARY KEY,
  bks        TEXT,
  mode       TEXT,
  ngay       TEXT,
  nguoi      TEXT,
  trang_thai TEXT,
  ghi_chu    TEXT,
  assignee   TEXT DEFAULT '',
  deadline   TEXT DEFAULT '',
  done_at    TEXT DEFAULT '',
  deleted_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  role        TEXT,
  phone       TEXT,
  pass_hash   TEXT,
  active      INTEGER DEFAULT 1,
  must_change INTEGER DEFAULT 0,
  phong_ban   TEXT DEFAULT '',
  deleted_at  TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS ket_qua (
  id         TEXT PRIMARY KEY,
  phieu_id   TEXT,
  bks        TEXT,
  item_id    INTEGER,
  group_id   INTEGER,
  value      TEXT,
  ghi_chu    TEXT,
  deleted_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS bao_duong (
  id          TEXT PRIMARY KEY,
  bks         TEXT,
  loai        TEXT,
  chu_ky_ngay INTEGER,
  lan_cuoi    TEXT,
  lan_sau     TEXT,
  canh_bao    TEXT,
  deleted_at  TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS nhat_ky (
  id        BIGSERIAL PRIMARY KEY,
  thoi_gian TEXT,
  noi_dung  TEXT,
  nguoi     TEXT
);

-- Session: created_at/expires_at dùng TIMESTAMPTZ (khác SQLite epoch integer)
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- ============ GĐ3 — SỬA CHỮA, VẬT TƯ/KHO, TÀI SẢN, QUYỀN, AUDIT ============

CREATE TABLE IF NOT EXISTS congviec (
  id         BIGSERIAL PRIMARY KEY,
  code       TEXT UNIQUE,
  name       TEXT,
  nhom       TEXT DEFAULT '',
  donvi      TEXT DEFAULT '',
  don_gia    REAL DEFAULT 0,
  mo_ta      TEXT DEFAULT '',
  active     INTEGER DEFAULT 1,
  deleted_at TEXT DEFAULT '',
  gio_cong   REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vattu (
  id          BIGSERIAL PRIMARY KEY,
  code        TEXT UNIQUE,
  name        TEXT,
  nhom        TEXT DEFAULT '',
  donvi       TEXT DEFAULT '',
  gia         REAL DEFAULT 0,
  ton         REAL DEFAULT 0,
  ton_min     REAL DEFAULT 0,
  active      INTEGER DEFAULT 1,
  deleted_at  TEXT DEFAULT '',
  ton_cu_hong REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS phieu_sua (
  id            TEXT PRIMARY KEY,
  bks           TEXT,
  phieu_kt      TEXT DEFAULT '',
  nguoi_lap     TEXT DEFAULT '',
  ngay          TEXT DEFAULT '',
  mo_ta         TEXT DEFAULT '',
  trang_thai    TEXT DEFAULT 'de_xuat',
  nguoi_duyet   TEXT DEFAULT '',
  ngay_duyet    TEXT DEFAULT '',
  ly_do_tu_choi TEXT DEFAULT '',
  nguoi_nghiem  TEXT DEFAULT '',
  ngay_nghiem   TEXT DEFAULT '',
  tong_cong     REAL DEFAULT 0,
  tong_vt       REAL DEFAULT 0,
  tong          REAL DEFAULT 0,
  ghi_chu       TEXT DEFAULT '',
  deleted_at    TEXT DEFAULT '',
  tk_id         TEXT DEFAULT '',
  ngay_du_kien  TEXT DEFAULT '',
  ngay_bat_dau  TEXT DEFAULT '',
  tinh_trang_pt TEXT DEFAULT '',
  la_sua_ngoai  INTEGER DEFAULT 0,
  don_vi_ngoai  TEXT DEFAULT '',
  CONSTRAINT chk_phieu_sua_trang_thai
    CHECK (trang_thai IN ('', 'de_xuat', 'da_duyet', 'da_tong_duyet', 'dang_sua',
                          'cho_nghiem', 'da_hoan', 'da_quyet', 'tu_choi'))
);

CREATE TABLE IF NOT EXISTS sc_congviec (
  id          BIGSERIAL PRIMARY KEY,
  sc_id       TEXT,
  congviec_id INTEGER DEFAULT 0,
  ten         TEXT DEFAULT '',
  donvi       TEXT DEFAULT '',
  so_luong    REAL DEFAULT 1,
  don_gia     REAL DEFAULT 0,
  thanh       REAL DEFAULT 0,
  ghi_chu     TEXT DEFAULT '',
  tho_id      TEXT DEFAULT '',
  tt          TEXT DEFAULT 'todo',
  gio_cong    REAL DEFAULT 0,
  stt         INTEGER DEFAULT 0,
  nguyen_nhan TEXT DEFAULT '',
  loai_xu_ly  TEXT DEFAULT '',
  deleted_at  TEXT DEFAULT '',
  CONSTRAINT chk_sc_congviec_tt CHECK (tt IN ('', 'todo', 'dang', 'hoan')),
  CONSTRAINT chk_sc_congviec_loai_xu_ly CHECK (loai_xu_ly IN ('', 'thay_the', 'khac_phuc'))
);

CREATE TABLE IF NOT EXISTS sc_vattu (
  id          BIGSERIAL PRIMARY KEY,
  sc_id       TEXT NOT NULL,
  vattu_id    INTEGER DEFAULT 0,
  ten         TEXT DEFAULT '',
  donvi       TEXT DEFAULT '',
  so_luong    REAL DEFAULT 0,
  gd_dk       REAL DEFAULT 0,
  gd_tt       REAL DEFAULT 0,
  thanh       REAL DEFAULT 0,
  tt          TEXT DEFAULT 'can_mua',
  stt         INTEGER DEFAULT 0,
  nguyen_nhan TEXT DEFAULT '',
  loai_xu_ly  TEXT DEFAULT '',
  bao_gia_id  TEXT DEFAULT '',
  ncc         TEXT DEFAULT '',
  gia_ngay    TEXT DEFAULT '',
  deleted_at  TEXT DEFAULT '',
  CONSTRAINT chk_sc_vattu_tt CHECK (tt IN ('', 'can_mua', 'da_mua', 'da_xuat')),
  CONSTRAINT chk_sc_vattu_loai_xu_ly CHECK (loai_xu_ly IN ('', 'thay_the', 'khac_phuc'))
);

CREATE TABLE IF NOT EXISTS de_nghi_mua (
  id            TEXT PRIMARY KEY,
  nguoi_lap     TEXT DEFAULT '',
  ngay          TEXT DEFAULT '',
  trang_thai    TEXT DEFAULT 'cho_duyet',
  nguoi_duyet   TEXT DEFAULT '',
  ngay_duyet    TEXT DEFAULT '',
  ly_do_tu_choi TEXT DEFAULT '',
  tong          REAL DEFAULT 0,
  ghi_chu       TEXT DEFAULT '',
  deleted_at    TEXT DEFAULT '',
  CONSTRAINT chk_de_nghi_mua_trang_thai
    CHECK (trang_thai IN ('', 'cho_duyet', 'da_duyet', 'tu_choi', 'da_nhap'))
);

CREATE TABLE IF NOT EXISTS dm_mua_ct (
  id         BIGSERIAL PRIMARY KEY,
  dm_id      TEXT,
  vattu_id   INTEGER DEFAULT 0,
  ten        TEXT DEFAULT '',
  donvi      TEXT DEFAULT '',
  so_luong   REAL DEFAULT 0,
  dg_dk      REAL DEFAULT 0,
  dg_tt      REAL DEFAULT 0,
  tt         TEXT DEFAULT 'cho_duyet',
  sc_id      TEXT DEFAULT '',
  deleted_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS phieu_nhap (
  id           TEXT PRIMARY KEY,
  ngay         TEXT DEFAULT '',
  nguoi_lap    TEXT DEFAULT '',
  nha_cc       TEXT DEFAULT '',
  nguoi_duyet  TEXT DEFAULT '',
  ref_dm       TEXT DEFAULT '',
  tong         REAL DEFAULT 0,
  ghi_chu      TEXT DEFAULT '',
  deleted_at   TEXT DEFAULT '',
  loai_nhap    TEXT DEFAULT 'moi',
  nguoi_giao   TEXT DEFAULT '',
  ncc_dia_chi  TEXT DEFAULT '',
  ncc_sdt      TEXT DEFAULT '',
  CONSTRAINT chk_phieu_nhap_loai_nhap CHECK (loai_nhap IN ('', 'moi', 'cu_hong'))
);

CREATE TABLE IF NOT EXISTS phieu_nh_ct (
  id          BIGSERIAL PRIMARY KEY,
  ph_id       TEXT,
  vattu_id    INTEGER DEFAULT 0,
  ten         TEXT DEFAULT '',
  donvi       TEXT DEFAULT '',
  so_luong    REAL DEFAULT 0,
  dgia        REAL DEFAULT 0,
  thanh       REAL DEFAULT 0,
  ref_dm      TEXT DEFAULT '',
  ref_baogia  TEXT DEFAULT '',
  ref_sc      TEXT DEFAULT '',
  ncc         TEXT DEFAULT '',
  gia_ngay    TEXT DEFAULT '',
  deleted_at  TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS phieu_xuat (
  id          TEXT PRIMARY KEY,
  ngay        TEXT DEFAULT '',
  nguoi_lap   TEXT DEFAULT '',
  ref_sc      TEXT DEFAULT '',
  ghi_chu     TEXT DEFAULT '',
  deleted_at  TEXT DEFAULT '',
  nguoi_nhan  TEXT DEFAULT '',
  loai_xuat   TEXT DEFAULT 'dung',
  CONSTRAINT chk_phieu_xuat_loai_xuat CHECK (loai_xuat IN ('', 'dung', 'cu_hong'))
);

CREATE TABLE IF NOT EXISTS phieu_xuat_ct (
  id          BIGSERIAL PRIMARY KEY,
  ph_id       TEXT,
  vattu_id    INTEGER DEFAULT 0,
  ten         TEXT DEFAULT '',
  donvi       TEXT DEFAULT '',
  so_luong    REAL DEFAULT 0,
  dgia        REAL DEFAULT 0,
  thanh       REAL DEFAULT 0,
  ref_sc      TEXT DEFAULT '',
  ncc         TEXT DEFAULT '',
  gia_ngay    TEXT DEFAULT '',
  deleted_at  TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS lich_sua (
  id         BIGSERIAL PRIMARY KEY,
  sc_id      TEXT,
  bks        TEXT DEFAULT '',
  ngay       TEXT DEFAULT '',
  tong_cong  REAL DEFAULT 0,
  tong_vt    REAL DEFAULT 0,
  tong       REAL DEFAULT 0,
  nguoi      TEXT DEFAULT '',
  ghi_chu    TEXT DEFAULT '',
  deleted_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS phan_quyen (
  role    TEXT,
  module  TEXT,
  feature TEXT,
  PRIMARY KEY (role, module, feature)
);

CREATE TABLE IF NOT EXISTS log_audit (
  id        BIGSERIAL PRIMARY KEY,
  thoi_gian TEXT DEFAULT '',
  nguoi     TEXT DEFAULT '',
  bang      TEXT DEFAULT '',
  id_dong   TEXT DEFAULT '',
  hanh_vi   TEXT DEFAULT '',
  noi_dung  TEXT DEFAULT ''
);

-- ============ GĐ3 — CHAT / GIAO VIỆC NỘI BỘ ============

CREATE TABLE IF NOT EXISTS chat_threads (
  id         TEXT PRIMARY KEY,
  from_id    TEXT NOT NULL,
  to_id      TEXT NOT NULL,
  kind       TEXT DEFAULT 'text',
  ref_id     TEXT DEFAULT '',
  last_msg   TEXT DEFAULT '',
  last_at    TEXT DEFAULT '',
  unread     INTEGER DEFAULT 0,
  created_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         BIGSERIAL PRIMARY KEY,
  thread_id  TEXT NOT NULL,
  from_id    TEXT NOT NULL,
  to_id      TEXT NOT NULL,
  body       TEXT DEFAULT '',
  kind       TEXT DEFAULT 'text',
  source     TEXT DEFAULT 'user',
  ref_id     TEXT DEFAULT '',
  img_path   TEXT DEFAULT '',
  is_read    INTEGER DEFAULT 0,
  created_at TEXT DEFAULT ''
);

-- ============ GĐ3.6 — YÊU CẦU THĂM KHÁM TỪ LÁI XE ============

CREATE TABLE IF NOT EXISTS yeu_cau_tham_kham (
  id            TEXT PRIMARY KEY,
  bks           TEXT NOT NULL,
  lai_xe        TEXT DEFAULT '',
  ngay          TEXT DEFAULT '',
  mo_ta         TEXT DEFAULT '',
  dau_hieu      TEXT DEFAULT '',
  muc_uu_tien   TEXT DEFAULT 'Binh_thuong',
  trang_thai    TEXT DEFAULT 'cho_duyet',
  nguoi_duyet   TEXT DEFAULT '',
  ngay_duyet    TEXT DEFAULT '',
  ly_do_tu_choi TEXT DEFAULT '',
  nguoi_xuong   TEXT DEFAULT '',
  ngay_xuong    TEXT DEFAULT '',
  ly_do_xuong   TEXT DEFAULT '',
  tho_id        TEXT DEFAULT '',
  ngay_giao_tho TEXT DEFAULT '',
  sc_id         TEXT DEFAULT '',
  img_paths     TEXT DEFAULT '',
  deleted_at    TEXT DEFAULT '',
  CONSTRAINT chk_tk_muc_uu_tien CHECK (muc_uu_tien IN ('', 'Khan_cap', 'Xu_ly_som', 'Binh_thuong')),
  CONSTRAINT chk_tk_trang_thai
    CHECK (trang_thai IN ('', 'cho_duyet', 'da_duyet', 'tu_choi', 'xuong_nhan',
                          'xuong_tu_choi', 'da_giao_tho', 'dang_thuc_hien',
                          'da_hoan', 'da_huy'))
);

-- ============ GĐ3.7 — BỘ HỒ SƠ 8 BƯỚC (ĐÃ BỎ ẢNH/OCR) ============

CREATE TABLE IF NOT EXISTS bao_gia_ncc (
  id             BIGSERIAL PRIMARY KEY,
  dm_id          TEXT DEFAULT '',
  sc_id          TEXT DEFAULT '',
  ncc_ten        TEXT DEFAULT '',
  ncc_dia_chi    TEXT DEFAULT '',
  ncc_sdt        TEXT DEFAULT '',
  ngay           TEXT DEFAULT '',
  loai_chung_tu  TEXT DEFAULT 'bao_gia',
  ref_phieu_nhap TEXT DEFAULT '',
  nguoi_lap      TEXT DEFAULT '',
  deleted_at     TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS nhan_ky (
  id           BIGSERIAL PRIMARY KEY,
  phieu_loai   TEXT NOT NULL,
  phieu_id     TEXT NOT NULL,
  vi_tri       TEXT NOT NULL,
  nguoi_ky     TEXT DEFAULT '',
  chu_ky_data  TEXT DEFAULT '',
  ngay_ky      TEXT DEFAULT '',
  deleted_at   TEXT DEFAULT '',
  CONSTRAINT uq_nhan_ky UNIQUE (phieu_loai, phieu_id, vi_tri)
);

CREATE TABLE IF NOT EXISTS sc_phien_ban (
  id         BIGSERIAL PRIMARY KEY,
  sc_id      TEXT NOT NULL,
  nguoi_chot TEXT DEFAULT '',
  ngay_chot  TEXT DEFAULT '',
  snapshot   TEXT DEFAULT '',
  deleted_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS vattu_gia_lich_su (
  id         BIGSERIAL PRIMARY KEY,
  vattu_id   INTEGER DEFAULT 0,
  ten        TEXT DEFAULT '',
  ngay       TEXT DEFAULT '',
  gia        REAL DEFAULT 0,
  phieu_id   TEXT DEFAULT '',
  nguon      TEXT DEFAULT '',
  ncc        TEXT DEFAULT '',
  deleted_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS bien_ban_nghiem (
  id             BIGSERIAL PRIMARY KEY,
  sc_id          TEXT NOT NULL,
  bks            TEXT DEFAULT '',
  ngay           TEXT DEFAULT '',
  ben_giao       TEXT DEFAULT '',
  ben_nhan       TEXT DEFAULT '',
  lai_xe         TEXT DEFAULT '',
  bao_hanh_ngay  TEXT DEFAULT '',
  ket_luan       TEXT DEFAULT '',
  nguoi_lap      TEXT DEFAULT '',
  tong_vat_tu    REAL DEFAULT 0,
  tong_nhan_cong REAL DEFAULT 0,
  chi_tiet_json  TEXT DEFAULT '',
  deleted_at     TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS phieu_kiem_tu (
  id         TEXT PRIMARY KEY,
  sc_id      TEXT DEFAULT '',
  bks        TEXT DEFAULT '',
  nguoi_lap  TEXT DEFAULT '',
  ngay       TEXT DEFAULT '',
  chi_tiet   TEXT DEFAULT '',
  ket_luan   TEXT DEFAULT '',
  deleted_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS ke_hoach_sc (
  sc_id          TEXT PRIMARY KEY,
  nguoi_bo_sung  TEXT DEFAULT '',
  ngay           TEXT DEFAULT '',
  hang_muc       TEXT DEFAULT '',
  tong_du_kien   REAL DEFAULT 0,
  deleted_at     TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS phieu_nhap_dm (
  dm_id TEXT NOT NULL,
  ph_id TEXT NOT NULL,
  PRIMARY KEY (dm_id, ph_id)
);

CREATE TABLE IF NOT EXISTS phieu_nhap_thanhly (
  id             BIGSERIAL PRIMARY KEY,
  ph_id          TEXT DEFAULT '',
  vattu_id       INTEGER DEFAULT 0,
  ten            TEXT DEFAULT '',
  donvi          TEXT DEFAULT '',
  so_luong       REAL DEFAULT 0,
  ly_do          TEXT DEFAULT '',
  gia_thanh_ly   REAL DEFAULT 0,
  ngay_thanh_ly  TEXT DEFAULT '',
  deleted_at     TEXT DEFAULT ''
);

-- ============ INDEX BẮT BUỘC (PLAN mục 6.6) ============

CREATE INDEX IF NOT EXISTS idx_kq_phieu    ON ket_qua(phieu_id);
CREATE INDEX IF NOT EXISTS idx_kq_bks      ON ket_qua(bks);
CREATE INDEX IF NOT EXISTS idx_kq_item     ON ket_qua(item_id);
CREATE INDEX IF NOT EXISTS idx_kt_bks      ON kiem_tra(bks);
CREATE INDEX IF NOT EXISTS idx_bd_bks      ON bao_duong(bks);

CREATE INDEX IF NOT EXISTS idx_ps_bks      ON phieu_sua(bks);
CREATE INDEX IF NOT EXISTS idx_psqc_sc     ON sc_congviec(sc_id);
CREATE INDEX IF NOT EXISTS idx_psvt_sc     ON sc_vattu(sc_id);
CREATE INDEX IF NOT EXISTS idx_dnm_ct      ON dm_mua_ct(dm_id);
CREATE INDEX IF NOT EXISTS idx_pn_ct       ON phieu_nh_ct(ph_id);
CREATE INDEX IF NOT EXISTS idx_pxx_ct      ON phieu_xuat_ct(ph_id);

CREATE INDEX IF NOT EXISTS idx_chat_msgs_thread ON chat_messages(thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tk_bks       ON yeu_cau_tham_kham(bks);
CREATE INDEX IF NOT EXISTS idx_tk_lai_xe    ON yeu_cau_tham_kham(lai_xe);
CREATE INDEX IF NOT EXISTS idx_tk_trang_thai ON yeu_cau_tham_kham(trang_thai);

CREATE INDEX IF NOT EXISTS idx_bg_sc        ON bao_gia_ncc(sc_id);
CREATE INDEX IF NOT EXISTS idx_bg_dm        ON bao_gia_ncc(dm_id);
CREATE INDEX IF NOT EXISTS idx_nk_phieu     ON nhan_ky(phieu_loai, phieu_id);
CREATE INDEX IF NOT EXISTS idx_spb_sc       ON sc_phien_ban(sc_id);
CREATE INDEX IF NOT EXISTS idx_vgl_vt       ON vattu_gia_lich_su(vattu_id);
CREATE INDEX IF NOT EXISTS idx_bbn_sc       ON bien_ban_nghiem(sc_id);
CREATE INDEX IF NOT EXISTS idx_kt_sc        ON phieu_kiem_tu(sc_id);
CREATE INDEX IF NOT EXISTS idx_pnd_ph       ON phieu_nhap_dm(ph_id);
CREATE INDEX IF NOT EXISTS idx_pntl_ph      ON phieu_nhap_thanhly(ph_id);

-- Index hiệu năng (Phase 5 v3.6 — giữ)
CREATE INDEX IF NOT EXISTS idx_bg_loai         ON bao_gia_ncc(loai_chung_tu);
CREATE INDEX IF NOT EXISTS idx_ps_trang_thai   ON phieu_sua(trang_thai);
CREATE INDEX IF NOT EXISTS idx_ps_trang_thai_ngay ON phieu_sua(trang_thai, ngay);
CREATE INDEX IF NOT EXISTS idx_sc_cv_tt        ON sc_congviec(tt);
CREATE INDEX IF NOT EXISTS idx_vt_ton          ON vattu(ton_min, ton);
CREATE INDEX IF NOT EXISTS idx_ls_ngay         ON lich_sua(ngay);

-- Index phục vụ truy vấn thường xuyên
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_log_audit_time   ON log_audit(thoi_gian);

-- =====================================================================
-- GHI CHÚ (KHÔNG TẠO Ở GĐ1):
--  * Partition lạnh chat_messages/log_audit/ket_qua theo tháng — GĐ7 (mục 6.7).
--  * tenant_id + RLS multi-tenant — GĐ10 (mục 6.8).
--  * Materialized view thống kê — GĐ6/7.
-- =====================================================================