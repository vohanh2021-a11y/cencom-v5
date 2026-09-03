/**
 * khachhang.ts — Quản lý khách hàng / chủ xe / NCC (GĐ-4).
 * Port từ draft v4 (packages/core/src/khachhang.ts) — GIỮ NGUYÊN hành vi
 * nghiệp vụ (kiểm tra đăng nhập, validate ten, whitelist field, soft delete
 * deleted_at='x', id KH-000001 qua nextId, audit moi lan ghi).
 * Adapt theo convention v5:
 *  - Api type + helper row/run/nextId (lib/db.ts thay vi Db method cua v4)
 *  - db.audit (v4) -> logActivity vào activity_log (v5)
 *  - paginate/normPage cua packages/core/list.js KHONG ton tai o v5 ->
 *    tu chon trang voi clamp page>=1, limit 1..200 (pattern activityFeed/kho)
 *  - Kiem tra dang nhap van giu TRONG core (fail-closed cho caller truc tiep,
 *    du dispatch cua lib/rpc.ts da check '401' truoc) — port nguyen v4.
 * LUU Y QUYEN: MATRIX v5 (lib/perm.ts) chua cap module 'khachhang' cho vai nao
 * (admin bypass qua can()). Khi dang ky vao lib/rpc.ts (ngoai pham vi file nay),
 * chon chuoi META that han — de ['khach_hang','xem']/'tao'/'xoa' thi chi admin
 * goi duoc; muon mo rong phai them MATRIX co chu dich.
 */
import type { Api } from '../types';
import { row, run, nextId } from '../db';
import { logActivity } from './activity';

/** Field whitelist — ten cot duoc derive TU DONG tu map nay.
 *  CAM them field not duoc cung cap boi client (IDOR/column-injection). */
const EDITABLE_FIELDS = {
  ten: 'string',
  sdt: 'string',
  dia_chi: 'string',
  email: 'string',
  ma_so_thue: 'string',
  la_ncc: 'boolean',
  ghi_chu: 'string',
} as const;
type FieldName = keyof typeof EDITABLE_FIELDS;

interface KhachHangInput {
  id?: string;
  ten?: unknown;
  sdt?: unknown;
  dia_chi?: unknown;
  email?: unknown;
  ma_so_thue?: unknown;
  la_ncc?: unknown;
  ghi_chu?: unknown;
}

/** Chuỗi khi có cung cấp — chặn object/array/type-confusion injection (pattern xe/baogia) */
function optionalStr(v: unknown, label: string): void {
  if (v !== undefined && v !== null && typeof v !== 'string') {
    throw new Error(label + ' không hợp lệ');
  }
}

export interface KhachHangListResult {
  result: any[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export async function khachHangList(
  api: Api,
  q: { q?: unknown; page?: unknown; limit?: unknown } = {}
): Promise<KhachHangListResult> {
  const u = api.auth.current();
  if (!u) throw new Error('401');
  if (q.q !== undefined && q.q !== null && typeof q.q !== 'string') {
    throw new Error('q không hợp lệ');
  }
  const params: unknown[] = [];
  let where = " WHERE deleted_at=''";
  if (q.q) {
    const like = '%' + String(q.q).toUpperCase() + '%';
    where += ' AND (upper(ten) LIKE $1 OR upper(sdt) LIKE $1 OR upper(ma_so_thue) LIKE $1)';
    params.push(like);
  }
  const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200);
  const rawPage = Math.max(1, Math.trunc(Number(q.page) || 1));
  const offset = (rawPage - 1) * limit;
  const [cnt, rows] = await Promise.all([
    api.db.query('SELECT COUNT(*)::int AS total FROM khach_hang' + where, params),
    api.db.query(
      'SELECT * FROM khach_hang' + where +
      ' ORDER BY ten ASC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2),
      [...params, limit, offset]
    ),
  ]);
  const total = Number(cnt.rows[0]?.total ?? cnt.rows[0]?.count ?? 0) || 0;
  return { result: rows.rows, total, page: rawPage, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function khachHangGet(api: Api, id: string): Promise<any | null> {
  const u = api.auth.current();
  if (!u) throw new Error('401');
  return (await row<any>('SELECT * FROM khach_hang WHERE id=$1 AND deleted_at=$2', [String(id), ''])) || null;
}

export async function khachHangSave(
  api: Api,
  rec: KhachHangInput = {}
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const u = api.auth.current();
  if (!u) return { ok: false, error: 'Chưa đăng nhập.' };
  const ten = String(rec.ten ?? '').trim();
  if (!ten) return { ok: false, error: 'Thiếu tên khách hàng.' };
  const id = String(rec.id ?? '').trim();
  for (const key of Object.keys(EDITABLE_FIELDS) as FieldName[]) {
    if (EDITABLE_FIELDS[key] === 'string') optionalStr((rec as any)[key], key);
  }
  if (rec.la_ncc !== undefined && rec.la_ncc !== null && typeof rec.la_ncc !== 'boolean') {
    return { ok: false, error: 'la_ncc không hợp lệ' };
  }
  const fields: Record<FieldName, string | boolean> = {
    ten,
    sdt: String(rec.sdt ?? '').trim(),
    dia_chi: String(rec.dia_chi ?? '').trim(),
    email: String(rec.email ?? '').trim(),
    ma_so_thue: String(rec.ma_so_thue ?? '').trim(),
    la_ncc: !!rec.la_ncc,
    ghi_chu: String(rec.ghi_chu ?? '').trim(),
  };
  const cols = Object.keys(fields) as FieldName[];
  if (id) {
    const set = cols.map((c, i) => c + '=$' + (i + 1)).join(', ');
    await run('UPDATE khach_hang SET ' + set + ' WHERE id=$' + (cols.length + 1), [...cols.map((c) => fields[c]), id]);
    await logActivity(api.db, {
      actor_id: u.id, actor_role: u.role, hanh_dong: 'khach_hang_sua',
      doi_tuong: 'khach_hang', doi_tuong_id: id, mo_ta: 'Cập nhật khách hàng ' + ten,
    });
    return { ok: true, id };
  }
  const newId = await nextId('KH');
  await run(
    'INSERT INTO khach_hang (id, ' + cols.join(', ') + ", deleted_at) VALUES ($1," +
    cols.map((_, i) => '$' + (i + 2)).join(',') + ',$' + (cols.length + 2) + ')',
    [newId, ...cols.map((c) => fields[c]), '']
  );
  await logActivity(api.db, {
    actor_id: u.id, actor_role: u.role, hanh_dong: 'khach_hang_tao',
    doi_tuong: 'khach_hang', doi_tuong_id: newId, mo_ta: 'Tạo khách hàng ' + ten,
  });
  return { ok: true, id: newId };
}

export async function khachHangDel(api: Api, id: string): Promise<{ ok: boolean; error?: string }> {
  const u = api.auth.current();
  if (!u) return { ok: false, error: 'Chưa đăng nhập.' };
  await run("UPDATE khach_hang SET deleted_at='x' WHERE id=$1", [String(id)]);
  await logActivity(api.db, {
    actor_id: u.id, actor_role: u.role, hanh_dong: 'khach_hang_xoa',
    doi_tuong: 'khach_hang', doi_tuong_id: String(id), mo_ta: 'Xóa khách hàng ' + String(id),
  });
  return { ok: true };
}
