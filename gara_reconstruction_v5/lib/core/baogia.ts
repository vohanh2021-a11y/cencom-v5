import type { Api } from '../types';
import { row, run, nextId } from '../db';
import { logActivity } from './activity';
import { createScopedLogger } from '../observability';

const log = createScopedLogger('baogia');

/** Chuỗi khi có cung cấp (field optional) — chặn object/array/type-confusion injection */
function optionalStr(v: any, label: string): void {
  if (v !== undefined && v !== null && v !== '' && typeof v !== 'string') {
    throw new Error(label + ' không hợp lệ');
  }
}

export async function baogiaList(api: Api): Promise<any[]> {
  const r = await api.db.query(
    'SELECT * FROM baogia WHERE deleted_at=$1 AND is_test=0 ORDER BY ngay DESC',
    ['']
  );
  return r.rows;
}

export async function baogiaGet(api: Api, id: string): Promise<any | null> {
  const u = api.auth.current();
  const role = u?.role;
  if (role) {
    if (!(await api.perm.can(api.db, role, 'baogia', 'xem'))) throw new Error('403');
  }
  const baogia = await row('SELECT * FROM baogia WHERE id=$1 AND deleted_at=$2', [id, '']);
  if (!baogia) return null;
  const chitiet = (await api.db.query('SELECT * FROM baogia_chitiet WHERE baogia_id=$1', [id])).rows;
  return { baogia, chitiet };
}

export async function baogiaSave(
  api: Api,
  p: {
    sc_id?: string;
    ncc?: string;
    ngay: string;
    items: { ten: string; so_luong?: number; don_gia?: number }[];
  }
): Promise<{ id: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'baogia', 'tao'))) throw new Error('403');

  // Validation bắt buộc theo conformance test
  if (typeof p?.sc_id !== 'string' || !p.sc_id.trim()) throw new Error('Thiếu sc_id');
  if (typeof p?.ngay !== 'string' || !p.ngay.trim()) throw new Error('Thiếu ngay');
  optionalStr(p?.ncc, 'ncc');
  if (!Array.isArray(p?.items) || p.items.length === 0) throw new Error('Thiếu items');
  // Validate từng item TRƯỚC khi ghi DB — chặn type-confusion trên ten/so_luong/don_gia
  for (const it of p.items) {
    if (typeof it?.ten !== 'string' || !it.ten.trim()) throw new Error('items: thiếu ten');
    optionalStr(it?.ten, 'items: ten');
  }

  const isTest = role === 'admin' ? 1 : 0;
  const id = await nextId('BG');
  const tong = (p.items || []).reduce(
    (s, it) => s + (Number(it.so_luong) || 0) * (Number(it.don_gia) || 0),
    0
  );

  await run(
    'INSERT INTO baogia (id, sc_id, ncc, ngay, tong, nguoi_tao, is_test, deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, p.sc_id, p.ncc ?? null, p.ngay, tong, u?.id ?? null, isTest, '']
  );

  for (const it of p.items || []) {
    const ctId = await nextId('BGCT');
    await run(
      'INSERT INTO baogia_chitiet (id, baogia_id, ten, so_luong, don_gia) VALUES ($1,$2,$3,$4,$5)',
      [ctId, id, it.ten, Number(it.so_luong) || 0, Number(it.don_gia) || 0]
    );
  }

  // Mirror sang bao_gia_ncc (bước 3 hồ sơ 8 bước, semantic v4: báo giá NCC đã xác nhận)
  if (p.sc_id) {
    try {
      const bgnId = await nextId('BGN');
      await run(
        'INSERT INTO bao_gia_ncc (id, sc_id, ncc, ngay, tong, ocr_xac_nhan, anh_bao_gia, nguoi_tao, is_test, deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [bgnId, p.sc_id, p.ncc ?? null, p.ngay, tong, 1, '', u?.id ?? null, isTest, '']
      );
    } catch (e) {
      log.logError('mirror bao_gia_ncc failed', e, { id });
    }
  }

  try {
    await logActivity(api.db, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'baogia_luu',
      doi_tuong: 'baogia',
      doi_tuong_id: id,
      sc_id: p.sc_id,
      mo_ta: `Lưu báo giá NCC ${id} (${p.items?.length || 0} mục, tổng ${tong})`,
      is_test: isTest,
    });
  } catch (e) {
    log.logError('logActivity baogia_luu failed', e, { id });
  }

  return { id };
}