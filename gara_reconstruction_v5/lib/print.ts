/**
 * lib/print.ts — W4.3: helpers IN HTML A4 (8 mẫu) + CSV-safe export.
 *
 * PORT NGUYÊN helpers hiển thị từ v3.6 `server/in.js` (dòng 31–77):
 *   vnd / sotienChu / formatNgay / todayVN / bảng nhãn chữ ký (nhanKy.VI_TRI_LABEL).
 * Dữ liệu load TRỰC TIẾP qua core v5 (scGet, xeGet, phieuGet, baogiaGet, checkHoSo)
 * — KHÔNG tự chế SQL trùng contract RPC. Chỉ có 2 nhóm SELECT hiển-thị bổ sung
 * (core chưa có getter công khai, không phải logic nghiệp vụ):
 *   1. dòng cv+vt của SC (join nhãn vattu) — phục vụ mẫu kiểm tu / bảng kê / kế hoạch;
 *   2. phiếu bước mới nhất theo SC: ke_hoach_sc / phieu_kiem_tu / bien_ban_nghiem
 *      (v3.6 in.js p1/p2/p7 đọc trực tiếp bảng này khi in).
 * Quyền: kiểm tra ngay trong loader (sc.xem do core scGet check; riêng phieuGet
 * KHÔNG tự check → gate ['kho','xem'] tại đây; baogia/hoso do core check).
 */
import type { Api } from './types';
import { row } from './db';
import { scGet } from './core/sc';
import { xeGet } from './core/xe';
import { phieuGet, THU_HOI_MARKER } from './core/kho';
import { baogiaGet } from './core/baogia';
import { checkHoSo } from './core/ho_so';

/* ────────────────────────── helpers số / ngày (v3.6 in.js:31-66) ────────────────────────── */

/** Định dạng tiền VNĐ kiểu Việt (1.234.567) — port v3.6 in.js vnd(). */
export function vnd(n: unknown): string {
  return Number(n || 0).toLocaleString('vi-VN').replace(/,/g, '.');
}

/** Số tiền bằng chữ tiếng Việt — port v3.6 in.js sotienChu() nguyên văn. */
export function sotienChu(n: unknown): string {
  const num0 = Number(n || 0);
  if (!num0 || num0 <= 0) return 'Không đồng';
  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
  const ones = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const text: string[] = [];
  let num = Math.floor(Math.abs(num0));
  let i = 0;
  function read3(x: number): string {
    const h = Math.floor(x / 100), t = Math.floor((x % 100) / 10), o = x % 10;
    let s = '';
    if (h) s += ones[h] + ' trăm' + (t || o ? ' ' : '');
    if (t === 1) s += 'mười ' + (o ? ones[o] : '');
    else if (t > 1) s += ones[t] + ' mươi' + (o ? ' ' + (o === 5 ? 'lăm' : ones[o]) : '');
    else if (o) s += (h ? 'lẻ ' : '') + ones[o];
    return s.trim();
  }
  while (num > 0) {
    const part = num % 1000;
    if (part) text.unshift(read3(part) + (units[i] ? ' ' + units[i] : ''));
    num = Math.floor(num / 1000);
    i++;
  }
  const out = text.join(' ').replace(/\s+/g, ' ').trim() + ' đồng';
  // LỆCH v3.6 CÓ CHỦ ĐÍCH: in hoa chữ cái đầu cho đầu mục 'Tổng số tiền (bằng chữ):' —
  // nội dung/thuật ngữ dưới đây giữ nguyên algorithm của in.js.
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** 'YYYY-MM-DD' → 'D tháng M năm YYYY' — port v3.6 formatNgay(). */
export function formatNgayVN(ngay: unknown): string {
  if (!ngay) return '................';
  const m = String(ngay).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? Number(m[3]) + ' tháng ' + Number(m[2]) + ' năm ' + m[1] : String(ngay);
}

/** Ngày hôm nay dạng VN — port v3.6 todayVN(). */
export function todayVN(): string {
  const d = new Date();
  return d.getDate() + ' tháng ' + (d.getMonth() + 1) + ' năm ' + d.getFullYear();
}

/** Nhãn vị trí ký — port nhanKy.VI_TRI_LABEL (v3.6); v5 không có ảnh chữ ký nên in khung ký tay. */
export const VI_TRI_LABEL: Record<string, string> = {
  nguoi_lap: 'Người lập',
  thu_kho: 'Thủ kho',
  lai_xe: 'Lái xe',
  kt_truong: 'Kế toán trưởng',
  xuong: 'Quản lý xưởng',
  ben_giao: 'Bên giao',
  ben_nhan: 'Bên nhận',
  giam_doc: 'Giám đốc',
};

/** Loại xử lý → nhãn in (v5 enum + tương thích spelling v3.6 'thay_the'/'khac_phuc'). */
const XU_LY_LABEL: Record<string, string> = {
  thay_moi: 'Thay mới',
  thay_the: 'Thay thế',
  sua_chua: 'Sửa chữa',
  khac_phuc: 'Khắc phục',
  bao_duong: 'Bảo dưỡng',
  khac: 'Khác',
};

/* ────────────────────────── cấu trúc mẫu in ────────────────────────── */

export const IN_TYPES = [
  'kehoach', 'kiemtu', 'baogia', 'nhapkho', 'xuatkho', 'nghiemthu', 'bangke', 'hoso',
] as const;
export type InType = (typeof IN_TYPES)[number];

export function isCppType(v: string): v is InType {
  return (IN_TYPES as readonly string[]).includes(v);
}

/** id chứng từ in được chấp nhận: PREFIX-000001 (SC/KH/KT/BG/NN/NX/DM/XE…). */
const ID_RE = /^[A-Z]{2}-\d{6}$/;
export function isPrintId(v: string): boolean {
  return ID_RE.test(v.toUpperCase());
}

export interface PrintField {
  label: string;
  value: string;
}

export interface PrintLine {
  stt: number;
  loai: string;
  ten: string;
  donvi: string;
  sl: number;
  gia: number;
  thanh: number;
  nguyen_nhan: string;
  xu_ly: string;
}

/**
 * Một mẫu in đã "flatten" cho renderer A4 (server component chỉ việc map JSX,
 * mọi chuỗi qua JSX → React tự escape XSS; KHÔNG có dangerouslySetInnerHTML).
 */
export interface PrintDoc {
  type: InType;
  title: string;
  docNumber: string; // 'Số: SC-000012'
  meta: PrintField[];
  /** 'simple' = 6 cột (STT/Tên/ĐVT/SL/Đơn giá/Thành tiền); 'full' = 9 cột kiểm tu/bảng kê */
  lineStyle: 'simple' | 'full';
  lines: PrintLine[];
  totals: PrintField[];
  tong: number;
  tongChu: string;
  /** bộ vị trí ký theo v3.6 kyTu(...) từng mẫu */
  sigs: string[];
  note: string;
  /** phiếu chưa tồn tại (bộ hồ sơ in continued placeholder như v3.6 hoSo) */
  missing?: boolean;
  missingNote?: string;
  /** riêng mẫu hoso: bảng 8 bước từ checkHoSo */
  steps?: { step: number; label: string; ok: boolean; note: string }[];
}

/* ────────────────────────── queries hiển-thị bổ sung (không trùng contract) ────────────────────────── */

/** Dòng cv + vt của SC kèm nhãn vật tư — thứ tự: công việc (stt,id) rồi vật tư (id).
 *  LỆCH v3.6 CÓ CHỦ ĐÍCH: sc_vattu v5 không có cột stt/nguyen_nhan → đánh STT nối tiếp,
 *  nguyên nhân để trống (ghi chú trong doc-port). */
async function fetchScLines(api: Api, scId: string): Promise<PrintLine[]> {
  const cv = await api.db.query(
    "SELECT stt, mo_ta, nguyen_nhan, loai_xu_ly, so_luong, don_gia FROM sc_congviec WHERE sc_id=$1 AND deleted_at='' ORDER BY stt, id",
    [scId]
  );
  const vt = await api.db.query(
    "SELECT v.so_luong, CASE WHEN v.gd_tt > 0 THEN v.gd_tt ELSE v.gd_dk END AS gia, v.loai_xu_ly, t.ten, t.don_vi " +
      "FROM sc_vattu v JOIN vattu t ON t.id = v.vattu_id WHERE v.sc_id=$1 AND v.deleted_at='' ORDER BY v.id",
    [scId]
  );
  const out: PrintLine[] = [];
  for (const c of cv.rows) {
    const sl = Number(c.so_luong ?? 0);
    const gia = Number(c.don_gia ?? 0);
    out.push({
      stt: out.length + 1,
      loai: 'Công việc',
      ten: String(c.mo_ta ?? ''),
      donvi: '',
      sl,
      gia,
      thanh: sl * gia,
      nguyen_nhan: String(c.nguyen_nhan ?? ''),
      xu_ly: XU_LY_LABEL[String(c.loai_xu_ly ?? '')] ?? '',
    });
  }
  for (const v of vt.rows) {
    const sl = Number(v.so_luong ?? 0);
    const gia = Number(v.gia ?? 0);
    out.push({
      stt: out.length + 1,
      loai: 'Vật tư',
      ten: String(v.ten ?? ''),
      donvi: String(v.don_vi ?? ''),
      sl,
      gia,
      thanh: sl * gia,
      nguyen_nhan: '',
      xu_ly: XU_LY_LABEL[String(v.loai_xu_ly ?? '')] ?? '',
    });
  }
  return out;
}

/** Phiếu bước mới nhất theo SC (ke_hoach_sc / phieu_kiem_tu / bien_ban_nghiem). */
async function latestStepDoc(
  api: Api,
  table: 'ke_hoach_sc' | 'phieu_kiem_tu',
  scId: string
): Promise<{ id: string; mo_ta: string; ngay: string } | null> {
  const r = await row<{ id: string; mo_ta: string; ngay: string }>(
    `SELECT id, mo_ta, ngay FROM ${table} WHERE sc_id=$1 AND deleted_at='' ORDER BY ngay DESC, id DESC LIMIT 1`,
    [scId]
  );
  return r ? { id: r.id, mo_ta: String(r.mo_ta ?? ''), ngay: String(r.ngay ?? '') } : null;
}

async function latestNghiemThu(
  api: Api,
  scId: string
): Promise<{ id: string; ngay_nghiem: string; tong_vat_tu: number; tong_nhan_cong: number } | null> {
  // v3.6 in.js p7: bien_ban_nghiem ORDER BY id DESC LIMIT 1 theo sc_id
  const r = await row<{ id: string; ngay_nghiem: string; tong_vat_tu: unknown; tong_nhan_cong: unknown }>(
    "SELECT id, ngay_nghiem, tong_vat_tu, tong_nhan_cong FROM bien_ban_nghiem WHERE sc_id=$1 AND deleted_at='' ORDER BY id DESC LIMIT 1",
    [scId]
  );
  if (!r) return null;
  return {
    id: r.id,
    ngay_nghiem: String(r.ngay_nghiem ?? ''),
    tong_vat_tu: Number(r.tong_vat_tu ?? 0),
    tong_nhan_cong: Number(r.tong_nhan_cong ?? 0),
  };
}

/** Danh sách id phiếu nhập/xuất của SC (effective-group, W1a) — để in cả bộ trong hồ sơ. */
async function phieuIdsBySc(api: Api, scId: string, loai: 'nhap' | 'xuat'): Promise<string[]> {
  const r = await api.db.query(
    'SELECT COALESCE(NULLIF(phieu_id, $3), id) AS gid, MIN(COALESCE(ngay, $3)) AS ngay ' +
      'FROM nhap_xuat WHERE sc_id=$1 AND loai=$2 AND deleted_at=$3 ' +
      'GROUP BY COALESCE(NULLIF(phieu_id, $3), id) ORDER BY MIN(COALESCE(ngay, $3)) NULLS LAST, gid',
    [scId, loai, '']
  );
  return r.rows.map((x: { gid: string }) => String(x.gid));
}

/** Báo giá BG gần nhất theo SC (p3 v3.6 in theo scId; v5 baogiaGet cần BG id). */
async function baogiaIdBySc(api: Api, scId: string): Promise<string | null> {
  const r = await row<{ id: string }>(
    "SELECT id FROM baogia WHERE sc_id=$1 AND deleted_at='' ORDER BY ngay DESC, id DESC LIMIT 1",
    [scId]
  );
  return r ? r.id : null;
}

/* ────────────────────────── builder từng mẫu (port p1..p8 + hoSo) ────────────────────────── */

async function scInfo(api: Api, scId: string): Promise<{ sc: any; bienSo: string; chuXe: string; hang: string }> {
  const sc = await scGet(api, scId); // core check sc.xem + 404 'Không tìm thấy phiếu sửa chữa'
  const xe = await xeGet(api, sc.xe_id);
  return {
    sc,
    bienSo: String(xe?.bien_so ?? ''),
    chuXe: String(xe?.chu_xe ?? ''),
    hang: xe ? `${String(xe.nam_sx ?? '')}` : '',
  };
}

/** mẫu 1 — KẾ HOẠCH SỬA CHỮA (v3.6 p1KeHoach). id = SC. */
async function buildKeHoach(api: Api, id: string): Promise<PrintDoc> {
  const { sc, bienSo, chuXe } = await scInfo(api, id);
  const doc = await latestStepDoc(api, 'ke_hoach_sc', id);
  const lines = await fetchScLines(api, id);
  const tong = Number(sc.tong ?? 0);
  return {
    type: 'kehoach',
    title: 'KẾ HOẠCH SỬA CHỮA',
    docNumber: 'Số: ' + id + (doc ? '  (KH: ' + doc.id + ')' : ''),
    meta: [
      { label: 'Ngày lập kế hoạch', value: formatNgayVN(doc?.ngay || sc.ngay_tao) },
      { label: 'Hẹn trả xe', value: sc.han_tra_xe ? formatNgayVN(sc.han_tra_xe) : '................' },
      { label: 'Biển số xe', value: bienSo },
      { label: 'Chủ xe / đơn vị', value: chuXe },
      { label: 'Lý do sửa chữa / nội dung dự kiến', value: doc?.mo_ta || 'Sửa chữa theo biên bản kiểm tu.' },
      { label: 'Trạng thái phiếu', value: String(sc.trang_thai ?? '') },
    ],
    lineStyle: 'full',
    lines,
    totals: [
      { label: 'Tổng công việc', value: vnd(sc.tong_cong) + ' đ' },
      { label: 'Tổng vật tư', value: vnd(sc.tong_vt) + ' đ' },
      { label: 'Kinh phí dự kiến', value: vnd(tong) + ' đ' },
    ],
    tong,
    tongChu: sotienChu(tong),
    sigs: ['nguoi_lap', 'lai_xe', 'xuong', 'giam_doc'].map((k) => VI_TRI_LABEL[k]),
    note: 'Người lập: Lái xe / Nhân viên kỹ thuật đề xuất  ·  Duyệt: Phòng Xe máy Thiết bị',
    missing: !doc,
    missingNote: doc ? undefined : 'Chưa lưu kế hoạch (mẫu 01) — in theo thông tin phiếu sửa chữa.',
  };
}

/** mẫu 2 — BẢN KIỂM TU (v3.6 p2KiemTu). id = SC. */
async function buildKiemTu(api: Api, id: string): Promise<PrintDoc> {
  const { sc, bienSo, chuXe } = await scInfo(api, id);
  const doc = await latestStepDoc(api, 'phieu_kiem_tu', id);
  const lines = await fetchScLines(api, id);
  const tong = Number(sc.tong ?? 0);
  return {
    type: 'kiemtu',
    title: 'BẢN KIỂM TU SỬA CHỮA',
    docNumber: 'Số: ' + id + (doc ? '  (KT: ' + doc.id + ')' : ''),
    meta: [
      { label: 'Biển số', value: bienSo },
      { label: 'Chủ xe / đơn vị', value: chuXe },
      { label: 'Ngày kiểm tu', value: formatNgayVN(doc?.ngay || sc.ngay_tao) },
      { label: 'Ghi chú / kiến nghị', value: doc?.mo_ta || '' },
    ],
    lineStyle: 'full',
    lines,
    totals: [
      { label: 'Tổng cộng công việc / vật tư', value: vnd(tong) + ' đ' },
    ],
    tong,
    tongChu: sotienChu(tong),
    sigs: ['nguoi_lap', 'lai_xe', 'thu_kho', 'xuong'].map((k) => VI_TRI_LABEL[k]),
    note: 'Bảng kiểm tu do xưởng sửa chữa lập cùng lái xe; là căn cứ lập kế hoạch mua vật tư.',
    missing: !doc,
    missingNote: doc ? undefined : 'Chưa lưu phiếu kiểm tu — in theo dòng công việc/vật tư của phiếu sửa chữa.',
  };
}

/** mẫu 3 — PHIẾU MUA VẬT TƯ (BÁO GIÁ) (v3.6 p3BaoGia). id = BG hoặc SC. */
async function buildBaoGia(api: Api, id: string): Promise<PrintDoc> {
  let bgId = id;
  if (!id.startsWith('BG-')) {
    const found = await baogiaIdBySc(api, id);
    if (!found) {
      return {
        type: 'baogia',
        title: 'PHIẾU MUA VẬT TƯ (BÁO GIÁ)',
        docNumber: 'Số: —',
        meta: [{ label: 'Phiếu sửa chữa', value: id }],
        lineStyle: 'simple',
        lines: [],
        totals: [],
        tong: 0,
        tongChu: sotienChu(0),
        sigs: ['nguoi_lap', 'kt_truong', 'thu_kho', 'giam_doc'].map((k) => VI_TRI_LABEL[k]),
        note: 'Chưa có báo giá cho phiếu này.',
        missing: true,
        missingNote: 'Chưa có báo giá cho phiếu này.',
      };
    }
    bgId = found;
  }
  const got = await baogiaGet(api, bgId); // core check baogia.xem
  if (!got) throw new Error('404: Không tìm thấy báo giá');
  const b: any = got.baogia;
  const items: any[] = got.chitiet ?? [];
  const lines: PrintLine[] = items.map((it, i) => {
    const sl = Number(it.so_luong ?? 0);
    const gia = Number(it.don_gia ?? 0);
    return { stt: i + 1, loai: 'Vật tư', ten: String(it.ten ?? ''), donvi: '', sl, gia, thanh: sl * gia, nguyen_nhan: '', xu_ly: '' };
  });
  const tong = Number(b.tong ?? 0) || lines.reduce((a, l) => a + l.thanh, 0);
  return {
    type: 'baogia',
    title: 'PHIẾU MUA VẬT TƯ (BÁO GIÁ)',
    docNumber: 'Số: ' + bgId,
    meta: [
      { label: 'Nhà cung cấp', value: String(b.ncc ?? '') },
      { label: 'Ngày báo giá', value: formatNgayVN(b.ngay) },
      { label: 'Phiếu sửa chữa', value: String(b.sc_id ?? '') },
    ],
    lineStyle: 'simple',
    lines,
    totals: [{ label: 'Tổng cộng', value: vnd(tong) + ' đ' }],
    tong,
    tongChu: sotienChu(tong),
    sigs: ['nguoi_lap', 'kt_truong', 'thu_kho', 'giam_doc'].map((k) => VI_TRI_LABEL[k]),
    note: 'Kèm chứng từ gốc của nhà cung cấp (bắt buộc lưu hồ sơ).',
  };
}

/** core phieuGet KHÔNG tự check quyền (gate ở RPC layer) → gate 'kho','xem' ở đây. */
async function mustKhoXem(api: Api): Promise<void> {
  const role = api.auth.current()?.role;
  if (role) {
    if (!(await api.perm.can(api.db, role, 'kho', 'xem'))) throw new Error('403');
  }
}

/** mẫu 4/6 — PHIẾU NHẬP KHO (v3.6 p4NhapKho + p6 NhapCuHong). id = NX hoặc SC (phiếu đầu). */
async function buildNhapKho(api: Api, id: string): Promise<PrintDoc> {
  await mustKhoXem(api);
  let phieuId = id;
  if (!phieuId.startsWith('NX-')) {
    const ids = await phieuIdsBySc(api, id, 'nhap');
    if (!ids.length) throw new Error('404: Không tìm thấy phiếu nhập cho SC');
    phieuId = ids[0];
  }
  const got = await phieuGet(api, { id: phieuId });
  const h = got.result.header;
  const cuHong = String(h.ly_do ?? '') === THU_HOI_MARKER;
  const lines: PrintLine[] = got.result.lines.map((l: any, i: number) => ({
    stt: i + 1,
    loai: 'Vật tư',
    ten: String(l.ten ?? ''),
    donvi: String(l.don_vi ?? ''),
    sl: Number(l.so_luong ?? 0),
    gia: Number(l.don_gia ?? 0),
    thanh: Number(l.thanh_tien ?? 0),
    nguyen_nhan: '',
    xu_ly: '',
  }));
  const tong = Number(got.result.tong_tien ?? 0);
  return {
    type: 'nhapkho',
    title: cuHong ? 'PHIẾU NHẬP KHO VẬT TƯ CŨ HỎNG' : 'PHIẾU NHẬP KHO VẬT TƯ',
    docNumber: 'Số: ' + phieuId,
    meta: [
      { label: 'Nhà cung cấp', value: String(h.ncc ?? '') },
      { label: 'Ngày nhập', value: formatNgayVN(h.ngay) },
      { label: 'Phiếu sửa chữa', value: String(h.sc_id ?? '') },
      { label: 'Lý do / ghi chú', value: cuHong ? 'Vật tư cũ/hỏng thu hồi khi sửa chữa; không định giá nhập.' : String(h.ly_do ?? '') },
    ],
    lineStyle: 'simple',
    lines,
    totals: [{ label: 'Tổng', value: vnd(tong) + ' đ' }],
    tong,
    tongChu: sotienChu(tong),
    sigs: ['nguoi_lap', 'thu_kho', 'kt_truong', 'giam_doc'].map((k) => VI_TRI_LABEL[k]),
    note: cuHong
      ? 'Vật tư cũ/hỏng theo dõi riêng (kho vật tư cũ hỏng).'
      : 'Vật tư nhập mới phục vụ sửa chữa được xuất thẳng cho phiếu sửa chữa; phần dư nhập tồn kho.',
  };
}

/** mẫu 5 — PHIẾU XUẤT KHO (v3.6 p5XuatKho). id = NX hoặc SC (phiếu đầu). */
async function buildXuatKho(api: Api, id: string): Promise<PrintDoc> {
  await mustKhoXem(api);
  let phieuId = id;
  if (!phieuId.startsWith('NX-')) {
    const ids = await phieuIdsBySc(api, id, 'xuat');
    if (!ids.length) throw new Error('404: Không tìm thấy phiếu xuất cho SC');
    phieuId = ids[0];
  }
  const got = await phieuGet(api, { id: phieuId });
  const h = got.result.header;
  const thanhLy = String(h.ly_do ?? '') === 'Thanh lý';
  const lines: PrintLine[] = got.result.lines.map((l: any, i: number) => ({
    stt: i + 1,
    loai: 'Vật tư',
    ten: String(l.ten ?? ''),
    donvi: String(l.don_vi ?? ''),
    sl: Number(l.so_luong ?? 0),
    gia: Number(l.don_gia ?? 0),
    thanh: Number(l.thanh_tien ?? 0),
    nguyen_nhan: '',
    xu_ly: '',
  }));
  const tong = Number(got.result.tong_tien ?? 0);
  return {
    type: 'xuatkho',
    title: thanhLy ? 'PHIẾU XUẤT THANH LÝ KHO ĐỒ HƯ HỎNG' : 'PHIẾU XUẤT KHO VẬT TƯ',
    docNumber: 'Số: ' + phieuId,
    meta: [
      { label: 'Ngày xuất', value: formatNgayVN(h.ngay) },
      { label: 'Người nhận', value: String(h.nguoi ?? '') },
      { label: 'Lý do', value: String(h.ly_do ?? '') },
      // v3.6 in 'Cho phiếu sửa chữa xe: <bks> (SC-…)' — v5 join nhãn qua scGet khi có sc_id
      { label: 'Cho phiếu sửa chữa', value: String(h.sc_id ?? '') },
    ],
    lineStyle: 'simple',
    lines,
    totals: [{ label: 'Tổng', value: vnd(tong) + ' đ' }],
    tong,
    tongChu: sotienChu(tong),
    sigs: ['nguoi_lap', 'thu_kho', 'kt_truong', 'xuong'].map((k) => VI_TRI_LABEL[k]),
    note: thanhLy
      ? 'Thanh lý / xuất kho đồ hư hỏng: vật tư không còn giá trị sử dụng, giảm tồn kho đồ hư hỏng.'
      : 'Xuất kho cho thợ sửa chữa tại xưởng; vật tư xuất thẳng khi nhập kho cũng được hệ thống lập phiếu này.',
  };
}

/** mẫu 7 — BIÊN BẢN NGHIỆM THU (v3.6 p7NghiemThu). id = SC.
 *  LỆCH v5 CÓ CHỦ ĐÍCH: schema v5 bien_ban_nghiem KHÔNG có cột ket_luan/bao_hanh
 *  → in kết luận tĩnh theo mẫu + đúng 2 cột tiền (chỉ huy W4.3 xác nhận 30/08). */
async function buildNghiemThu(api: Api, id: string): Promise<PrintDoc> {
  const { sc, bienSo, chuXe } = await scInfo(api, id);
  const bb = await latestNghiemThu(api, id);
  const tong = Number(sc.tong ?? 0);
  const meta: PrintField[] = [
    { label: 'Biển số', value: bienSo },
    { label: 'Chủ xe / đơn vị', value: chuXe },
    { label: 'Ngày nghiệm thu', value: bb?.ngay_nghiem ? formatNgayVN(bb.ngay_nghiem) : todayVN() },
    { label: 'Kết luận nghiệm thu', value: 'Đạt yêu cầu kỹ thuật, phương tiện được bàn giao lại cho lái xe.' },
  ];
  return {
    type: 'nghiemthu',
    title: 'BIÊN BẢN NGHIỆM THU SỬA CHỮA VÀ BÀN GIAO PHƯƠNG TIỆN',
    docNumber: 'Số: ' + id + (bb ? '  (NN: ' + bb.id + ')' : ''),
    meta,
    lineStyle: 'simple',
    lines: [],
    totals: [
      { label: 'Tổng giá trị nhân công', value: vnd(bb ? bb.tong_nhan_cong : sc.tong_cong) + ' đ' },
      { label: 'Tổng giá trị vật tư', value: vnd(bb ? bb.tong_vat_tu : sc.tong_vt) + ' đ' },
      { label: 'Tổng cộng', value: vnd(tong) + ' đ' },
    ],
    tong,
    tongChu: sotienChu(tong),
    sigs: ['ben_giao', 'ben_nhan', 'lai_xe', 'giam_doc'].map((k) => VI_TRI_LABEL[k]),
    note: 'Bên giao: Người đại diện xưởng sửa chữa  ·  Bên nhận: Người đại diện đơn vị sử dụng / lái xe.',
    missing: !bb,
    missingNote: bb ? undefined : 'Chưa lưu biên bản nghiệm thu — số liệu lấy trực tiếp từ phiếu sửa chữa.',
  };
}

/** mẫu 8 — BẢNG KÊ CHI TIẾT (v3.6 p8BangKe). id = SC. */
async function buildBangKe(api: Api, id: string): Promise<PrintDoc> {
  const { sc, bienSo } = await scInfo(api, id);
  const lines = await fetchScLines(api, id);
  const tong = Number(sc.tong ?? 0);
  return {
    type: 'bangke',
    title: 'BẢNG KÊ CHI TIẾT NỘI DUNG THAY THẾ SỬA CHỮA',
    docNumber: 'Số: ' + id,
    meta: [
      { label: 'Biển số', value: bienSo },
      { label: 'Phiếu sửa chữa', value: id },
      { label: 'Ngày', value: formatNgayVN(sc.ngay_tao) },
    ],
    lineStyle: 'full',
    lines,
    totals: [{ label: 'Tổng cộng', value: vnd(tong) + ' đ' }],
    tong,
    tongChu: sotienChu(tong),
    sigs: ['nguoi_lap', 'kt_truong', 'thu_kho', 'giam_doc'].map((k) => VI_TRI_LABEL[k]),
    note: 'Bảng kê này đính kèm hồ sơ quyết toán thanh toán chi phí sửa chữa.',
  };
}

/** BỘ HỒ SƠ 8 BƯỚC (v3.6 hoSo) — gộp 1 trang nhiều block + bảng checkHoSo. id = SC. */
async function buildHoSo(api: Api, id: string): Promise<PrintDoc[]> {
  const { sc } = await scInfo(api, id); // gate sc.xem 1 lần; các lỗi con được bắt mềm bên dưới
  const docs: PrintDoc[] = [];
  docs.push(await buildKeHoach(api, id));
  docs.push(await buildKiemTu(api, id));

  let missingBaoGia = true;
  try {
    const d = await buildBaoGia(api, id);
    missingBaoGia = false;
    docs.push(d);
  } catch {
    /* placeholder mềm tay — xem v3.6 hoSo() */
  }
  if (missingBaoGia) {
    docs.push({
      type: 'baogia', title: 'PHIẾU MUA VẬT TƯ (BÁO GIÁ)', docNumber: 'Số: —', meta: [],
      lineStyle: 'simple', lines: [], totals: [], tong: 0, tongChu: sotienChu(0), sigs: [],
      note: '', missing: true, missingNote: 'Chưa có báo giá cho phiếu này.',
    });
  }

  const pushMissing = (t: InType, title: string, note: string) => {
    docs.push({
      type: t, title, docNumber: 'Số: —', meta: [], lineStyle: 'simple', lines: [],
      totals: [], tong: 0, tongChu: sotienChu(0), sigs: [], note: '', missing: true, missingNote: note,
    });
  };

  // nhập kho: mọi phiếu 'nhap' của SC (v3.6 lọc qua ref_dm; v5 liên kết trực tiếp sc_id +
  // phân biệt cũ/hỏng bằng THU_HOI_MARKER theo ly_do — đã chốt ở schema W1c)
  await mustKhoXem(api);
  const nhapIds = await phieuIdsBySc(api, id, 'nhap');
  const thuong: string[] = [];
  const cuHong: string[] = [];
  for (const pid of nhapIds) {
    const g = await phieuGet(api, { id: pid });
    (String(g.result.header.ly_do ?? '') === THU_HOI_MARKER ? cuHong : thuong).push(pid);
  }
  if (thuong.length) {
    for (const pid of thuong) docs.push(await buildNhapKho(api, pid));
  } else {
    pushMissing('nhapkho', 'PHIẾU NHẬP KHO VẬT TƯ', 'Chưa có phiếu nhập kho vật tư mới cho bước này.');
  }

  const xuatIds = await phieuIdsBySc(api, id, 'xuat');
  if (xuatIds.length) {
    for (const pid of xuatIds) docs.push(await buildXuatKho(api, pid));
  } else {
    pushMissing('xuatkho', 'PHIẾU XUẤT KHO VẬT TƯ', 'Chưa có phiếu xuất kho cho bước này.');
  }

  if (cuHong.length) {
    for (const pid of cuHong) docs.push(await buildNhapKho(api, pid));
  } else {
    pushMissing('nhapkho', 'PHIẾU NHẬP KHO VẬT TƯ CŨ HỎNG', 'Chưa có phiếu nhập kho vật tư cũ/hỏng cho bước này (không bắt buộc).');
  }

  docs.push(await buildNghiemThu(api, id));
  const bangke = await buildBangKe(api, id);
  // bảng 8 bước gắn vào block cuối (kết thúc hồ sơ) — checkHoSo core tự gate hoso.xem
  const check = await checkHoSo(api, id);
  bangke.steps = check.steps.map((s) => ({ step: s.step, label: s.label, ok: s.ok, note: s.note ?? '' }));
  docs.push(bangke);
  return docs;
}

/* ────────────────────────── API chính cho page/route ────────────────────────── */

/**
 * Nạp bộ mẫu in theo type+id. Lỗi ném ra có mã trong message:
 *  '403' → không đủ quyền; '404'/'Không tìm thấy' → chứng từ không tồn tại.
 * Route/page không được 'chốt' kết quả cho coordinator: chỉ map sang notFound/redirect.
 */
export async function loadPrintDocs(api: Api, type: InType, idRaw: string): Promise<PrintDoc[]> {
  const id = idRaw.toUpperCase();
  if (!isPrintId(id)) throw new Error('400: id chứng từ không hợp lệ');
  switch (type) {
    case 'kehoach':
      if (!id.startsWith('SC-')) throw new Error('400: mẫu kế hoạch cần id SC-xxxxxx');
      return [await buildKeHoach(api, id)];
    case 'kiemtu':
      if (!id.startsWith('SC-')) throw new Error('400: mẫu kiểm tu cần id SC-xxxxxx');
      return [await buildKiemTu(api, id)];
    case 'baogia':
      if (!id.startsWith('SC-') && !id.startsWith('BG-')) throw new Error('400: mẫu báo giá cần id SC- hoặc BG-');
      return [await buildBaoGia(api, id)];
    case 'nhapkho':
      if (!id.startsWith('SC-') && !id.startsWith('NX-')) throw new Error('400: mẫu nhập kho cần id SC- hoặc NX-');
      return [await buildNhapKho(api, id)];
    case 'xuatkho':
      if (!id.startsWith('SC-') && !id.startsWith('NX-')) throw new Error('400: mẫu xuất kho cần id SC- hoặc NX-');
      return [await buildXuatKho(api, id)];
    case 'nghiemthu':
      if (!id.startsWith('SC-')) throw new Error('400: mẫu nghiệm thu cần id SC-xxxxxx');
      return [await buildNghiemThu(api, id)];
    case 'bangke':
      if (!id.startsWith('SC-')) throw new Error('400: bảng kê cần id SC-xxxxxx');
      return [await buildBangKe(api, id)];
    case 'hoso':
      if (!id.startsWith('SC-')) throw new Error('400: bộ hồ sơ cần id SC-xxxxxx');
      return buildHoSo(api, id);
    default:
      throw new Error('400: Loại in không hỗ trợ: ' + String(type));
  }
}

/* ────────────────────────── CSV-safe (export tạm thay xlsx — chưa có dep, KHÔNG npm i) ────────────────────────── */

/**
 * Escape ô CSV an toàn:
 *  - chuẩn RFC4180: bọc dấu kép khi chứa `" , \n \r`, nhân đôi `"` bên trong;
 *  - chống CSV/formula injection: ô dạng TEXT bắt đầu bằng `= + - @ TAB CR` → prefix `'`.
 *    Số thuần (number type) giữ nguyên không escape — chỉ chuỗi mới bị ép kiểu công thức.
 */
export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '0';
  let s = String(v);
  const needsQuote = /[",\r\n]/.test(s);
  const formula = /^[=+\-@\t\r]/.test(s);
  if (formula && !s.startsWith("'")) s = "'" + s;
  if (needsQuote) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** Dựng file CSV an toàn (BOM UTF-8 CRLF) cho Excel. */
export function toCsvSafe(rows: (string | number | null | undefined)[][]): string {
  const body = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  return '\uFEFF' + body + '\r\n';
}

/** Flatten 1 PrintDoc thành các dòng CSV (meta + bảng dòng + tổng + tiền bằng chữ). */
export function printDocToCsvRows(d: PrintDoc): (string | number | null | undefined)[][] {
  const rows: (string | number | null | undefined)[][] = [];
  rows.push([d.title]);
  rows.push([d.docNumber]);
  for (const m of d.meta) rows.push([m.label + ':', m.value]);
  if (d.missing && d.missingNote) rows.push(['⚠', d.missingNote]);
  rows.push([]);
  rows.push(
    d.lineStyle === 'full'
      ? ['STT', 'Loại', 'Tên công việc / Vật tư', 'ĐVT', 'SL', 'Nguyên nhân', 'Xử lý', 'Đơn giá', 'Thành tiền']
      : ['STT', 'Tên', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền']
  );
  for (const l of d.lines) {
    rows.push(
      d.lineStyle === 'full'
        ? [l.stt, l.loai, l.ten, l.donvi, l.sl, l.nguyen_nhan, l.xu_ly, l.gia, l.thanh]
        : [l.stt, l.ten, l.donvi, l.sl, l.gia, l.thanh]
    );
  }
  if (!d.lines.length) rows.push(['', 'Không có chi tiết']);
  rows.push([]);
  for (const t of d.totals) rows.push([t.label + ':', t.value]);
  if (d.type === 'bangke' || d.type === 'hoso' || d.type === 'kehoach') {
    rows.push(['Tổng số tiền (bằng chữ):', d.tongChu]);
  }
  return rows;
}
