/**
 * perm.ts — Phân quyền GĐ3.6 (CBAC: role × module × feature) + ngưỡng duyệt.
 * Port từ server/perm.js v3.6 — giữ NGUYÊN MATRIX + hành vi.
 * Vai (v5.0, 5 vai lean): admin, giamdoc, xuong, ketoan, kho.
 * Ma trận mặc định gieo vào bảng phan_quyen (có thể chỉnh từ web bởi admin).
 * Mọi hàm async (pg pool).
 */
import type { Db } from './db.js';

export const ROLES = ['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'] as const;
export const MODULES = ['sc', 'kho', 'mua', 'asset', 'xe', 'report', 'help', 'chat', 'de_xuat', 'xuong', 'gd2', 'search', 'ke_toan', 'all', 'baogia', 'hoso', 'dashboard'] as const;
export const FEATURES = ['xem', 'tao', 'sua', 'duy', 'quyet', 'xuat', 'xoa', 'kehoach'] as const;

/* Ma trận mặc định v5.0 (5 vai lean, admin = toàn quyền). */
export const MATRIX: Record<string, Record<string, string[]>> = {
  admin: { all: ['all'] },
  giamdoc: { sc: ['xem'], kho: ['xem'], mua: ['xem'], report: ['xem'], ke_toan: ['xem'], baogia: ['xem'], hoso: ['xem'], search: ['xem'], xe: ['xem'], dashboard: ['xem'] },
  xuong: { sc: ['xem', 'tao', 'sua', 'kehoach'], kho: ['xem'], mua: ['xem'], report: ['xem'], search: ['xem'], xe: ['xem'], baogia: ['xem'], hoso: ['xem'] },
  ketoan: { mua: ['xem', 'tao'], sc: ['xem'], kho: ['xem'], report: ['xem'], ke_toan: ['xem', 'tao', 'vat', 'chi', 'baocao', 'ky', 'quyet'], search: ['xem'], baogia: ['xem'], hoso: ['xem', 'tao', 'sua'], xe: ['xem'] },
  kho: { kho: ['xem', 'tao', 'sua', 'xuat'], mua: ['xem', 'tao'], sc: ['xem'], xe: ['xem'], search: ['xem'], baogia: ['xem'], hoso: ['xem'] },
};

async function insert(db: Db, role: string, m: string, f: string): Promise<void> {
  await db.run(
    'INSERT INTO phan_quyen(role, module, feature) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
    role,
    m,
    f
  );
}

export async function seedPerms(db: Db): Promise<boolean> {
  await db.run('DELETE FROM phan_quyen');
  for (const role of Object.keys(MATRIX)) {
    for (const m of Object.keys(MATRIX[role]!)) {
      for (const f of MATRIX[role]![m]!) {
        await insert(db, role, m, f);
      }
    }
  }
  await insert(db, 'admin', 'all', 'all');
  return true;
}

/** Kiểm tra quyền — đọc ma trận trong DB, hoặc fallback MATRIX mặc định. */
export async function can(db: Db, role: string, m: string, f: string): Promise<boolean> {
  const r = String(role || '').toLowerCase();
  if (r === 'admin') return true;
  const row = await db.row<{ one: number }>(
    'SELECT 1 AS one FROM phan_quyen WHERE role = $1 AND module = $2 AND feature = $3',
    r,
    String(m),
    String(f)
  );
  if (row) return true;
  if (MATRIX[r] && MATRIX[r]![m] && MATRIX[r]![m]!.indexOf(f) >= 0) return true;
  return false;
}

export async function permsOfRole(db: Db, role: string): Promise<Record<string, string[]>> {
  const r = String(role).toLowerCase();
  if (r === 'admin') {
    // admin = toàn quyền: vừa có wildcard 'all' (để tương thích kiểm tra cũ),
    // vừa có đủ từng module/feature để các trang UI check perms['module'].includes('feature') hoạt động.
    const full: Record<string, string[]> = { all: ['all'] };
    for (const m of MODULES) {
      if (m === 'all') continue;
      full[m] = [...FEATURES];
    }
    return full;
  }
  const out: Record<string, string[]> = {};
  const raws = await db.rows<{ module: string; feature: string }>(
    'SELECT module, feature FROM phan_quyen WHERE role = $1 ORDER BY module',
    r
  );
  raws.forEach((x) => {
    (out[x.module] = out[x.module] || []).push(x.feature);
  });
  return out;
}

export async function allPerms(db: Db): Promise<Record<string, Record<string, string[]>>> {
  const out: Record<string, Record<string, string[]>> = {};
  for (const role of ROLES) {
    out[role] = await permsOfRole(db, role);
  }
  return out;
}

export function authName(auth: { currentName(): string }): string {
  try {
    return auth.currentName();
  } catch {
    return '';
  }
}

/** Lưu ma trận phân quyền (admin): changes = [ { role, module, feature, on } ] */
export async function savePerms(
  db: Db,
  changes: Array<{ role: string; module: string; feature: string; on: boolean }>,
  auth: { currentName(): string }
): Promise<{ ok: boolean; n: number; error?: string }> {
  if (!Array.isArray(changes)) return { ok: false, n: 0, error: 'Dữ liệu quyền sai.' };
  let n = 0;
  for (const c of changes) {
    const role = String(c.role || '').toLowerCase();
    if (role === 'admin' || role === 'all' || !c.module || !c.feature) continue;
    if (c.on) {
      await insert(db, role, c.module, c.feature);
      n++;
    } else {
      await db.run('DELETE FROM phan_quyen WHERE role=$1 AND module=$2 AND feature=$3', role, c.module, c.feature);
    }
  }
  await db.audit('perm', 'phan_quyen', '', authName(auth), 'Cập nhật phân quyền (' + n + ' dòng thay đổi)');
  return { ok: true, n };
}

/* ---------------- Ngưỡng duyệt (đơn vị: đồng) ---------------- */
export async function scNguong(db: Db): Promise<number> {
  return Number(await db.configGet('duyet_sc_nguong', '0')) || 0;
}
export async function muaNguong(db: Db): Promise<number> {
  return Number(await db.configGet('duyet_mua_nguong', '0')) || 0;
}

export async function canApproveSC(db: Db, role: string, tong: number): Promise<boolean> {
  const r = String(role).toLowerCase();
  if (r === 'admin' || r === 'giamdoc' || r === 'pttb') return true;
  if (r === 'quanly') return Number(tong) <= (await scNguong(db));
  return false;
}
export async function canApproveMua(db: Db, role: string, tong: number): Promise<boolean> {
  const r = String(role).toLowerCase();
  if (r === 'admin' || r === 'giamdoc' || r === 'pttb') return true;
  if (r === 'ketoan') return Number(tong) <= (await muaNguong(db));
  return false;
}
export function canQuyetToan(role: string): boolean {
  const r = String(role).toLowerCase();
  return r === 'admin' || r === 'ketoan' || r === 'giamdoc' || r === 'quanly';
}

/* ---------------- Handler RPC (GĐ-1.1) ---------------- */
export interface PermApi {
  db: import('./db.js').Db;
  auth: { currentName(): string };
}

/** Ma trận phân quyền đầy đủ cho trang /perm. */
export async function permMatrix(api: PermApi): Promise<{
  roles: readonly string[];
  modules: readonly string[];
  features: readonly string[];
  matrix: Record<string, Record<string, string[]>>;
}> {
  return { roles: ROLES, modules: MODULES, features: FEATURES, matrix: await allPerms(api.db) };
}

/** Lưu thay đổi phân quyền (changes = [{role,module,feature,on}]). */
export async function permSave(
  api: PermApi,
  arg: { changes: Array<{ role: string; module: string; feature: string; on: boolean }> } = {} as any,
): Promise<{ ok: boolean; n: number; error?: string }> {
  const changes = (arg && (arg as { changes?: unknown }).changes) || [];
  return savePerms(api.db, changes as Array<{ role: string; module: string; feature: string; on: boolean }>, api.auth);
}

/** Danh sách vai trò (cho form chọn). */
export async function roleOptions(_api: PermApi): Promise<readonly string[]> {
  return ROLES;
}

/** Ngưỡng duyệt hiện tại. */
export async function thresholds(api: PermApi): Promise<{ sc_nguong: number; mua_nguong: number }> {
  return { sc_nguong: await scNguong(api.db), mua_nguong: await muaNguong(api.db) };
}

/** Cập nhật ngưỡng duyệt (admin). */
export async function thresholdsSet(
  api: PermApi,
  arg: { sc_nguong?: number; mua_nguong?: number } = {} as any,
): Promise<{ ok: boolean }> {
  const a = (arg || {}) as { sc_nguong?: number; mua_nguong?: number };
  if (a.sc_nguong !== undefined) await api.db.configSet('duyet_sc_nguong', String(Number(a.sc_nguong) || 0));
  if (a.mua_nguong !== undefined) await api.db.configSet('duyet_mua_nguong', String(Number(a.mua_nguong) || 0));
  await api.db.audit('update', 'config', 'thresholds', api.auth.currentName(), 'Cập nhật ngưỡng duyệt');
  return { ok: true };
}

export default {
  ROLES,
  MODULES,
  FEATURES,
  MATRIX,
  seedPerms,
  can,
  permsOfRole,
  allPerms,
  savePerms,
  scNguong,
  muaNguong,
  canApproveSC,
  canApproveMua,
  canQuyetToan,
  permMatrix,
  permSave,
  roleOptions,
  thresholds,
  thresholdsSet,
};