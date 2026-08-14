/**
 * preview.ts — "Xem thử vai trò" (Role Preview) dành riêng cho Quản trị.
 * Port server/preview.js v3.6 — NGUY��N logic.
 * Mục đích: admin giả lập góc nhìn của 7 vai chức năng (giamdoc / quanly /
 * ketoan / tho / khoa / xuong / laixe) để tinh chỉnh giao diện & chức năng.
 * Mọi dữ liệu trả về là M��U (DEMO) sinh trong bộ nhớ.
 */
import * as perm from './perm.js';
import { MATRIX } from './perm.js';

/** Vai được phép xem thử (admin là người xem, không nằm trong danh sách này). */
export const PREVIEW_ROLES = ['giamdoc', 'quanly', 'ketoan', 'tho', 'khoa', 'xuong', 'laixe'] as const;

export const ROLE_LABEL: Record<string, string> = {
  giamdoc: 'Giám đốc', quanly: 'Quản lý', ketoan: 'Kế toán', tho: 'Thợ kỹ thuật', khoa: 'Thủ kho',
  xuong: 'Quản lý xưởng', laixe: 'Lái xe'
};

/** Danh sách hàm được phép gọi khi đang preview. */
export const ALLOW = [
  'previewState', 'previewStop', 'previewInfo',
  'previewHome', 'previewSC', 'previewKho', 'previewDM'
] as const;

/* Trạng thái preview theo phiên: token → role. */
const _previews = new Map<string, string>();

function byToken(token: string): string | null { return _previews.get(String(token || '')) || null; }
function start(token: string, role: string): { ok: boolean; state?: ReturnType<typeof stateFor>; error?: string } {
  role = String(role || '').toLowerCase();
  if ((PREVIEW_ROLES as readonly string[]).indexOf(role) < 0) return { ok: false, error: 'Vai không hợp lệ cho xem thử.' };
  _previews.set(String(token || ''), role);
  return { ok: true, state: stateFor(role) };
}
function stop(token: string): { ok: boolean; state: null } { _previews.delete(String(token || '')); return { ok: true, state: null }; }
function stateFor(role: string): { role: string; label: string } { return { role, label: ROLE_LABEL[role] || role }; }

let _tok = '';
function currentToken(): string { return _tok || ''; }
function setToken(t: string): void { _tok = String(t || ''); }

/* ---------------- dữ liệu mẫu (DEMO) ---------------- */
function _demoSC(role: string): Array<Record<string, unknown>> {
  const pool = [
    { id: 'SC-DEMO-001', bks: '43A-01.234', nguoi_lap: 'Tô Văn Minh', ngay: '2026-08-08', trang_thai: 'de_xuat', mo_ta: 'Ví dụ: xe chạy yếu, rung máy khi đề.', tong_cong: 1500000, tong_vt: 680000, tong: 2180000, nCong: 3, nVt: 2, label: 'Đề xuất' },
    { id: 'SC-DEMO-002', bks: '43A-02.111', nguoi_lap: 'Nguyễn Đức Trí', ngay: '2026-08-07', trang_thai: 'da_duyet', mo_ta: 'Ví dụ: thay nhớt + lọc gió định kỳ.', tong_cong: 600000, tong_vt: 950000, tong: 1550000, nCong: 2, nVt: 3, label: 'Đã duyệt' },
    { id: 'SC-DEMO-003', bks: '43C-08.909', nguoi_lap: 'Vũ Thị Lan', ngay: '2026-08-06', trang_thai: 'dang_sua', mo_ta: 'Ví dụ: thay má phanh trước, xả dầu phanh.', tong_cong: 2400000, tong_vt: 1200000, tong: 3600000, nCong: 4, nVt: 3, label: 'Đang sửa' },
    { id: 'SC-DEMO-004', bks: '43A-03.333', nguoi_lap: 'Tô Văn Minh', ngay: '2026-08-05', trang_thai: 'cho_nghiem', mo_ta: 'Ví dụ: hàn khung, sơn chống rỉ.', tong_cong: 5000000, tong_vt: 800000, tong: 5800000, nCong: 5, nVt: 1, label: 'Chờ nghiệm thu' },
    { id: 'SC-DEMO-005', bks: '43B-12.345', nguoi_lap: 'Nguyễn Đức Trí', ngay: '2026-08-03', trang_thai: 'da_hoan', mo_ta: 'Ví dụ: kiểm tra toàn bộ hệ thống điện.', tong_cong: 1800000, tong_vt: 350000, tong: 2150000, nCong: 3, nVt: 2, label: 'Hoàn thành' },
    { id: 'SC-DEMO-006', bks: '43A-05.678', nguoi_lap: 'Vũ Thị Lan', ngay: '2026-08-01', trang_thai: 'da_quyet', mo_ta: 'Ví dụ: đã quyết toán, ghi lý lịch.', tong_cong: 900000, tong_vt: 1200000, tong: 2100000, nCong: 2, nVt: 4, label: 'Đã quyết toán' },
    { id: 'SC-DEMO-007', bks: '43D-07.777', nguoi_lap: 'Tô Văn Minh', ngay: '2026-07-30', trang_thai: 'tu_choi', mo_ta: 'Ví dụ: chi phí vượt ngưỡng, bị từ chối.', tong_cong: 8000000, tong_vt: 2500000, tong: 10500000, nCong: 6, nVt: 5, label: 'Từ chối' }
  ];
  const map: Record<string, string[]> = {
    tho:     ['de_xuat', 'da_duyet', 'dang_sua', 'cho_nghiem'],
    khoa:    ['da_duyet', 'dang_sua'],
    ketoan:  ['da_hoan', 'da_quyet'],
    quanly:  ['de_xuat', 'da_duyet', 'cho_nghiem'],
    giamdoc: ['de_xuat', 'da_duyet', 'cho_nghiem', 'da_hoan'],
    xuong:   ['da_duyet', 'dang_sua', 'cho_nghiem'],
    laixe:   ['de_xuat']
  };
  const keep = map[role] || [];
  return pool.filter((r) => keep.indexOf(r.trang_thai) >= 0).slice(0, 6);
}

function _demoVattu(): Array<Record<string, unknown>> {
  return [
    { id: 'VT-DEMO-101', code: 'VT101', name: 'Vòng bi may ơ', nhom: 'Truyền động', donvi: 'cái', gia: 185000, ton: 3, ton_min: 5, thieu: 2, low: true },
    { id: 'VT-DEMO-102', code: 'VT102', name: 'Nhớt động cơ 15W-40', nhom: 'Nhớt', donvi: 'lít', gia: 88000, ton: 40, ton_min: 20, thieu: 0, low: false },
    { id: 'VT-DEMO-103', code: 'VT103', name: 'Má phanh trước', nhom: 'Phanh', donvi: 'bộ', gia: 320000, ton: 2, ton_min: 4, thieu: 2, low: true },
    { id: 'VT-DEMO-104', code: 'VT104', name: 'Lọc gió', nhom: 'Lọc', donvi: 'cái', gia: 120000, ton: 8, ton_min: 3, thieu: 0, low: false },
    { id: 'VT-DEMO-105', code: 'VT105', name: 'Đèn pha LED', nhom: 'Điện', donvi: 'bộ', gia: 450000, ton: 1, ton_min: 2, thieu: 1, low: true }
  ];
}

function _demoDM(role: string): Array<Record<string, unknown>> {
  return [
    { id: 'DM-DEMO-001', nguoi_lap: 'Vũ Thị Lan', ngay: '2026-08-08', trang_thai: 'cho_duyet', tong: 1250000, ghi_chu: 'Ví dụ: bổ sung vòng bi + má phanh.', so_dong: 3, label: 'Chờ duyệt' },
    { id: 'DM-DEMO-002', nguoi_lap: 'Vũ Thị Lan', ngay: '2026-08-06', trang_thai: 'da_duyet', tong: 880000, ghi_chu: 'Ví dụ: nhớt + lọc gió tháng.', so_dong: 2, label: 'Đã duyệt' },
    { id: 'DM-DEMO-003', nguoi_lap: 'Vũ Thị Lan', ngay: '2026-08-04', trang_thai: 'tu_choi', tong: 2400000, ghi_chu: 'Ví dụ: vượt ngưỡng duyệt.', so_dong: 4, label: 'Từ chối' }
  ];
}

function _demoHome(role: string): Record<string, unknown> {
  const stats = {
    giamdoc: { xe: 42, scChoDuyet: 3, scDang: 2, dmChoDuyet: 1, lowTon: 3, sbd: 5 },
    quanly:  { xe: 42, scChoDuyet: 3, scDang: 2, dmChoDuyet: 0, lowTon: 3, sbd: 5 },
    ketoan:  { xe: 42, scChoDuyet: 0, scDang: 2, dmChoDuyet: 1, lowTon: 0, sbd: 0 },
    tho:     { xe: 42, scChoDuyet: 0, scDang: 2, dmChoDuyet: 0, lowTon: 0, sbd: 0 },
    khoa:    { xe: 42, scChoDuyet: 0, scDang: 2, dmChoDuyet: 0, lowTon: 3, sbd: 0 },
    xuong:   { xe: 42, scChoDuyet: 0, scDang: 2, dmChoDuyet: 0, lowTon: 0, sbd: 0 },
    laixe:   { xe: 42, scChoDuyet: 0, scDang: 0, dmChoDuyet: 0, lowTon: 0, sbd: 0 }
  }[role] || { xe: 42, scChoDuyet: 0, scDang: 0, dmChoDuyet: 0, lowTon: 0, sbd: 0 };

  const tasks: Array<Record<string, unknown>> = [];
  if (role === 'tho') {
    tasks.push({ type: 'job', sc_id: 'SC-DEMO-003', bks: '43C-08.909', ten: 'Thay má phanh trước', tt: 'dang' });
    tasks.push({ type: 'job', sc_id: 'SC-DEMO-002', bks: '43A-02.111', ten: 'Thay nhớt định kỳ', tt: 'todo' });
    tasks.push({ type: 'note', text: 'Bạn có 2 việc đang chờ (dữ liệu mẫu).' });
  }
  if (role === 'quanly' || role === 'giamdoc') {
    tasks.push({ type: 'approve_sc', sc_id: 'SC-DEMO-001', bks: '43A-01.234', tong: 2180000 });
    tasks.push({ type: 'note', text: 'Có 3 phiếu sửa chữa chờ duyệt (dữ liệu mẫu).' });
  }
  if (role === 'ketoan') {
    tasks.push({ type: 'approve_dm', dm_id: 'DM-DEMO-001', tong: 1250000 });
    tasks.push({ type: 'note', text: 'Có 1 đề nghị mua chờ duyệt (dữ liệu mẫu).' });
  }
  if (role === 'xuong') {
    tasks.push({ type: 'tk_workshop', tk_id: 'TK-DEMO-001', bks: '43A-01.234', mo_ta: 'Máy nổ yếu, khói đen (mẫu)' });
    tasks.push({ type: 'nghiem_sc', sc_id: 'SC-DEMO-004', bks: '43A-03.333', tong: 5800000 });
    tasks.push({ type: 'note', text: 'Có 1 yêu cầu chờ xưởng nhận, 1 phiếu chờ nghiệm thu (dữ liệu mẫu).' });
  }
  if (role === 'laixe') {
    tasks.push({ type: 'tk_view', tk_id: 'TK-DEMO-001', bks: '43A-01.234', trang_thai: 'cho_duyet' });
    tasks.push({ type: 'note', text: 'Yêu cầu thăm khám của bạn đang chờ duyệt (dữ liệu mẫu).' });
  }

  const dd = new Date();
  const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  return {
    ok: true,
    demo: true,
    me: { id: 'demo-' + role, name: ROLE_LABEL[role] + ' (DEMO)', role },
    greeting: 'Chào buổi sáng',
    thu: days[dd.getDay()],
    ngay: dd.getDate() + ' tháng ' + (dd.getMonth() + 1) + ', ' + dd.getFullYear(),
    gio: String(dd.getHours()).padStart(2, '0') + ':' + String(dd.getMinutes()).padStart(2, '0'),
    shortcuts: [
      { view: 'sc', label: 'Phiếu sửa chữa' },
      { view: 'vattu', label: 'Kho & vật tư' },
      { view: 'asset', label: 'Tài sản & quyết toán' }
    ],
    myToday: { xong: 1, con: 2 },
    myYesterday: { xong: 1 },
    stats,
    myTasks: tasks,
    lowTon: (['quanly', 'giamdoc', 'khoa', 'ketoan'].indexOf(role) >= 0) ? _demoVattu().filter((v) => (v.low as boolean)) : []
  };
}

/* ---------------- previewInfo: màn + nút theo vai ---------------- */
function canPreview(role: string, m: string, f: string): boolean {
  const features = MATRIX[role]?.[m];
  return features ? features.indexOf(f) >= 0 : false;
}

function _navOf(role: string): Array<Record<string, unknown>> {
  const def = (key: string, label: string, on: boolean) => ({ key, label, on });
  return [
    def('dash', 'Bảng điều khiển', true),
    def('sc', 'Phiếu sửa chữa', canPreview(role, 'sc', 'xem')),
    def('scnew', 'Tạo phiếu sửa', canPreview(role, 'sc', 'tao')),
    def('vattu', 'Danh mục vật tư', canPreview(role, 'kho', 'xem')),
    def('dm', 'Đề nghị mua', canPreview(role, 'mua', 'xem')),
    def('nhapkho', 'Phiếu nhập', canPreview(role, 'kho', 'tao')),
    def('xuatkho', 'Phiếu xuất', canPreview(role, 'kho', 'xuat')),
    def('chat', 'Nhắn tin & giao việc', canPreview(role, 'chat', 'xem')),
    def('asset', 'Tài sản & quyết toán', canPreview(role, 'asset', 'xem')),
    def('report', 'Báo cáo quản lý', canPreview(role, 'report', 'xem')),
    def('insp', 'Phiếu kiểm tra', true),
    def('health', 'Nhật ký sức khỏe', true)
  ];
}

function _actionsOf(role: string): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  if (canPreview(role, 'sc', 'tao')) out.push({ label: 'Lập phiếu sửa chữa mới', mod: 'sc' });
  if (canPreview(role, 'sc', 'duy')) out.push({ label: 'Duyệt / nghiệm thu phiếu sửa chữa', mod: 'sc' });
  if (canPreview(role, 'sc', 'sua')) out.push({ label: 'Sửa công việc & vật tư của phiếu', mod: 'sc' });
  if (canPreview(role, 'mua', 'tao')) out.push({ label: 'Tạo đề nghị mua', mod: 'mua' });
  if (canPreview(role, 'mua', 'duy')) out.push({ label: 'Duyệt đề nghị mua', mod: 'mua' });
  if (canPreview(role, 'kho', 'tao')) out.push({ label: 'Lập phiếu nhập kho', mod: 'kho' });
  if (canPreview(role, 'kho', 'xuat')) out.push({ label: 'Lập phiếu xuất kho', mod: 'kho' });
  if (canPreview(role, 'asset', 'quyet')) out.push({ label: 'Quyết toán & ghi lý lịch', mod: 'asset' });
  if (canPreview(role, 'chat', 'tao')) out.push({ label: 'Nhắn tin & giao việc', mod: 'chat' });
  return out;
}

export function previewInfo(role: string): { ok: boolean; demo: boolean; role: string; label: string; nav: Array<Record<string, unknown>>; actions: Array<Record<string, unknown>>; error?: string } {
  role = String(role || '').toLowerCase();
  if ((PREVIEW_ROLES as readonly string[]).indexOf(role) < 0) return { ok: false, error: 'Vai không hợp lệ.', demo: false, role: '', label: '', nav: [], actions: [] };
  return {
    ok: true,
    demo: true,
    role,
    label: ROLE_LABEL[role] || role,
    nav: _navOf(role),
    actions: _actionsOf(role)
  };
}

export function previewHome(role: string): Record<string, unknown> { return _demoHome(String(role || '').toLowerCase()); }
export function previewSC(role: string): { demo: boolean; rows: Array<Record<string, unknown>> } { return { demo: true, rows: _demoSC(String(role || '').toLowerCase()) }; }
export function previewKho(role: string): { demo: boolean; rows: Array<Record<string, unknown>>; lowCount: number; giaTriTonKho: number } {
  const rows = _demoVattu();
  return { demo: true, rows, lowCount: rows.filter((v) => (v.low as boolean)).length, giaTriTonKho: rows.reduce((a, v) => a + Number(v.ton) * Number(v.gia), 0) };
}
export function previewDM(role: string): { demo: boolean; rows: Array<Record<string, unknown>> } { return { demo: true, rows: _demoDM(String(role || '').toLowerCase()) }; }

// Token management
export function previewState(token: string): { role: string; label: string } | null {
  const role = _previews.get(String(token || ''));
  return role ? { role, label: ROLE_LABEL[role] || role } : null;
}
export function previewStart(token: string, role: string): { ok: boolean; state?: { role: string; label: string }; error?: string } { return start(token, role); }
export function previewStop(token: string): { ok: boolean; state: null } { return stop(token); }