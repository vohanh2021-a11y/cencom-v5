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

-- ============ W3.3A (XƯỞNG — dòng công việc + deadline) ============
-- sc_congviec.tho_id: port v3.6 db.js dòng 97 (giao việc cho thợ — thoList phục vụ gán).
-- sc.han_tra_xe: deadline trả xe — v3.6 tương ứng phieu_sua.ngay_du_kien
--   (db.js migrate dòng 284 "TEXT DEFAULT ''"; ghi qua scSetDeadline sc.js:274–289).
--   v5 đổi tên cột theo ngữ nghĩa frontend (han_tra_xe); giữ nguyên kiểu TEXT ''
--   (soft-not-null, '' = chưa hẹn — xóa hẹn bằng cách set '').
-- Index: v3.6 KHÔNG có index trên tho_id/ngay_du_kien (chỉ idx_psqc_sc sc_id +
--   idx_sc_cv_tt tt, db.js:154,362) → v5 giữ nguyên, không thừa chỉ mục.
-- ALTER IF NOT EXISTS chạy idempotent cho cả DB fresh (CREATE phía trên) lẫn dev/live.
ALTER TABLE sc_congviec ADD COLUMN IF NOT EXISTS tho_id     TEXT DEFAULT '';
ALTER TABLE sc          ADD COLUMN IF NOT EXISTS han_tra_xe TEXT DEFAULT '';

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
  -- W1a phiếu 2 tầng (PLAN_HOI_TU_01.09): KHÔNG lập bảng phieu riêng.
  --   phieu_id = id dòng đầu nhóm (dòng đầu tự tham chiếu); '' = dòng đơn kiểu cũ.
  --   effective group id = COALESCE(NULLIF(phieu_id,''), id) — tương thích lùi 100%.
  phieu_id TEXT DEFAULT '',
  ncc      TEXT,                     -- header NCC (nullable — thêm theo chốt W1a)
  is_test  SMALLINT DEFAULT 0,
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX idx_nx_vattu ON nhap_xuat(vattu_id);
-- W1a: index tra theo phiếu + index biểu thức cho GROUP BY effective-group
CREATE INDEX ix_nhap_xuat_phieu ON nhap_xuat(phieu_id);
CREATE INDEX ix_nhap_xuat_eff ON nhap_xuat((COALESCE(NULLIF(phieu_id, ''), id)));

-- ============ DM ============
-- W2b: trạng thái 'da_duyet' + cột duyệt port NGUYÊN v3.6 `de_nghi_mua`
-- (db.js dòng 107–111: nguoi_duyet/ngay_duyet/ly_do_tu_choi ĐỀU TEXT DEFAULT '').
-- v5 gộp `ly_do_tu_choi` + `ghi_chu` v3.6 THÀNH MỘT cột `ly_do` (lean schema):
--   - tu_choi  -> ly_do = lý do từ chối       (v3.6: ly_do_tu_choi, kho.js:243)
--   - dmFromSC/autoBu -> ly_do = ghi chú tạo  (v3.6: ghi_chu, qua dmCreate)
-- Cột đặt DEFAULT '' theo đúng v3.6 (soft-not-null; không NOT NULL như deleted_at
-- vì v3.6 cho phép NULL — giữ nguyên hành vi đọc).
CREATE TABLE dm (
  id          VARCHAR(12) PRIMARY KEY,
  sc_id       VARCHAR(12) REFERENCES sc(id),
  trang_thai  VARCHAR(20) DEFAULT 'cho_duyet'
              CHECK (trang_thai IN ('cho_duyet','da_duyet','da_nhap','tu_choi')),
  tong        NUMERIC(14,2) DEFAULT 0,
  nguoi_tao   VARCHAR(12) REFERENCES users(id),
  ngay_tao    TEXT,
  nguoi_duyet TEXT DEFAULT '',
  ngay_duyet  TEXT DEFAULT '',
  ly_do       TEXT DEFAULT '',
  is_test     SMALLINT DEFAULT 0,
  deleted_at  TEXT DEFAULT ''
);
CREATE INDEX idx_dm_trang ON dm(trang_thai);
-- W2b idempotent cho DB ĐÃ tồn tại trước khi có 'da_duyet' (dev/live):
-- CREATE TABLE inline trên chỉ áp cho DB mới; DB cũ giữ CHECK 3 giá trị →
-- DROP + ADD cùng tên PG tự sinh (dm_trang_thai_check). NOT NULL-free ADD
-- COLUMN IF NOT EXISTS với DEFAULT '' scan-free trên PG >= 11.
ALTER TABLE dm DROP CONSTRAINT IF EXISTS dm_trang_thai_check;
ALTER TABLE dm ADD CONSTRAINT dm_trang_thai_check
  CHECK (trang_thai IN ('cho_duyet','da_duyet','da_nhap','tu_choi'));
ALTER TABLE dm ADD COLUMN IF NOT EXISTS nguoi_duyet TEXT DEFAULT '';
ALTER TABLE dm ADD COLUMN IF NOT EXISTS ngay_duyet  TEXT DEFAULT '';
ALTER TABLE dm ADD COLUMN IF NOT EXISTS ly_do       TEXT DEFAULT '';

CREATE TABLE dm_chitiet (
  id       VARCHAR(12) PRIMARY KEY,
  dm_id    VARCHAR(12) NOT NULL REFERENCES dm(id),
  vattu_id VARCHAR(12) NOT NULL REFERENCES vattu(id),
  so_luong NUMERIC(12,2) DEFAULT 1,
  don_gia  NUMERIC(14,2) DEFAULT 0,
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX idx_dm_ct ON dm_chitiet(dm_id);

-- ============ LỊCH SỬ GIÁ VẬT TƯ (W1b — port v3.6 `vattu_gia_lich_su`) ============
-- v3.6 dùng cột `ten` + `nguon`; bản v5 chốt theo schema thật: tra cứu theo vattu_id
-- (FK), `loai` whitelist 'nhap'|'dm' validate ở core (lib/core/kho.ts:ghiGiaLichSu),
-- giữ dấu vết phiếu qua phieu_id (eff W1a). gia NUMERIC(16,0): mốc giá làm tròn đồng.
CREATE TABLE IF NOT EXISTS vattu_gia_lich_su (
  id         BIGSERIAL PRIMARY KEY,
  vattu_id   TEXT NOT NULL REFERENCES vattu(id),
  gia        NUMERIC(16,0) NOT NULL,
  ncc        TEXT DEFAULT '',
  loai       TEXT DEFAULT 'nhap',
  phieu_id   TEXT DEFAULT '',
  ngay       TEXT NOT NULL,
  created_by TEXT DEFAULT '',
  deleted_at TEXT DEFAULT '',
  is_test    SMALLINT DEFAULT 0
);
-- Tra lịch sử theo vật tư mới nhất trước (ORDER ngay DESC, id DESC trong giaLichSuList)
CREATE INDEX IF NOT EXISTS idx_vgl_vattu_ngay ON vattu_gia_lich_su(vattu_id, ngay DESC);

-- ============ KHO HƯ HỎNG CÁCH LY + THANH LÝ (W1c — port v3.6 kho.js) ============
-- v3.6 tương ứng: vattu.ton_cu_hong (kho.js:377,444,506), sc_vattu.tt
-- (kho.js:285,309,383,448), phieu_nhap_thanhly → bảng v5 `thanh_ly` (theo chốt
-- plan W1c). KHÁC v3.6 (GHI CHÚ LỆCH — có chủ đích):
--  1) `nhap_xuat` KHÔNG thêm cột loai_nhap/loai_xuat: CHECK `loai` ('nhap'|'xuat')
--     là contract sẵn có (phieuList/worker-c) → tôn trọng, không mở rộng CHECK.
--     Nhánh hư hỏng phân biệt bằng MARKER `ly_do` = 'Thu hồi nội bộ' DO CORE ghi
--     buộc (lib/core/kho.ts: THU_HOI_MARKER) — mọi phiếu nhập cu_hong đi qua core
--     đều mang marker; autoXuatSC TRỪ các dòng marker này khỏi công thức đếm nhập
--     (v3.6 đếm cả cu_hong → trừ ton không nguồn thu → lỗi tiềm ẩn, v5 sửa).
--  2) `ton_cu_hong` là INTEGER (đếm linh kiện rời như coordinator chốt); core
--     CHẶN so_luong không nguyên ở mọi nhánh cu_hong (không để PG làm tròn thầm lặng).
--  3) `sc_vattu.tt` default 'can_mua' (khác v3.6 default ''); sc.ts W3 INSERT không
--     nêu tt → default áp. autoXuatSC đếm cầu = tt IN ('can_mua','da_mua').
--  4) `sc_vattu.loai_xu_ly` v5 CHƯA có (v3.6 có; v5 chỉ gắn loại xử lý ở sc_congviec,
--     giữa CV↔VT không có cột link) → thêm cột rỗng để W3 sc.ts đổ dữ liệu;
--     autoGenCuHong chấp nhận CẢ HAI spelling: 'thay_the' (v3.6) và 'thay_moi'
--     (enum sc_congviec v5) — thường hóa lower/trim khi so khớp.
ALTER TABLE vattu     ADD COLUMN IF NOT EXISTS ton_cu_hong INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sc_vattu  ADD COLUMN IF NOT EXISTS tt TEXT NOT NULL DEFAULT 'can_mua'
                       CHECK (tt IN ('can_mua','da_mua','da_xuat','da_huy'));
ALTER TABLE sc_vattu  ADD COLUMN IF NOT EXISTS loai_xu_ly TEXT NOT NULL DEFAULT '';

-- Bảng thanh lý / thu hồi VT cũ hỏng (v3.6 phieu_nhap_thanhly, id LN-000001).
-- so_luong NUMERIC(12,2) (LỆCH spec 'INTEGER': dòng thanh lý có thể sinh từ
-- xuatKho THƯỜNG với ly_do='Thanh lý' — số lít/dung dịch là NUMERIC; ép INTEGER
-- sẽ làm tròn thầm lặng mất dữ liệu). gia_thanh_ly NUMERIC(16,0) đồng bộ cột
-- `gia` của vattu_gia_lich_su (làm tròn đồng).
CREATE TABLE IF NOT EXISTS thanh_ly (
  id            VARCHAR(12) PRIMARY KEY,
  sc_id         VARCHAR(12) REFERENCES sc(id),
  vattu_id      VARCHAR(12) REFERENCES vattu(id),
  so_luong      NUMERIC(12,2) NOT NULL DEFAULT 0,
  gia_thanh_ly  NUMERIC(16,0) NOT NULL DEFAULT 0,
  ly_do         TEXT DEFAULT '',
  ngay          TEXT,
  is_test       SMALLINT DEFAULT 0,
  deleted_at    TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_thanh_ly_sc   ON thanh_ly(sc_id);
CREATE INDEX IF NOT EXISTS idx_thanh_ly_ngay ON thanh_ly(ngay);
-- Chống trùng phiếu thu hồi (sc_id + vattu) phục vụ EXISTS của autoGenCuHong:
CREATE INDEX IF NOT EXISTS ix_nhap_xuat_cuhong ON nhap_xuat(sc_id, vattu_id)
  WHERE loai = 'nhap' AND deleted_at = '' AND COALESCE(ly_do, '') = 'Thu hồi nội bộ';

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
