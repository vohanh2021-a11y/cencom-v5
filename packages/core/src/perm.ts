/**
 * perm.ts — Phân quyền GĐ3.6 (CBAC: role × module × feature) + ngưỡng duyệt.
 * Port từ server/perm.js v3.6 — giữ NGUYÊN MATRIX + hành vi.
 * Vai: tho, khoa, ketoan, quanly, giamdoc, xuong, laixe, admin.
 * Ma trận mặc định gieo vào bảng phan_quyen (có thể chỉnh từ web bởi admin).
 * Mọi hàm async (pg pool).
 */
import type { Db } from './db.js';

export const ROLES = ['tho', 'khoa', 'ketoan', 'quanly', 'giamdoc', 'xuong', 'admin'] as const;
export const MODULES = ['sc', 'kho', 'mua', 'asset', 'xe', 'report', 'help', 'chat', 'de_xuat', 'xuong', 'gd2', 'all'] as const;
export const FEATURES = ['xem', 'tao', 'sua', 'duy', 'quyet', 'xuat', 'xoa', 'kehoach'] as const;

/* Ma trận mặc định (admin = toàn quyền). */
export const MATRIX: Record<string, Record<string, string[]>> = {
  tho: { sc: ['xem', 'tao', 'sua'], asset: ['xem'], kho: ['xem'], xe: ['xem'], report: ['xem'], chat: ['xem', 'tao', 'sua'], gd2: ['xem', 'tao', 'sua'] },
  khoa: { kho: ['xem', 'tao', 'sua', 'xuat'], mua: ['xem', 'tao'], sc: ['xem'], xe: ['xem'], chat: ['xem', 'tao', 'sua'], gd2: ['xem'] },
  ketoan: { mua: ['xem', 'tao', 'duy'], asset: ['xem', 'quyet'], sc: ['xem', 'tao', 'kehoach'], kho: ['xem'], xe: ['xem'], report: ['xem'], chat: ['xem', 'tao', 'sua'], gd2: ['xem'] },
  quanly: { sc: ['xem', 'duy', 'kehoach'], asset: ['xem', 'quyet'], kho: ['xem'], mua: ['xem'], xe: ['xem'], report: ['xem'], chat: ['xem', 'tao', 'sua'], de_xuat: ['xem', 'duy'], xuong: ['xem'], gd2: ['xem', 'tao', 'sua'] },
  giamdoc: { sc: ['xem', 'duy', 'kehoach'], asset: ['xem', 'duy'], kho: ['xem'], mua: ['xem', 'duy'], xe: ['xem'], report: ['xem'], chat: ['xem', 'tao', 'sua'], de_xuat: ['xem', 'duy'], xuong: ['xem'], gd2: ['xem', 'tao', 'sua'] },
  xuong: { de_xuat: ['xem', 'tao', 'sua'], xuong: ['xem'], sc: ['xem', 'tao', 'sua', 'kehoach'], asset: ['xem'], kho: ['xem'], xe: ['xem'], report: ['xem'], chat: ['xem', 'tao', 'sua'], gd2: ['xem', 'tao', 'sua'] },
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
  if (r === 'admin') return { all: ['all'] };
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
  if (r === 'admin' || r === 'giamdoc') return true;
  if (r === 'quanly') return Number(tong) <= (await scNguong(db));
  return false;
}
export async function canApproveMua(db: Db, role: string, tong: number): Promise<boolean> {
  const r = String(role).toLowerCase();
  if (r === 'admin' || r === 'giamdoc') return true;
  if (r === 'ketoan') return Number(tong) <= (await muaNguong(db));
  return false;
}
export function canQuyetToan(role: string): boolean {
  const r = String(role).toLowerCase();
  return r === 'admin' || r === 'ketoan' || r === 'giamdoc' || r === 'quanly';
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
};