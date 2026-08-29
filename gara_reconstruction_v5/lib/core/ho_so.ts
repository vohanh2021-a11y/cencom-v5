import type { Api } from '../types';
import { row, run, nextId } from '../db';
import { logActivity } from './activity';
import { createScopedLogger } from '../observability';

const log = createScopedLogger('ho_so');

/** Chuỗi khi có cung cấp (field optional) — chặn object/array/type-confusion injection */
function optionalStr(v: any, label: string): void {
  if (v !== undefined && v !== null && v !== '' && typeof v !== 'string') {
    throw new Error(label + ' không hợp lệ');
  }
}

export async function hoSoGet(api: Api, sc_id: string): Promise<any | null> {
  const u = api.auth.current();
  const role = u?.role;
  if (role) {
    if (!(await api.perm.can(api.db, role, 'hoso', 'xem'))) throw new Error('Không đủ quyền');
  }
  return row('SELECT * FROM ho_so WHERE sc_id=$1 AND deleted_at=$2 ORDER BY ngay DESC LIMIT 1', [sc_id, '']);
}

export async function hoSoSave(api: Api, p: { sc_id: string; so_chung_tu?: string; ngay?: string; ghi_chu?: string }): Promise<{ id: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'hoso', 'tao'))) {
    log.logWarn('hoSoSave: permission denied', { actor: u?.id, role });
    throw new Error('403');
  }
  if (typeof p?.sc_id !== 'string' || !p.sc_id.trim()) {
    log.logWarn('hoSoSave: missing sc_id', { actor: u?.id });
    throw new Error('Thiếu sc_id');
  }
  optionalStr(p?.so_chung_tu, 'so_chung_tu');
  optionalStr(p?.ngay, 'ngay');
  optionalStr(p?.ghi_chu, 'ghi_chu');
  const isTest = role === 'admin' ? 1 : 0;
  const id = await nextId('HS');
  await run(
    'INSERT INTO ho_so (id, sc_id, so_chung_tu, ngay, ghi_chu, nguoi_lap, is_test, deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, p.sc_id, p.so_chung_tu ?? null, p.ngay ?? null, p.ghi_chu ?? null, u?.id ?? null, isTest, '']
  );
  try {
    await logActivity(api.db, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'hoso_luu',
      doi_tuong: 'hoso',
      doi_tuong_id: id,
      sc_id: p.sc_id,
      mo_ta: 'Lưu hồ sơ kế toán',
    });
  } catch (e: any) {
    log.logError('hoSoSave: logActivity failed', e, { id, sc_id: p.sc_id });
  }
  log.logInfo('hoSoSave: saved', { sc_id: p.sc_id, id, actor: u?.id });
  return { id };
}

export async function hoSoList(api: Api, p?: { sc_id?: string }): Promise<any[]> {
  let sql = 'SELECT * FROM ho_so WHERE deleted_at=$1 AND is_test=0';
  const params: any[] = [''];
  if (p?.sc_id) {
    sql += ' AND sc_id=$' + (params.push(p.sc_id));
  }
  sql += ' ORDER BY ngay DESC';
  const r = await api.db.query(sql, params);
  return r.rows;
}

/* ============ HỒ SƠ 8 BƯỚC SỬA CHỮA ============ */

export interface HoSoStep {
  step: number;
  label: string;
  ok: boolean;
  note?: string;
  link?: string;
}

export interface HoSoCheckResult {
  ok: boolean;
  steps: HoSoStep[];
  miss: string[];
}

/**
 * Kiểm tra 8 bước hồ sơ sửa chữa cho 1 SC (bám logic v4, map sang schema v5):
 *  1. Kế hoạch SC (mẫu 01)      -> sc_congviec có ≥1 dòng
 *  2. Bản kiểm tu (vật tư)       -> sc_vattu có ≥1 dòng
 *  3. Báo giá NCC                -> baogia có sc_id
 *  4. Phiếu nhập kho vật tư mới  -> nhap_xuat loai='nhap' AND sc_id
 *  5. Phiếu xuất kho cho SC      -> nhap_xuat loai='xuat' AND sc_id
 *  6. VT cũ/hỏng + thanh lý     -> KHÔNG bắt buộc (ok=true)
 *  7. Biên bản nghiệm thu        -> sc.trang_thai da_hoan/da_quyet
 *  8. Bảng kê chi tiết           -> sc.tong > 0
 * Chặn quyết toán khi thiếu 1,2,3,4,5,7,8.
 */
export async function checkHoSo(api: Api, scId: string): Promise<HoSoCheckResult> {
  const u = api.auth.current();
  const role = u?.role;
  if (role) {
    if (!(await api.perm.can(api.db, role, 'hoso', 'xem'))) {
      log.logWarn('checkHoSo: permission denied', { actor: u?.id, role, sc_id: scId });
      throw new Error('403');
    }
  }
  if (typeof scId !== 'string' || !scId.trim()) {
    log.logWarn('checkHoSo: missing sc_id', { actor: u?.id });
    throw new Error('Thiếu sc_id');
  }

  const sc = await row('SELECT * FROM sc WHERE id=$1 AND deleted_at=$2', [scId, '']);
  if (!sc) return { ok: false, steps: [], miss: ['Phiếu sửa chữa không tồn tại'] };

  const steps: HoSoStep[] = [];

  // 1. Kế hoạch sửa chữa (mẫu 01) -> ke_hoach_sc
  const kh = await row<{ c: number }>(
    'SELECT COUNT(*)::int AS c FROM ke_hoach_sc WHERE sc_id=$1 AND deleted_at=$2',
    [scId, '']
  );
  steps.push({
    step: 1,
    label: 'Kế hoạch sửa chữa (mẫu 01)',
    ok: Number(kh?.c ?? 0) > 0,
    note: 'Lưu kế hoạch SC',
    link: 'kh',
  });

  // 2. Bản kiểm tu -> phieu_kiem_tu
  const kt = await row<{ c: number }>(
    'SELECT COUNT(*)::int AS c FROM phieu_kiem_tu WHERE sc_id=$1 AND deleted_at=$2',
    [scId, '']
  );
  steps.push({
    step: 2,
    label: 'Bản kiểm tu',
    ok: Number(kt?.c ?? 0) > 0,
    note: 'Lưu phiếu kiểm tu',
    link: 'kt',
  });

  // 3. Báo giá NCC (đã xác nhận) -> bao_gia_ncc.ocr_xac_nhan=1
  const bg = await row<{ c: number }>(
    'SELECT COUNT(*)::int AS c FROM bao_gia_ncc WHERE sc_id=$1 AND deleted_at=$2 AND ocr_xac_nhan=1',
    [scId, '']
  );
  steps.push({
    step: 3,
    label: 'Báo giá NCC (đã xác nhận)',
    ok: Number(bg?.c ?? 0) > 0,
    note: 'Có báo giá NCC xác nhận',
    link: '/baogia',
  });

  // 4. Phiếu nhập kho vật tư mới -> nhap_xuat loai='nhap' AND sc_id
  const pn = await row<{ c: number }>(
    "SELECT COUNT(*)::int AS c FROM nhap_xuat WHERE loai='nhap' AND sc_id=$1 AND deleted_at=$2",
    [scId, '']
  );
  steps.push({
    step: 4,
    label: 'Phiếu nhập kho vật tư mới',
    ok: Number(pn?.c ?? 0) > 0,
    note: 'Nhập kho liên quan SC',
    link: '/kho/nhap',
  });

  // 5. Phiếu xuất kho cho SC -> nhap_xuat loai='xuat' AND sc_id
  const px = await row<{ c: number }>(
    "SELECT COUNT(*)::int AS c FROM nhap_xuat WHERE loai='xuat' AND sc_id=$1 AND deleted_at=$2",
    [scId, '']
  );
  steps.push({
    step: 5,
    label: 'Phiếu xuất kho cho SC',
    ok: Number(px?.c ?? 0) > 0,
    note: 'Xuất kho cho SC',
    link: '/kho/xuat',
  });

  // 6. Nhập VT cũ/hỏng + thanh lý (không bắt buộc)
  const cu = await row<{ c: number }>(
    "SELECT COUNT(*)::int AS c FROM nhap_xuat WHERE loai='nhap' AND sc_id=$1 AND deleted_at=$2 AND (ly_do ILIKE '%cũ%' OR ly_do ILIKE '%hỏng%' OR ly_do ILIKE '%thanh lý%' OR ly_do ILIKE '%cu_hong%')",
    [scId, '']
  );
  steps.push({
    step: 6,
    label: 'Nhập VT cũ/hỏng + thanh lý (không bắt buộc)',
    ok: true,
    note: Number(cu?.c ?? 0) > 0 ? 'Đã có' : 'Chưa có (không bắt buộc)',
  });

  // 7. Biên bản nghiệm thu -> bien_ban_nghiem
  const nn = await row<{ c: number }>(
    'SELECT COUNT(*)::int AS c FROM bien_ban_nghiem WHERE sc_id=$1 AND deleted_at=$2',
    [scId, '']
  );
  steps.push({
    step: 7,
    label: 'Biên bản nghiệm thu',
    ok: Number(nn?.c ?? 0) > 0,
    note: 'Lưu biên bản nghiệm thu',
    link: 'nn',
  });

  // 8. Bảng kê chi tiết -> sc.tong > 0
  const tongOk = Number(sc.tong ?? 0) > 0;
  steps.push({
    step: 8,
    label: 'Bảng kê chi tiết (tổng > 0)',
    ok: tongOk,
    note: 'Tổng chi phí > 0',
  });

  const blocking = steps.filter((s) => s.step !== 6 && !s.ok);
  const miss = blocking.map((s) => s.label);
  return { ok: blocking.length === 0, steps, miss };
}

export async function keHoachSave(api: Api, p: { sc_id: string; mo_ta?: string }): Promise<{ id: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'sua'))) {
    log.logWarn('keHoachSave: permission denied', { actor: u?.id, role });
    throw new Error('403');
  }
  if (typeof p?.sc_id !== 'string' || !p.sc_id.trim()) {
    log.logWarn('keHoachSave: missing sc_id', { actor: u?.id });
    throw new Error('Thiếu sc_id');
  }
  optionalStr(p?.mo_ta, 'mo_ta');
  const sc = await row('SELECT id FROM sc WHERE id=$1 AND deleted_at=$2', [p.sc_id, '']);
  if (!sc) {
    log.logWarn('keHoachSave: SC not found', { sc_id: p.sc_id, actor: u?.id });
    throw new Error('Không tìm thấy phiếu sửa chữa');
  }
  const isTest = role === 'admin' ? 1 : 0;
  const id = await nextId('KH');
  await run(
    'INSERT INTO ke_hoach_sc (id, sc_id, mo_ta, nguoi_lap, ngay, is_test, deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [id, p.sc_id, p.mo_ta ?? null, u?.id ?? null, new Date().toISOString().slice(0, 10), isTest, '']
  );
  try {
    await logActivity(api.db, {
      actor_id: u?.id, actor_role: role, hanh_dong: 'kehoach_luu',
      doi_tuong: 'ke_hoach_sc', doi_tuong_id: id, sc_id: p.sc_id, mo_ta: 'Lưu kế hoạch SC',
    });
  } catch (e: any) {
    log.logError('keHoachSave: logActivity failed', e, { id, sc_id: p.sc_id });
  }
  log.logInfo('keHoachSave: saved', { sc_id: p.sc_id, id, actor: u?.id });
  return { id };
}

export async function kiemTuSave(api: Api, p: { sc_id: string; mo_ta?: string }): Promise<{ id: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'sua'))) {
    log.logWarn('kiemTuSave: permission denied', { actor: u?.id, role });
    throw new Error('403');
  }
  if (typeof p?.sc_id !== 'string' || !p.sc_id.trim()) {
    log.logWarn('kiemTuSave: missing sc_id', { actor: u?.id });
    throw new Error('Thiếu sc_id');
  }
  optionalStr(p?.mo_ta, 'mo_ta');
  const sc = await row('SELECT id FROM sc WHERE id=$1 AND deleted_at=$2', [p.sc_id, '']);
  if (!sc) {
    log.logWarn('kiemTuSave: SC not found', { sc_id: p.sc_id, actor: u?.id });
    throw new Error('Không tìm thấy phiếu sửa chữa');
  }
  const isTest = role === 'admin' ? 1 : 0;
  const id = await nextId('KT');
  await run(
    'INSERT INTO phieu_kiem_tu (id, sc_id, mo_ta, nguoi_kiem, ngay, is_test, deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [id, p.sc_id, p.mo_ta ?? null, u?.id ?? null, new Date().toISOString().slice(0, 10), isTest, '']
  );
  try {
    await logActivity(api.db, {
      actor_id: u?.id, actor_role: role, hanh_dong: 'kiemtu_luu',
      doi_tuong: 'phieu_kiem_tu', doi_tuong_id: id, sc_id: p.sc_id, mo_ta: 'Lưu phiếu kiểm tu',
    });
  } catch (e: any) {
    log.logError('kiemTuSave: logActivity failed', e, { id, sc_id: p.sc_id });
  }
  log.logInfo('kiemTuSave: saved', { sc_id: p.sc_id, id, actor: u?.id });
  return { id };
}

export async function nghiemThuSave(
  api: Api,
  p: { sc_id: string; ngay_nghiem?: string; tong_vat_tu?: number; tong_nhan_cong?: number }
): Promise<{ id: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'kehoach'))) {
    log.logWarn('nghiemThuSave: permission denied', { actor: u?.id, role });
    throw new Error('403');
  }
  if (typeof p?.sc_id !== 'string' || !p.sc_id.trim()) {
    log.logWarn('nghiemThuSave: missing sc_id', { actor: u?.id });
    throw new Error('Thiếu sc_id');
  }
  optionalStr(p?.ngay_nghiem, 'ngay_nghiem');
  if (p?.tong_vat_tu !== undefined && p?.tong_vat_tu !== null && !Number.isFinite(Number(p.tong_vat_tu))) {
    log.logWarn('nghiemThuSave: invalid tong_vat_tu', { actor: u?.id, sc_id: p.sc_id });
    throw new Error('tong_vat_tu không hợp lệ');
  }
  if (p?.tong_nhan_cong !== undefined && p?.tong_nhan_cong !== null && !Number.isFinite(Number(p.tong_nhan_cong))) {
    log.logWarn('nghiemThuSave: invalid tong_nhan_cong', { actor: u?.id, sc_id: p.sc_id });
    throw new Error('tong_nhan_cong không hợp lệ');
  }
  const sc = await row('SELECT id FROM sc WHERE id=$1 AND deleted_at=$2', [p.sc_id, '']);
  if (!sc) {
    log.logWarn('nghiemThuSave: SC not found', { sc_id: p.sc_id, actor: u?.id });
    throw new Error('Không tìm thấy phiếu sửa chữa');
  }
  const isTest = role === 'admin' ? 1 : 0;
  const id = await nextId('NN');
  await run(
    'INSERT INTO bien_ban_nghiem (id, sc_id, ngay_nghiem, nguoi_nghiem, tong_vat_tu, tong_nhan_cong, is_test, deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, p.sc_id, p.ngay_nghiem ?? null, u?.id ?? null, Number(p.tong_vat_tu) || 0, Number(p.tong_nhan_cong) || 0, isTest, '']
  );
  try {
    await logActivity(api.db, {
      actor_id: u?.id, actor_role: role, hanh_dong: 'nghiemthu_luu',
      doi_tuong: 'bien_ban_nghiem', doi_tuong_id: id, sc_id: p.sc_id, mo_ta: 'Lưu biên bản nghiệm thu',
    });
  } catch (e: any) {
    log.logError('nghiemThuSave: logActivity failed', e, { id, sc_id: p.sc_id });
  }
  log.logInfo('nghiemThuSave: saved', { sc_id: p.sc_id, id, actor: u?.id });
  return { id };
}
