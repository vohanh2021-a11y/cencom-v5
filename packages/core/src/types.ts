/**
 * types.ts — Các kiểu dữ liệu domain dùng chung cho packages/core.
 * Map 1-1 với schema.sql (bảng PG). Không ép buộc — dùng để type-check
 * các hàm port từ v3.6 (server/*.js).
 */

export interface UserRow {
  id: string;
  name: string;
  role: string;
  phone: string;
  pass_hash: string;
  active: number;
  must_change: number;
  phong_ban: string;
  deleted_at: string;
}

export interface XeRow {
  id: string;
  bks: string;
  bien_so_cu: string;
  hang: string;
  dong: string;
  nam_sx: number;
  lai_xe: string;
  danh_gia_pct: number;
  phong_ban: string;
  trang_thai: string;
  loai_pt: string;
  ghi_chu: string;
  nguyen_gia: number;
  lai_xe_id: string;
  deleted_at: string;
}

export interface PhieuRow {
  id: string;
  bks: string;
  mode: string;
  ngay: string;
  nguoi: string;
  trang_thai: string;
  ghi_chu: string;
  assignee: string;
  deadline: string;
  done_at: string;
  deleted_at: string;
}

export interface KetQuaRow {
  id: string;
  phieu_id: string;
  bks: string;
  item_id: number;
  group_id: number;
  value: string;
  ghi_chu: string;
  deleted_at: string;
}

export interface KetQuaJoinedRow extends KetQuaRow {
  ngay: string;
  p_mode: string;
}

export interface BieuMaRow {
  item_id: number;
  group_id: number;
  group_name: string;
  group_short: string;
  item_name: string;
  priority: string;
  deleted_at: string;
}

export interface BieuMaGroup {
  group_id: number;
  name: string;
  short: string;
  items: Array<{ item_id: number; name: string; priority: string }>;
}

export interface AuditRow {
  id: number;
  thoi_gian: string;
  nguoi: string;
  bang: string;
  id_dong: string;
  hanh_vi: string;
  noi_dung: string;
}

export interface PhieuSuaRow {
  id: string;
  bks: string;
  phieu_kt: string;
  nguoi_lap: string;
  ngay: string;
  mo_ta: string;
  trang_thai: string;
  nguoi_duyet: string;
  ngay_duyet: string;
  ly_do_tu_choi: string;
  nguoi_nghiem: string;
  ngay_nghiem: string;
  tong_cong: number;
  tong_vt: number;
  tong: number;
  ghi_chu: string;
  deleted_at: string;
  tk_id: string;
  ngay_du_kien: string;
  ngay_bat_dau: string;
  tinh_trang_pt: string;
  la_sua_ngoai: number;
  don_vi_ngoai: string;
}

export interface ScCongViecRow {
  id: number;
  sc_id: string;
  congviec_id: number;
  ten: string;
  donvi: string;
  so_luong: number;
  don_gia: number;
  thanh: number;
  ghi_chu: string;
  tho_id: string;
  tt: string;
  gio_cong: number;
  stt: number;
  nguyen_nhan: string;
  loai_xu_ly: string;
  deleted_at: string;
}

export interface ScVattuRow {
  id: number;
  sc_id: string;
  vattu_id: number;
  ten: string;
  donvi: string;
  so_luong: number;
  gd_dk: number;
  gd_tt: number;
  thanh: number;
  tt: string;
  stt: number;
  nguyen_nhan: string;
  loai_xu_ly: string;
  bao_gia_id: string;
  ncc: string;
  gia_ngay: string;
  deleted_at: string;
}

export interface CongViecRow {
  id: number;
  code: string;
  name: string;
  nhom: string;
  donvi: string;
  don_gia: number;
  mo_ta: string;
  active: number;
  deleted_at: string;
  gio_cong: number;
}

export interface VattuRow {
  id: number;
  code: string;
  name: string;
  nhom: string;
  donvi: string;
  gia: number;
  ton: number;
  ton_min: number;
  active: number;
  deleted_at: string;
  ton_cu_hong: number;
}

export interface DeNghiMuaRow {
  id: string;
  nguoi_lap: string;
  ngay: string;
  trang_thai: string;
  nguoi_duyet: string;
  ngay_duyet: string;
  ly_do_tu_choi: string;
  tong: number;
  ghi_chu: string;
  deleted_at: string;
}

export interface DmMuaCtRow {
  id: number;
  dm_id: string;
  vattu_id: number;
  ten: string;
  donvi: string;
  so_luong: number;
  dg_dk: number;
  dg_tt: number;
  tt: string;
  sc_id: string;
  deleted_at: string;
}

export interface PhieuNhapRow {
  id: string;
  ngay: string;
  nguoi_lap: string;
  nha_cc: string;
  nguoi_duyet: string;
  ref_dm: string;
  tong: number;
  ghi_chu: string;
  deleted_at: string;
  loai_nhap: string;
  nguoi_giao: string;
  ncc_dia_chi: string;
  ncc_sdt: string;
}

export interface PhieuNhapCtRow {
  id: number;
  ph_id: string;
  vattu_id: number;
  ten: string;
  donvi: string;
  so_luong: number;
  dgia: number;
  thanh: number;
  ref_dm: string;
  ref_baogia: string;
  ref_sc: string;
  ncc: string;
  gia_ngay: string;
  deleted_at: string;
}

export interface PhieuXuatRow {
  id: string;
  ngay: string;
  nguoi_lap: string;
  ref_sc: string;
  ghi_chu: string;
  deleted_at: string;
  nguoi_nhan: string;
  loai_xuat: string;
}

export interface PhieuXuatCtRow {
  id: number;
  ph_id: string;
  vattu_id: number;
  ten: string;
  donvi: string;
  so_luong: number;
  dgia: number;
  thanh: number;
  ref_sc: string;
  ncc: string;
  gia_ngay: string;
  deleted_at: string;
}

export interface BaoGiaNccRow {
  id: number;
  dm_id: string;
  sc_id: string;
  ncc_ten: string;
  ncc_dia_chi: string;
  ncc_sdt: string;
  ngay: string;
  loai_chung_tu: string;
  ref_phieu_nhap: string;
  nguoi_lap: string;
  deleted_at: string;
}

export interface YeuCauThamKhamRow {
  id: string;
  bks: string;
  lai_xe: string;
  ngay: string;
  mo_ta: string;
  dau_hieu: string;
  muc_uu_tien: string;
  trang_thai: string;
  nguoi_duyet: string;
  ngay_duyet: string;
  ly_do_tu_choi: string;
  nguoi_xuong: string;
  ngay_xuong: string;
  ly_do_xuong: string;
  tho_id: string;
  ngay_giao_tho: string;
  sc_id: string;
  img_paths: string;
  deleted_at: string;
}

export interface VattuGiaLichSuRow {
  id: number;
  vattu_id: number;
  ten: string;
  ngay: string;
  gia: number;
  phieu_id: string;
  nguon: string;
  ncc: string;
  deleted_at: string;
}

export interface PhieuNhapThanhlyRow {
  id: number;
  ph_id: string;
  vattu_id: number;
  ten: string;
  donvi: string;
  so_luong: number;
  ly_do: string;
  gia_thanh_ly: number;
  ngay_thanh_ly: string;
  deleted_at: string;
}