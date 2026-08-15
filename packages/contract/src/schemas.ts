/**
 * schemas.ts — Zod validation cho mọi RPC function args.
 * Ngày: 2026-08-14 | GĐ3: API layer
 *
 * Quy ước: mỗi schema tương ứng 1 RPC fn, validate `args` array.
 * Whitelist enum cho các trạng thái/state machine.
 */
import { z } from 'zod';

/* ─── Enums (whitelist — KHÔNG nhận chuỗi tự do) ─── */
export const TrangThaiSC = z.enum([
  'de_xuat', 'da_duyet', 'da_tong_duyet', 'dang_sua',
  'cho_nghiem', 'da_hoan', 'da_quyet', 'tu_choi',
]);
export const TrangThaiDeXuat = z.enum(['cho_duyet', 'da_duyet', 'tu_choi', 'da_chuyen_sc']);
export const TrangThaiDM = z.enum(['cho_duyet', 'da_duyet', 'tu_choi', 'da_nhap']);
export const TrangThaiPhieu = z.enum(['cho_duyet', 'da_duyet', 'tu_choi', 'da_nhap']);
export const LoaiXuLy = z.enum(['sua_chinh', 'thay_the', 'kiem_tra', 'bao_tri']);
export const MucUuTien = z.enum(['thap', 'binh_thuong', 'cao', 'khan_cap']);
export const TrangThaiCV = z.enum(['dang_thuc_hien', 'hoan_thanh']);
export const Role = z.enum(['admin', 'tho', 'khoa', 'ketoan', 'quanly', 'giamdoc', 'xuong']);
export const Feature = z.enum(['xem', 'tao', 'sua', 'duy', 'quyet', 'xuat', 'xoa', 'kehoach']);

/* ─── Common helpers ─── */
const idStr = z.string().min(1);
const optionalStr = z.string().optional();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải YYYY-MM-DD');
const positiveNum = z.number().positive();
const nonNegNum = z.number().nonnegative();

/* ═══════════════════════════════════════════════════
   SC — Phiếu sửa chữa
   ═══════════════════════════════════════════════════ */
export const scCreate = z.object({
  bks: z.string().min(1, 'Thiếu biển kiểm soát'),
  mo_ta: optionalStr,
  ngay_du_kien: dateStr.optional(),
  la_sua_ngoai: z.boolean().optional(),
  don_vi_ngoai: optionalStr,
  ghi_chu: optionalStr,
  congviec: z
    .array(
      z.object({
        ten: optionalStr,
        so_luong: z.number().optional(),
        don_gia: z.number().optional(),
        tho_id: optionalStr,
        loai_xu_ly: optionalStr,
      })
    )
    .optional(),
  vattu: z
    .array(
      z.object({
        name: optionalStr,
        so_luong: z.number().optional(),
        gd_dk: z.number().optional(),
      })
    )
    .optional(),
});

export const scList = z.object({
  trang_thai: TrangThaiSC.optional(),
  bks: optionalStr,
  thoi_gian_tu: dateStr.optional(),
  thoi_gian_den: dateStr.optional(),
});

export const scGet = idStr;

export const scApprove = undefined;

export const scTongDuyet = idStr;

export const scStart = idStr;

export const scSetDeadline = z.object({
  id: idStr,
  ngay_hen: dateStr,
});

export const scWorkItem = z.object({
  stt: z.number().int().positive(),
  nguyen_nhan: z.string().min(1),
  loai_xu_ly: LoaiXuLy,
  mo_ta: optionalStr,
});

export const scWorkSet = z.object({
  id: idStr,
  items: z.array(scWorkItem).min(1),
});

export const scWorkAdd = z.object({
  id: idStr,
  item: scWorkItem,
});

export const scWorkDel = z.object({
  id: idStr,
  itemId: z.number().int().nonnegative(),
});

export const scVtItem = z.object({
  ma_vt: z.string().min(1),
  so_luong: positiveNum,
  ghi_chu: optionalStr,
});

export const scVtAdd = z.object({
  id: idStr,
  item: scVtItem,
});

export const scVtUpd = z.object({
  id: idStr,
  itemId: z.number().int().nonnegative(),
  item: z.object({
    so_luong: positiveNum.optional(),
    ghi_chu: optionalStr,
  }),
});

export const scVtDel = z.object({
  id: idStr,
  itemId: z.number().int().nonnegative(),
});

export const scFinish = idStr;

export const scNghiem = undefined;

/* ═══════════════════════════════════════════════════
   KHO — Vật tư, tồn kho, đề nghị mua, nhập/xuất
   ═══════════════════════════════════════════════════ */
export const vatTuSave = z.object({
  id: z.number().int().optional(),
  name: z.string().min(1, 'Thiếu tên vật tư'),
  donvi: z.string().min(1, 'Thiếu đơn vị'),
  gia: nonNegNum,
  ton: nonNegNum,
  ton_min: nonNegNum.optional(),
  nhom: optionalStr,
  code: optionalStr,
  ghi_chu: optionalStr,
});

export const vatTuDel = z.number().int();

export const dmCreateItem = z.object({
  vattu_id: z.number().int().optional(),
  name: optionalStr,
  donvi: optionalStr,
  so_luong: positiveNum,
  dgia: nonNegNum.optional(),
  sc_id: optionalStr,
});

export const dmCreate = z.object({
  sc_id: optionalStr,
  ghi_chu: optionalStr,
  items: z.array(dmCreateItem).min(1),
});

// dmDecide là hàm đa tham số (id, action, lyDo) → bỏ schema (dispatcher gọi positional)
export const dmDecide = undefined;

export const phNhapItem = z.object({
  vattu_id: z.number().int().positive('Thiếu vật tư'),
  so_luong: positiveNum,
  dgia: nonNegNum,
  ten: optionalStr,
  donvi: optionalStr,
  sc_id: optionalStr,
  ref_baogia: optionalStr,
});

export const phNhapCreate = z.object({
  ghi_chu: optionalStr,
  ref_dm: optionalStr,
  loai_nhap: optionalStr,
  nha_cc: optionalStr,
  nguoi_giao: optionalStr,
  ncc_dia_chi: optionalStr,
  ncc_sdt: optionalStr,
  items: z.array(phNhapItem).min(1),
});

export const phXuatItem = z.object({
  vattu_id: z.number().int().positive('Thiếu vật tư'),
  so_luong: positiveNum,
});

export const phXuatCreate = z.object({
  ref_sc: optionalStr,
  ghi_chu: optionalStr,
  nguoi_nhan: optionalStr,
  loai_xuat: optionalStr,
  items: z.array(phXuatItem).min(1),
});

export const dateRange = z.object({
  tu: dateStr.optional(),
  den: dateStr.optional(),
});

/* ═══════════════════════════════════════════════════
   CHAT — Thread 1-1, tin nhắn, ảnh
   ═══════════════════════════════════════════════════ */
// Chat: mọi hàm đều đa tham số → gọi positional (không schema).
// Client truyền mảng: [peerId] | [threadId, limit?, offset?] | [threadId, noi_dung] | [threadId, b64] | [msgId].
export const chatThreadOpen = undefined;
export const chatMessages = undefined;
export const chatSend = undefined;
export const chatSendImg = undefined;
export const chatMarkRead = undefined;
export const chatDeleteMsg = undefined;

/* ═══════════════════════════════════════════════════
   DE XUAT — Đề xuất sửa chữa (thay thế TK)
   ═══════════════════════════════════════════════════ */
export const deXuatCreate = z.object({
  bks: z.string().min(1, 'Thiếu biển số'),
  mo_ta: z.string().min(1, 'Thiếu mô tả'),
  dau_hieu: z.array(z.string()).optional(),
  muc_uu_tien: z.enum(['Khan_cap', 'Xu_ly_som', 'Binh_thuong']).optional(),
});

export const deXuatList = z.object({
  trang_thai: TrangThaiDeXuat.optional(),
  bks: optionalStr,
});

export const deXuatGet = idStr;

// deXuatApprove là hàm đa tham số (id, action, lyDo) → bỏ schema (positional)
export const deXuatApprove = undefined;

export const deXuatToSC = idStr;

/* ═══════════════════════════════════════════════════
   XUONG — Dashboard xưởng
   ═══════════════════════════════════════════════════ */
// xuongDashboard, dashboardAll — không args

/* ═══════════════════════════════════════════════════
   ASSET — Tài sản, khấu hao, quyết toán
   ═══════════════════════════════════════════════════ */
export const quyetToan = z.object({
  id: optionalStr,
  ghi_chu: optionalStr,
});

export const lichSuaList = z.object({ bks: optionalStr });

export const assetXe = idStr;

/* ═══════════════════════════════════════════════════
   BAO GIA — Báo giá NCC
   ═══════════════════════════════════════════════════ */
export const baoGiaItem = z.object({
  ten: z.string().min(1),
  so_luong: nonNegNum,
  dgia: nonNegNum,
  donvi: optionalStr,
  vattu_id: z.union([z.number(), z.string()]).optional(),
  ghi_chu: optionalStr,
});

export const baoGiaCreate = z.object({
  ncc_ten: z.string().min(1),
  ngay: dateStr.optional(),
  dm_id: idStr.optional(),
  sc_id: idStr.optional(),
  loai_chung_tu: z.enum(['bao_gia', 'hoa_don', 'khac']).optional(),
  ncc_dia_chi: optionalStr,
  ncc_sdt: optionalStr,
  ref_phieu_nhap: idStr.optional(),
  items: z.array(baoGiaItem).optional(),
});

export const baoGiaGet = idStr;

export const baoGiaDel = idStr;

/* ═══════════════════════════════════════════════════
   NHAN KY — Chữ ký 8 vị trí
   ═══════════════════════════════════════════════════ */
// NhanKy: hàm đa tham số (phieuLoai, phieuId[, patches]) → gọi positional, không schema.
// Client truyền: nhanKyList(['sc', scId]); nhanKySet(['sc', scId, [{vi_tri, nguoi_ky, chu_ky_data}]]).
export const nhanKySet = undefined;
export const nhanKyList = undefined;

/* ═══════════════════════════════════════════════════
   AUTH — Đăng nhập, đổi mật khẩu
   ═══════════════════════════════════════════════════ */
export const changePassword = z.object({
  oldPw: z.string().min(1),
  newPw: z.string().min(6, 'Mật khẩu mới tối thiểu 6 ký tự'),
});

/* ═══════════════════════════════════════════════════
   PERM — Phân quyền
   ═══════════════════════════════════════════════════ */
export const permChange = z.object({
  role: Role,
  module: z.string().min(1),
  feature: Feature,
  on: z.boolean(),
});

export const permSave = z.object({
  changes: z.array(permChange).min(1),
});

export const thresholdsSet = z.object({
  duyet_sc_nguong: nonNegNum.optional(),
  duyet_mua_nguong: nonNegNum.optional(),
});

/* ═══════════════════════════════════════════════════
   ADMIN — Quản lý user
   ═══════════════════════════════════════════════════ */
export const userAdd = z.object({
  name: z.string().min(1),
  role: Role,
  phone: optionalStr,
  phong_ban: optionalStr,
  password: z.string().min(6),
});

export const userSetPassword = z.object({
  userId: idStr,
  password: z.string().min(6),
});

export const userSetActive = z.object({
  userId: idStr,
  active: z.boolean(),
});

/* ═══════════════════════════════════════════════════
   PREVIEW — Xem thử vai trò
   ═══════════════════════════════════════════════════ */
export const previewStart = z.object({ role: Role });

/* ═══════════════════════════════════════════════════
   SCORING — Điểm A-E
   ═══════════════════════════════════════════════════ */
// scoring fns không có input args từ RPC

/* ═══════════════════════════════════════════════════
   REPORT — Báo cáo (via /export/*, không RPC)
   ═══════════════════════════════════════════════════ */
// reports are stream endpoints, not RPC

/* ═══════════════════════════════════════════════════
   SCHEMA MAP — fn → ZodSchema (dùng trong RPC dispatcher)
   ═══════════════════════════════════════════════════ */
export const RPC_SCHEMAS: Record<string, z.ZodTypeAny> = {
  // SC
  scCreate, scList, scGet, scTongDuyet, scStart, scSetDeadline,
  scWorkSet, scWorkAdd, scWorkDel, scVtAdd, scVtUpd, scVtDel, scFinish,
  // Kho
  vatTuSave, vatTuDel, dmCreate, phNhapCreate, phXuatCreate,
  // DeXuat
  deXuatCreate, deXuatList, deXuatGet, deXuatToSC,
  // Asset
  quyetToan, lichSuaList, assetXe,
  // BaoGia
  baoGiaCreate, baoGiaGet, baoGiaDel,
  // Auth
  changePassword,
  // Perm
  permSave, thresholdsSet,
  // Admin
  userAdd, userSetPassword, userSetActive,
  // Preview
  previewStart,
};
