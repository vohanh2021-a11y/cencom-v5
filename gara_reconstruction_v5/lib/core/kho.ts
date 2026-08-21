import type { Api } from '../types';
import { row, run, nextId } from '../db';
import { logActivity } from './activity';
import { createScopedLogger } from '../observability';

const log = createScopedLogger('kho');

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

/** Chuỗi khi có cung cấp (field optional) — chặn object/array/type-confusion injection */
function optionalStr(v: any, label: string): void {
  if (v !== undefined && v !== null && v !== '' && typeof v !== 'string') {
    throw new Error(label + ' không hợp lệ');
  }
}

export async function vattuList(api: Api): Promise<any[]> {
  const u = api.auth.current();
  const role = u?.role;
  const r = await api.db.query(
    "SELECT * FROM vattu WHERE deleted_at='' AND is_test=0 ORDER BY ten"
  );
  return r.rows;
}

export async function vattuGet(api: Api, id: string): Promise<any | null> {
  const u = api.auth.current();
  const role = u?.role;
  // Nhất quán với vattuList: không trả về vật tư đã soft-delete
  return row('SELECT * FROM vattu WHERE id=$1 AND deleted_at=$2', [id, '']) ?? null;
}

export async function vattuCreate(
  api: Api,
  p: { ten: string; don_vi?: string; gia?: number; ton_min?: number }
): Promise<{ id: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'kho', 'tao'))) throw new Error('403');
  if (typeof p?.ten !== 'string' || !p.ten.trim()) throw new Error('Thiếu ten');
  optionalStr(p?.don_vi, 'don_vi');
  const isTest = role === 'admin' ? 1 : 0;
  const id = await nextId('VT');
  await run(
    'INSERT INTO vattu (id,ten,don_vi,gia,ton,ton_min,is_test) VALUES ($1,$2,$3,$4,0,$5,$6)',
    [id, p.ten, p.don_vi ?? null, p.gia ?? null, p.ton_min ?? null, isTest]
  );
  try {
    await logActivity(api.db, { actor_id: u?.id, actor_role: role, hanh_dong: 'vattu_tao', doi_tuong: 'vattu', doi_tuong_id: id, is_test: isTest });
  } catch (e) {
    log.logError('logActivity vattu_tao failed', e, { id });
  }
  return { id };
}

export async function nhapKho(
  api: Api,
  p: { vattu_id: string; so_luong: number; don_gia?: number; ngay: string; ly_do?: string }
): Promise<{ id: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'kho', 'tao'))) throw new Error('403');
  if (typeof p?.vattu_id !== 'string' || !p.vattu_id.trim()) throw new Error('Thiếu vattu_id');
  const soLuong = requirePositiveNumber(p?.so_luong, 'so_luong');
  optionalNumber(p?.don_gia, 'don_gia');
  optionalStr(p?.ly_do, 'ly_do');
  if (typeof p?.ngay !== 'string' || !p.ngay.trim()) throw new Error('Thiếu ngay');
  const id = await nextId('NX');
  await run(
    "INSERT INTO nhap_xuat (id,vattu_id,loai,so_luong,don_gia,ngay,ly_do,nguoi,sc_id) VALUES ($1,$2,'nhap',$3,$4,$5,$6,$7,null)",
    [id, p.vattu_id, soLuong, p.don_gia ?? null, p.ngay, p.ly_do ?? null, u?.id ?? null]
  );
  await run('UPDATE vattu SET ton=ton+$2 WHERE id=$1', [p.vattu_id, soLuong]);
  try {
    await logActivity(api.db, { actor_id: u?.id, actor_role: role, hanh_dong: 'kho_nhap', doi_tuong: 'nhap_xuat', doi_tuong_id: id, is_test: role === 'admin' ? 1 : 0 });
  } catch (e) {
    log.logError('logActivity kho_nhap failed', e, { id, vattu_id: p.vattu_id });
  }
  return { id };
}

export async function xuatKho(
  api: Api,
  p: { vattu_id: string; so_luong: number; sc_id?: string; ly_do?: string }
): Promise<{ id: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'kho', 'xuat'))) throw new Error('403');
  if (typeof p?.vattu_id !== 'string' || !p.vattu_id.trim()) throw new Error('Thiếu vattu_id');
  const soLuong = requirePositiveNumber(p?.so_luong, 'so_luong');
  optionalStr(p?.ly_do, 'ly_do');
  const v = await row('SELECT ton FROM vattu WHERE id=$1', [p.vattu_id]);
  if ((v?.ton || 0) < soLuong) throw new Error('Thiếu tồn kho');
  const id = await nextId('NX');
  await run(
    "INSERT INTO nhap_xuat (id,vattu_id,loai,so_luong,sc_id,ly_do,nguoi) VALUES ($1,$2,'xuat',$3,$4,$5,$6)",
    [id, p.vattu_id, soLuong, p.sc_id ?? null, p.ly_do ?? null, u?.id ?? null]
  );
  await run('UPDATE vattu SET ton=ton-$2 WHERE id=$1', [p.vattu_id, soLuong]);
  try {
    await logActivity(api.db, { actor_id: u?.id, actor_role: role, hanh_dong: 'kho_xuat', doi_tuong: 'nhap_xuat', doi_tuong_id: id, sc_id: p.sc_id, is_test: role === 'admin' ? 1 : 0 });
  } catch (e) {
    log.logError('logActivity kho_xuat failed', e, { id, vattu_id: p.vattu_id });
  }
  return { id };
}

export async function dmCreate(
  api: Api,
  p: { sc_id?: string; items: { vattu_id: string; so_luong: number; don_gia?: number }[]; ngay: string }
): Promise<{ id: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'kho', 'tao'))) throw new Error('403');
  if (!Array.isArray(p?.items) || p.items.length === 0) throw new Error('Thiếu items');
  if (typeof p?.ngay !== 'string' || !p.ngay.trim()) throw new Error('Thiếu ngay');
  // Validate từng item TRƯỚC khi ghi DB (tránh dm "mồ côi" khi item giữa danh sách lỗi)
  for (const it of p.items) {
    if (typeof it?.vattu_id !== 'string' || !it.vattu_id.trim()) throw new Error('items: thiếu vattu_id');
    requirePositiveNumber(it?.so_luong, 'items: so_luong');
    optionalNumber(it?.don_gia, 'items: don_gia');
  }
  const isTest = role === 'admin' ? 1 : 0;
  const id = await nextId('DM');
  const tong = p.items.reduce((s, it) => s + it.so_luong * (it.don_gia ?? 0), 0);
  await run(
    "INSERT INTO dm (id,sc_id,trang_thai,nguoi_tao,ngay_tao,tong,is_test) VALUES ($1,$2,'cho_duyet',$3,$4,$5,$6)",
    [id, p.sc_id ?? null, u?.id ?? null, p.ngay, tong, isTest]
  );
  for (const it of p.items) {
    const ctId = await nextId('DMCT');
    await run(
      'INSERT INTO dm_chitiet (id,dm_id,vattu_id,so_luong,don_gia) VALUES ($1,$2,$3,$4,$5)',
      [ctId, id, it.vattu_id, it.so_luong, it.don_gia ?? null]
    );
  }
  try {
    await logActivity(api.db, { actor_id: u?.id, actor_role: role, hanh_dong: 'dm_tao', doi_tuong: 'dm', doi_tuong_id: id, sc_id: p.sc_id, is_test: isTest });
  } catch (e) {
    log.logError('logActivity dm_tao failed', e, { id, sc_id: p.sc_id });
  }
  return { id };
}

export async function dmNhap(api: Api, p: { dm_id: string }): Promise<{ ok: true }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'kho', 'tao'))) throw new Error('403');
  if (typeof p?.dm_id !== 'string' || !p.dm_id.trim()) throw new Error('Thiếu dm_id');
  const rows = (await api.db.query('SELECT vattu_id,so_luong FROM dm_chitiet WHERE dm_id=$1', [p.dm_id])).rows;
  for (const d of rows) {
    await run('UPDATE vattu SET ton=ton+$2 WHERE id=$1', [d.vattu_id, d.so_luong]);
  }
  await run("UPDATE dm SET trang_thai='da_nhap' WHERE id=$1", [p.dm_id]);
  try {
    await logActivity(api.db, { actor_id: u?.id, actor_role: role, hanh_dong: 'dm_nhap', doi_tuong: 'dm', doi_tuong_id: p.dm_id, is_test: role === 'admin' ? 1 : 0 });
  } catch (e) {
    log.logError('logActivity dm_nhap failed', e, { dm_id: p.dm_id });
  }
  return { ok: true };
}
