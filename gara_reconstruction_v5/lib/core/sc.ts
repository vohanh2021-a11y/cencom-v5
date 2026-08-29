import type { Api } from '../types';
import { row, run, nextId } from '../db';
import { logActivity } from './activity';
import { checkHoSo } from './ho_so';
import { createScopedLogger } from '../observability';

const log = createScopedLogger('sc');

// Enum trạng thái phiếu sửa chữa (db/schema.sql CHECK)
const TT = ['de_xuat', 'dang_sua', 'da_hoan', 'da_quyet', 'tu_choi'];
// Loại xử lý hợp lệ (db/schema.sql sc_congviec CHECK)
const LOAI_XU_LY = ['thay_moi', 'sua_chua', 'bao_duong', 'khac'];
// Chỉ admin/ketoan được quyết toán (v3.6 perm.canQuyetToan() — v5 đã siết khỏi giamdoc/xuong)
const QUYET_TOAN_ROLES = ['ketoan', 'admin'];

function requireStr(v: any, label: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new Error('Thiếu ' + label);
  return v.trim();
}

/** Chuỗi khi có cung cấp (field optional) — chặn object/array/type-confusion injection */
function optionalStr(v: any, label: string): void {
  if (v !== undefined && v !== null && v !== '' && typeof v !== 'string') {
    throw new Error(label + ' không hợp lệ');
  }
}

/** Số dương hợp lệ (number hoặc numeric string) — chặn NaN/Infinity/âm/0/rỗng */
function requirePositiveNumber(v: any, label: string): number {
  const n = Number(v);
  if (!v || !Number.isFinite(n) || n <= 0) throw new Error('Thiếu ' + label);
  return n;
}

/** Số hợp lệ khi có cung cấp (field optional) — chặn NaN/Infinity */
function optionalNumber(v: any, label: string): void {
  if (v !== undefined && v !== null && v !== '' && !Number.isFinite(Number(v))) {
    throw new Error(label + ' không hợp lệ');
  }
}

async function getSc(api: Api, id: string): Promise<any> {
  const r = await row('SELECT * FROM sc WHERE id=$1 AND deleted_at=$2', [id, '']);
  if (!r) throw new Error('Không tìm thấy phiếu sửa chữa');
  return r;
}

export async function scList(api: Api, filter?: { trang_thai?: string }): Promise<any[]> {
  const u = api.auth.current();
  const role = u?.role;
  if (filter?.trang_thai !== undefined && filter.trang_thai !== '' && !TT.includes(filter.trang_thai)) {
    throw new Error('Trạng thái không hợp lệ');
  }
  let sql = 'SELECT * FROM sc WHERE deleted_at=$1';
  const params: any[] = [''];
  if (filter?.trang_thai) {
    sql += ' AND trang_thai=$2';
    params.push(filter.trang_thai);
  }
  if (role !== 'giamdoc' && role !== 'admin') {
    sql += ' AND is_test=0';
  }
  sql += ' ORDER BY ngay_tao DESC';
  const r = await api.db.query(sql, params);
  return r.rows;
}

export async function scGet(api: Api, id: string): Promise<any> {
  const u = api.auth.current();
  const role = u?.role;
  if (role) {
    // v3.6 sc.js scGet(): chỉ checkLock('sc','xem') — mọi role có quyền xem đều xem được mọi SC,
    // không phân biệt sở hữu (người tạo). Giữ NGUYÊN quy tắc này.
    if (!(await api.perm.can(api.db, role, 'sc', 'xem'))) throw new Error('403');
  }
  const r = await row('SELECT * FROM sc WHERE id=$1 AND deleted_at=$2', [id, '']);
  if (!r) throw new Error('Không tìm thấy phiếu sửa chữa');
  return r;
}

export async function scCreate(api: Api, p: { xe_id: string; ngay: string }): Promise<{ id: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'tao'))) throw new Error('403');
  const xeId = requireStr(p?.xe_id, 'xe_id');
  const ngay = requireStr(p?.ngay, 'ngay');
  const xe = await row('SELECT id FROM xe WHERE id=$1 AND deleted_at=$2', [xeId, '']);
  if (!xe) throw new Error('Không tìm thấy xe');
  const isTest = role === 'admin' ? 1 : 0;
  const id = await nextId('SC');
  await run(
    'INSERT INTO sc (id, xe_id, ngay_tao, nguoi_tao, trang_thai, is_test, deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [id, xeId, ngay, u?.id, 'de_xuat', isTest, '']
  );
  try {
    await logActivity(api.db, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'sc_tao',
      doi_tuong: 'sc',
      doi_tuong_id: id,
      sc_id: id,
      mo_ta: 'Tạo phiếu sửa chữa',
    });
  } catch (e: any) {
    log.logError('scCreate: logActivity failed', e, { id, sc_id: id });
  }
  return { id };
}

export async function scAddCongViec(
  api: Api,
  p: { sc_id: string; mo_ta: string; nguyen_nhan?: string; loai_xu_ly?: string; so_luong?: number; don_gia?: number }
): Promise<{ id: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'sua'))) throw new Error('403');
  const scId = requireStr(p?.sc_id, 'sc_id');
  const moTa = requireStr(p?.mo_ta, 'mo_ta');
  if (p?.loai_xu_ly !== undefined && p.loai_xu_ly !== null && p.loai_xu_ly !== '' && !LOAI_XU_LY.includes(p.loai_xu_ly)) {
    throw new Error('Loại xử lý không hợp lệ');
  }
  optionalStr(p?.nguyen_nhan, 'nguyen_nhan');
  optionalNumber(p?.so_luong, 'so_luong');
  optionalNumber(p?.don_gia, 'don_gia');
  await getSc(api, scId);
  const id = await nextId('CV');
  const r = await row<{ c: number }>('SELECT COUNT(*)::int AS c FROM sc_congviec WHERE sc_id=$1', [scId]);
  const stt = (r?.c ?? 0) + 1;
  await run(
    'INSERT INTO sc_congviec (id, sc_id, stt, mo_ta, nguyen_nhan, loai_xu_ly, so_luong, don_gia) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, scId, stt, moTa, p.nguyen_nhan ?? null, p.loai_xu_ly ?? null, p.so_luong ?? null, p.don_gia ?? null]
  );
  try {
    await logActivity(api.db, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'sc_them_cv',
      doi_tuong: 'sc',
      doi_tuong_id: scId,
      sc_id: scId,
      mo_ta: 'Thêm công việc',
    });
  } catch (e: any) {
    log.logError('scAddCongViec: logActivity failed', e, { id: scId, sc_id: scId });
  }
  return { id };
}

export async function scAddVatTu(
  api: Api,
  p: { sc_id: string; vattu_id: string; so_luong: number }
): Promise<{ id: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'sua'))) throw new Error('403');
  const scId = requireStr(p?.sc_id, 'sc_id');
  const vattuId = requireStr(p?.vattu_id, 'vattu_id');
  const soLuong = requirePositiveNumber(p?.so_luong, 'so_luong');
  await getSc(api, scId);
  const id = await nextId('VT');
  await run(
    'INSERT INTO sc_vattu (id, sc_id, vattu_id, so_luong) VALUES ($1,$2,$3,$4)',
    [id, scId, vattuId, soLuong]
  );
  try {
    await logActivity(api.db, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'sc_them_vt',
      doi_tuong: 'sc',
      doi_tuong_id: scId,
      sc_id: scId,
      mo_ta: 'Thêm vật tư',
    });
  } catch (e: any) {
    log.logError('scAddVatTu: logActivity failed', e, { id: scId, sc_id: scId });
  }
  return { id };
}

export async function scBatDauSua(api: Api, p: { sc_id: string }): Promise<{ ok: true }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'sua'))) throw new Error('403');
  const scId = requireStr(p?.sc_id, 'sc_id');
  const sc = await getSc(api, scId);
  if (sc.trang_thai !== 'de_xuat') {
    throw new Error('Không thể bắt đầu sửa khi phiếu đang ' + sc.trang_thai);
  }
  await run('UPDATE sc SET trang_thai=$1 WHERE id=$2 AND deleted_at=$3', ['dang_sua', scId, '']);
  try {
    await logActivity(api.db, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'sc_bat_dau_sua',
      doi_tuong: 'sc',
      doi_tuong_id: scId,
      sc_id: scId,
      mo_ta: 'Bắt đầu sửa',
    });
  } catch (e: any) {
    log.logError('scBatDauSua: logActivity failed', e, { sc_id: scId });
  }
  return { ok: true };
}

export async function scHoanThanh(api: Api, p: { sc_id: string }): Promise<{ ok: true }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'sua'))) throw new Error('403');
  const scId = requireStr(p?.sc_id, 'sc_id');
  const sc = await getSc(api, scId);
  if (sc.trang_thai !== 'dang_sua') {
    throw new Error('Chưa bắt đầu sửa — không thể hoàn thành');
  }
  await run('UPDATE sc SET trang_thai=$1 WHERE id=$2 AND deleted_at=$3', ['da_hoan', scId, '']);
  try {
    await logActivity(api.db, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'sc_hoan_thanh',
      doi_tuong: 'sc',
      doi_tuong_id: scId,
      sc_id: scId,
      mo_ta: 'Hoàn thành sửa chữa',
    });
  } catch (e: any) {
    log.logError('scHoanThanh: logActivity failed', e, { sc_id: scId });
  }
  return { ok: true };
}

export async function scTuChoi(api: Api, p: { sc_id: string; ly_do: string }): Promise<{ ok: true }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'sua'))) throw new Error('403');
  const scId = requireStr(p?.sc_id, 'sc_id');
  const sc = await getSc(api, scId);
  // v3.6 sc.js scApprove('tu_choi'): chỉ từ chối khi phiếu đang 'de_xuat'
  if (sc.trang_thai !== 'de_xuat') {
    throw new Error('Không thể từ chối khi phiếu đang ' + sc.trang_thai);
  }
  optionalStr(p?.ly_do, 'ly_do');
  await run('UPDATE sc SET trang_thai=$1 WHERE id=$2 AND deleted_at=$3', ['tu_choi', scId, '']);
  try {
    await logActivity(api.db, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'sc_tu_choi',
      doi_tuong: 'sc',
      doi_tuong_id: scId,
      sc_id: scId,
      mo_ta: 'Từ chối: ' + (p.ly_do ?? ''),
    });
  } catch (e: any) {
    log.logError('scTuChoi: logActivity failed', e, { sc_id: scId });
  }
  return { ok: true };
}

export async function scQuyetToan(api: Api, p: { sc_id: string }): Promise<{ ok: true }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'kehoach'))) {
    log.logWarn('scQuyetToan: permission denied (rbac)', { actor: u?.id, role });
    throw new Error('403');
  }
  // v3.6 perm.canQuyetToan(): admin/ketoan (+giamdoc/quanly) — v5 MATRIX đã siết còn ketoan (admin bypass),
  // security.test.ts yêu cầu giamdoc DENY → chỉ cho ketoan/admin.
  if (role !== 'ketoan' && role !== 'admin') {
    log.logWarn('scQuyetToan: role not allowed', { actor: u?.id, role });
    throw new Error('403');
  }
  const scId = requireStr(p?.sc_id, 'sc_id');
  const sc = await getSc(api, scId);
  // Gate hồ sơ 8 bước: chặn quyết toán khi thiếu bất kỳ bước bắt buộc nào
  const hs = await checkHoSo(api, scId);
  if (!hs.ok) {
    log.logWarn('scQuyetToan: incomplete ho so', { sc_id: scId, miss: hs.miss, actor: u?.id });
    throw new Error('Không thể quyết toán — thiếu hồ sơ: ' + hs.miss.join(', '));
  }
  if (sc.trang_thai !== 'da_hoan') {
    log.logWarn('scQuyetToan: invalid trang_thai', { sc_id: scId, trang_thai: sc.trang_thai, actor: u?.id });
    throw new Error('Chỉ quyết toán khi phiếu đã hoàn thành');
  }
  await run('UPDATE sc SET trang_thai=$1 WHERE id=$2 AND deleted_at=$3', ['da_quyet', scId, '']);
  try {
    await logActivity(api.db, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'sc_quyet_toan',
      doi_tuong: 'sc',
      doi_tuong_id: scId,
      sc_id: scId,
      mo_ta: 'Quyết toán',
    });
  } catch (e: any) {
    log.logError('scQuyetToan: logActivity failed', e, { sc_id: scId });
  }
  log.logInfo('scQuyetToan: success', { sc_id: scId, actor: u?.id });
  return { ok: true };
}