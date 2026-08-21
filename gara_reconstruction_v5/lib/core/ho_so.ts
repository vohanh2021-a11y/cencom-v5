import type { Api } from '../types';
import { row, run, nextId } from '../db';
import { logActivity } from './activity';

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
  if (!(await api.perm.can(api.db, role!, 'hoso', 'tao'))) throw new Error('403');
  if (typeof p?.sc_id !== 'string' || !p.sc_id.trim()) throw new Error('Thiếu sc_id');
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
  } catch (_) {}
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
