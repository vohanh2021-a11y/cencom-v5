import type { Api } from '../types';
import { row, run, nextId } from '../db';
import { logActivity } from './activity';

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

export async function xeList(api: Api, filter: { limit?: unknown; offset?: unknown } = {}): Promise<any[]> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'xe', 'xem'))) throw new Error('Không đủ quyền');
  // GĐ6 phân trang (pattern scList): default 2.000, clamped, tie-breaker id.
  let limit = Math.floor(Number(filter?.limit));
  if (!Number.isFinite(limit) || limit < 1) limit = 2000;
  if (limit > 20000) limit = 20000;
  let offset = Math.floor(Number(filter?.offset));
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  const params: any[] = ['', 0];
  const r = await api.db.query(
    'SELECT * FROM xe WHERE deleted_at=$1 AND is_test=$2 ORDER BY bien_so, id LIMIT $' +
      params.push(limit) +
      ' OFFSET $' +
      params.push(offset),
    params
  );
  return r.rows;
}

export async function xeGet(api: Api, id: string): Promise<any | null> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'xe', 'xem'))) throw new Error('Không đủ quyền');
  return row('SELECT * FROM xe WHERE id=$1 AND deleted_at=$2', [id, '']);
}

export async function xeCreate(
  api: Api,
  p: { bien_so: string; chu_xe?: string; nam_sx?: number; nguyen_gia?: number }
): Promise<{ id: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'xe', 'tao'))) throw new Error('Không đủ quyền');
  // Input validation: bien_so bắt buộc (trước đây chỉ bị chặn bởi NOT NULL của DB)
  const bienSo = requireStr(p?.bien_so, 'bien_so');
  optionalStr(p?.chu_xe, 'chu_xe');
  if (
    p?.nam_sx !== undefined && p.nam_sx !== null &&
    (!Number.isFinite(Number(p.nam_sx)) || Number(p.nam_sx) < 1900 || Number(p.nam_sx) > 2100)
  ) {
    throw new Error('nam_sx không hợp lệ');
  }
  if (p?.nguyen_gia !== undefined && p.nguyen_gia !== null && !Number.isFinite(Number(p.nguyen_gia))) {
    throw new Error('nguyen_gia không hợp lệ');
  }
  const isTest = role === 'admin' ? 1 : 0;
  const id = await nextId('XE');
  await run(
    'INSERT INTO xe (id, bien_so, chu_xe, nam_sx, nguyen_gia, is_test, deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [id, bienSo, p.chu_xe ?? null, p.nam_sx ?? null, p.nguyen_gia ?? null, isTest, '']
  );
  try {
    await logActivity(api.db, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'xe_tao',
      doi_tuong: 'xe',
      doi_tuong_id: id,
      mo_ta: 'Tạo xe',
    });
  } catch (_) {}
  return { id };
}
