-- ===================== KẾ TOÁN (GĐ1) — DDL =====================
-- Sổ cái kép + hệ thống tài khoản + khóa kỳ + cài đặt + lot + công nợ + VAT.
-- Chạy idempotent (IF NOT EXISTS) cho cả migration live và test fixture.
-- Tiền dùng NUMERIC(14,2) (bảng cũ giữ REAL để tương thích ngược).
--
-- Port NGUYÊN văn bản từ draft v4 `packages/db/src/accounting.sql`
-- (branch draft/gd4-gd5-v4). NGOẠI LỆ v5 (schema gốc khác — xóa 2 ALTER
-- trỏ tới bảng CHỈ tồn tại ở v4, không ảnh hưởng module kế toán):
--   1) `ALTER TABLE khach_hang ... la_ncc`   — v5 không có bảng khach_hang
--      (đối tượng NCC quản qua xuatXu/cong_no.doi_tac kiểu chuỗi).
--   2) `ALTER TABLE phieu_sua ... hinh_anh`  — v5 đổi SC thành bảng `sc`
--      (cột ảnh annex thuộc epic riêng, không phải schema kế toán).
-- LƯU Ý WIRING: db/migrate.ts (v5 hiện tại) mới chỉ chạy schema.sql —
-- file này phải được worker khác thêm vào pipeline migrate/Onpremise-init.

CREATE TABLE IF NOT EXISTS tai_khoan (
  id VARCHAR(12) PRIMARY KEY,
  tenant_id TEXT DEFAULT 'c1',
  ma_so VARCHAR(16) NOT NULL,
  ten TEXT NOT NULL,
  loai TEXT NOT NULL CHECK (loai IN ('tai_san','no_phai_tra','von_chu_so_huu','doanh_thu','chi_phi')),
  cap INTEGER DEFAULT 1,
  deleted_at TEXT DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_taikhoan_ms ON tai_khoan(tenant_id, ma_so) WHERE deleted_at='';

CREATE TABLE IF NOT EXISTS chung_tu (
  id VARCHAR(12) PRIMARY KEY,
  tenant_id TEXT DEFAULT 'c1',
  so_ct TEXT NOT NULL,
  ngay TEXT NOT NULL,
  loai_ct TEXT NOT NULL,
  nguoi TEXT DEFAULT '',
  ref_type TEXT DEFAULT '',
  ref_id TEXT DEFAULT '',
  note TEXT DEFAULT '',
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_chungtu_ngay ON chung_tu(tenant_id, ngay);
CREATE INDEX IF NOT EXISTS idx_chungtu_ref ON chung_tu(tenant_id, ref_type, ref_id) WHERE ref_type<>'';

CREATE TABLE IF NOT EXISTS ledger (
  id VARCHAR(12) PRIMARY KEY,
  tenant_id TEXT DEFAULT 'c1',
  ct_id VARCHAR(12) REFERENCES chung_tu(id),
  ngay TEXT NOT NULL,
  tai_khoan VARCHAR(16) NOT NULL,
  du_no NUMERIC(14,2) DEFAULT 0,
  du_co NUMERIC(14,2) DEFAULT 0,
  ref_type TEXT DEFAULT '',
  ref_id TEXT DEFAULT '',
  deleted_at TEXT DEFAULT '',
  CONSTRAINT chk_ledger_side CHECK ((du_no>0 AND du_co=0) OR (du_co>0 AND du_no=0))
);
CREATE INDEX IF NOT EXISTS idx_ledger_ct ON ledger(ct_id);
CREATE INDEX IF NOT EXISTS idx_ledger_tk ON ledger(tenant_id, tai_khoan);
CREATE INDEX IF NOT EXISTS idx_ledger_ngay ON ledger(tenant_id, ngay);

CREATE TABLE IF NOT EXISTS ky_ke_toan (
  id VARCHAR(12) PRIMARY KEY,
  tenant_id TEXT DEFAULT 'c1',
  ten_ky TEXT NOT NULL,
  tu_ngay TEXT NOT NULL,
  den_ngay TEXT NOT NULL,
  da_dong BOOLEAN DEFAULT FALSE,
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_ky_den ON ky_ke_toan(tenant_id, den_ngay);

CREATE TABLE IF NOT EXISTS ke_toan_setting (
  id VARCHAR(12) PRIMARY KEY,
  tenant_id TEXT DEFAULT 'c1',
  key TEXT NOT NULL,
  value TEXT DEFAULT '',
  deleted_at TEXT DEFAULT '',
  CONSTRAINT uq_ketoan_setting UNIQUE (tenant_id, key)
);

CREATE TABLE IF NOT EXISTS ton_lot (
  id VARCHAR(12) PRIMARY KEY,
  tenant_id TEXT DEFAULT 'c1',
  vattu_id VARCHAR(12) NOT NULL,
  phieu_nhap_id VARCHAR(12) DEFAULT '',
  so_luong NUMERIC(14,3) DEFAULT 0,
  gia NUMERIC(14,2) DEFAULT 0,
  con_lai NUMERIC(14,3) DEFAULT 0,
  ngay TEXT DEFAULT '',
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_tonlot_vt ON ton_lot(tenant_id, vattu_id) WHERE deleted_at='';

CREATE TABLE IF NOT EXISTS cong_no (
  id VARCHAR(12) PRIMARY KEY,
  tenant_id TEXT DEFAULT 'c1',
  loai TEXT NOT NULL CHECK (loai IN ('phai_thu','phai_tra')),
  doi_tac TEXT DEFAULT '',
  ky_hieu TEXT DEFAULT '',
  ref_type TEXT DEFAULT '',
  ref_id TEXT DEFAULT '',
  ngay TEXT DEFAULT '',
  han_tt TEXT DEFAULT '',
  so_tien NUMERIC(14,2) DEFAULT 0,
  da_tt NUMERIC(14,2) DEFAULT 0,
  con_no NUMERIC(14,2) DEFAULT 0,
  da_dong BOOLEAN DEFAULT FALSE,
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_congno_loai ON cong_no(tenant_id, loai) WHERE deleted_at='';

CREATE TABLE IF NOT EXISTS vat_invoice (
  id VARCHAR(12) PRIMARY KEY,
  tenant_id TEXT DEFAULT 'c1',
  ncc TEXT DEFAULT '',
  so_hd TEXT DEFAULT '',
  ngay TEXT DEFAULT '',
  tien_hang NUMERIC(14,2) DEFAULT 0,
  tien_thue NUMERIC(14,2) DEFAULT 0,
  ty_le NUMERIC(5,2) DEFAULT 0,
  da_khai_thue BOOLEAN DEFAULT FALSE,
  ref_id TEXT DEFAULT '',
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_vat_sohd ON vat_invoice(tenant_id, ncc, so_hd) WHERE deleted_at='';

-- GĐ3: bảng phiếu chi (thanh toán NCC / trả lương)
CREATE TABLE IF NOT EXISTS phieu_chi (
  id VARCHAR(12) PRIMARY KEY,
  tenant_id TEXT DEFAULT 'c1',
  ngay TEXT NOT NULL,
  nguoi TEXT DEFAULT '',
  cong_no_id TEXT DEFAULT '',
  so_tien NUMERIC(14,2) DEFAULT 0,
  hinh_thuc TEXT DEFAULT 'ck',
  nguoi_nhan TEXT DEFAULT '',
  note TEXT DEFAULT '',
  cp_ve_phuphi NUMERIC(14,2) DEFAULT 0,
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_phieuchi_cn ON phieu_chi(tenant_id, cong_no_id) WHERE cong_no_id<>'';

-- GĐ3 (draft): ALTER khach_hang la_ncc — KHÔNG ÁP DỤNG ở v5 (xem header).

-- GĐ3: bổ sung tài khoản 133 (VAT đầu vào được khấu trừ) — idempotent
INSERT INTO tai_khoan(id, tenant_id, ma_so, ten, loai, cap)
VALUES('TK-000021','c1','133','Thuế GTGT được khấu trừ (VAT đầu vào)','tai_san',1)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- v4.3 WORKSPACE — BACKEND GAP (chỉ ADD bảng mới, GIỮ NGUYÊN schema cũ)
-- ============================================================================

-- Sổ quỹ nội bộ (111 tiền mặt / 112 TGNH) — thu nội bộ, KHÔNG doanh thu/AR
CREATE TABLE IF NOT EXISTS so_quy (
  id VARCHAR(12) PRIMARY KEY,
  tenant_id TEXT DEFAULT 'c1',
  ngay TEXT NOT NULL,
  loai_quy TEXT NOT NULL CHECK (loai_quy IN ('tm','tg')),
  doi_tac TEXT DEFAULT '',
  so_tien NUMERIC(14,2) DEFAULT 0,
  loai_ps TEXT NOT NULL CHECK (loai_ps IN ('thu','chi')),
  ly_do TEXT DEFAULT '',
  ref_id TEXT DEFAULT '',
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_soquy_ngay ON so_quy(tenant_id, ngay) WHERE deleted_at='';

-- Phương án sửa chữa (proposal A/B/C gắn SC)
CREATE TABLE IF NOT EXISTS sc_phuong_an (
  id VARCHAR(12) PRIMARY KEY,
  tenant_id TEXT DEFAULT 'c1',
  sc_id TEXT NOT NULL,
  ten TEXT NOT NULL,
  mo_ta TEXT DEFAULT '',
  chi_phi_uoc_tinh NUMERIC(14,2) DEFAULT 0,
  nguoi_tao TEXT DEFAULT '',
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_pa_sc ON sc_phuong_an(tenant_id, sc_id) WHERE deleted_at='';

-- Đánh giá xe (gắn engine scoring A–E)
CREATE TABLE IF NOT EXISTS xe_danh_gia (
  id VARCHAR(12) PRIMARY KEY,
  tenant_id TEXT DEFAULT 'c1',
  xe_id TEXT NOT NULL,
  diem NUMERIC(5,2) DEFAULT 0,
  xep_loai TEXT NOT NULL CHECK (xep_loai IN ('A','B','C','D','E')),
  ghi_chu TEXT DEFAULT '',
  nguoi_danh_gia TEXT DEFAULT '',
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_xe_dg ON xe_danh_gia(tenant_id, xe_id) WHERE deleted_at='';

-- Lịch bảo dưỡng định kỳ
CREATE TABLE IF NOT EXISTS bao_duong_lich (
  id VARCHAR(12) PRIMARY KEY,
  tenant_id TEXT DEFAULT 'c1',
  xe_id TEXT NOT NULL,
  hang_muc TEXT NOT NULL,
  ngay_du_kien TEXT DEFAULT '',
  ngay_thuc_hien TEXT DEFAULT '',
  trang_thai TEXT NOT NULL CHECK (trang_thai IN ('cho','xong','bo')) DEFAULT 'cho',
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_bd_xe ON bao_duong_lich(tenant_id, xe_id) WHERE deleted_at='';

-- (draft): ALTER phieu_sua hinh_anh TEXT[] — KHÔNG ÁP DỤNG ở v5 (xem header).
