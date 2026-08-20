/**
 * xe.ts — Hồ sơ xe & nhắc hạn (GĐ-4). Quản lý đăng ký / bảo hiểm / đăng kiểm.
 * Clone logic từ v3.6 (server/asset.js / db xe) — GIỮ NGUYÊN hành vi.
 */
'use strict';

import type { Db } from './db.js';
import { paginate, normPage } from './list.js';

export interface XeApi {
  db: Db;
  auth: { current(): { id: string; name?: string; role: string; username?: string } | null };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cleanDate(v: unknown): string {
  const s = String(v || '').trim();
  return DATE_RE.test(s) ? s : '';
}

export async function xeList(
  api: XeApi,
  q: { q?: string; phong_ban?: string; page?: unknown; limit?: unknown } = {}
): Promise<any[] & { total: number; page: number; limit: number; pages: number }> {
  const u = api.auth.current();
  if (!u) throw new Error('Chưa đăng nhập.');
  const a: unknown[] = [];
  let where = " WHERE deleted_at=''";
  if (q.q) {
    const like = '%' + String(q.q).toUpperCase() + '%';
    where += ' AND (upper(bks) LIKE $1 OR upper(hang) LIKE $1 OR upper(dong) LIKE $1 OR upper(chu_xe) LIKE $1)';
    a.push(like);
  }
  if (q.phong_ban) { where += ' AND phong_ban=$' + (a.length + 1); a.push(q.phong_ban); }
  const { page, limit } = normPage(q);
  const rows = await paginate<any>(
    api.db, 'SELECT * FROM xe t', where, a, 'ORDER BY bks ASC', page, limit, 'xe t'
  );
  (rows as any).total = rows.total;
  return rows as any;
}

export async function xeGet(api: XeApi, key: string): Promise<any | null> {
  const u = api.auth.current();
  if (!u) throw new Error('Chưa đăng nhập.');
  const k = String(key || '').trim();
  if (!k) return null;
  return (await api.db.row<any>(
    'SELECT * FROM xe WHERE (bks=$1 OR id=$1) AND deleted_at=$2', k, ''
  )) || null;
}

export async function xeSave(
  api: XeApi,
  rec: {
    id?: string; bks?: string; bien_so_cu?: string; hang?: string; dong?: string;
    nam_sx?: number; lai_xe?: string; phong_ban?: string; trang_thai?: string;
    loai_pt?: string; ghi_chu?: string; nguyen_gia?: number; chu_xe?: string;
    khach_hang_id?: string; so_khung?: string; so_may?: string;
    ngay_dang_ky?: string; han_dang_kiem?: string; ngay_dang_kiem?: string;
    han_bao_hiem?: string; ngay_bao_hiem?: string;
  } = {}
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const u = api.auth.current();
  if (!u) return { ok: false, error: 'Chưa đăng nhập.' };
  const bks = String(rec.bks || '').trim().toUpperCase();
  if (!bks) return { ok: false, error: 'Thiếu biển số.' };
  const id = String(rec.id || '').trim();
  const exists = id ? await api.db.row<any>('SELECT id FROM xe WHERE id=$1 AND deleted_at=$2', id, '') : null;
  if (!exists) {
    const dup = await api.db.row<any>('SELECT id FROM xe WHERE bks=$1 AND deleted_at=$2', bks, '');
    if (dup) return { ok: false, error: 'Biển số ' + bks + ' đã tồn tại.' };
  }
  const fields = {
    bks,
    bien_so_cu: String(rec.bien_so_cu || '').trim(),
    hang: String(rec.hang || '').trim(),
    dong: String(rec.dong || '').trim(),
    nam_sx: Number(rec.nam_sx) || null,
    lai_xe: String(rec.lai_xe || '').trim(),
    phong_ban: String(rec.phong_ban || '').trim(),
    trang_thai: String(rec.trang_thai || 'dang_hoat_dong').trim(),
    loai_pt: String(rec.loai_pt || 'dau_keo').trim(),
    ghi_chu: String(rec.ghi_chu || '').trim(),
    nguyen_gia: Number(rec.nguyen_gia) || 0,
    chu_xe: String(rec.chu_xe || '').trim(),
    khach_hang_id: String(rec.khach_hang_id || '').trim(),
    so_khung: String(rec.so_khung || '').trim(),
    so_may: String(rec.so_may || '').trim(),
    ngay_dang_ky: cleanDate(rec.ngay_dang_ky),
    han_dang_kiem: cleanDate(rec.han_dang_kiem),
    ngay_dang_kiem: cleanDate(rec.ngay_dang_kiem),
    han_bao_hiem: cleanDate(rec.han_bao_hiem),
    ngay_bao_hiem: cleanDate(rec.ngay_bao_hiem),
  };
  if (exists) {
    const cols = Object.keys(fields);
    const set = cols.map((c, i) => c + '=$' + (i + 1)).join(', ');
    await api.db.run('UPDATE xe SET ' + set + ' WHERE id=$' + (cols.length + 1), ...cols.map((c) => (fields as any)[c]), id);
    await api.db.audit('xe', 'xe', id, u.id, 'Cập nhật hồ sơ xe ' + bks);
    return { ok: true, id };
  }
  const newId = await api.db.nextId('XE');
  const insFields: Record<string, unknown> = { ...fields, is_test: u.role === 'admin' ? 1 : 0 };
  delete insFields.bks;
  const cols = Object.keys(insFields);
  await api.db.run(
    'INSERT INTO xe(id, bks, ' + cols.join(', ') + ', deleted_at) VALUES($1,$2,' +
    cols.map((_, i) => '$' + (i + 3)).join(',') + ',$' + (cols.length + 3) + ')',
    newId, bks, ...cols.map((c) => insFields[c]), ''
  );
  await api.db.audit('xe', 'xe', newId, u.id, 'Tạo hồ sơ xe ' + bks);
  return { ok: true, id: newId };
}

export async function xeReminders(
  api: XeApi,
  q: { days?: number } = {}
): Promise<Array<{ bks: string; hang: string; dong: string; loai: string; han: string; con_bao_nhieu_ngay: number }>> {
  const u = api.auth.current();
  if (!u) throw new Error('Chưa đăng nhập.');
  const days = Math.max(1, Number(q.days) || 30);
  const thu = "to_char(now()+interval '" + days + " days','YYYY-MM-DD')";
  const rows = await api.db.rows<any>(
    `SELECT bks, hang, dong,
        CASE WHEN han_dang_kiem<>'' THEN 'Đăng kiểm' ELSE '' END AS k1, han_dang_kiem,
        CASE WHEN han_bao_hiem<>'' THEN 'Bảo hiểm' ELSE '' END AS k2, han_bao_hiem
      FROM xe WHERE deleted_at=''
        AND ((han_dang_kiem<>'' AND han_dang_kiem <= ${thu}) OR (han_bao_hiem<>'' AND han_bao_hiem <= ${thu}))
      ORDER BY LEAST(
        CASE WHEN han_dang_kiem='' THEN '9999-12-31' ELSE han_dang_kiem END,
        CASE WHEN han_bao_hiem='' THEN '9999-12-31' ELSE han_bao_hiem END) ASC`
  );
  const out: Array<{ bks: string; hang: string; dong: string; loai: string; han: string; con_bao_nhieu_ngay: number }> = [];
  for (const r of rows) {
    const items: Array<[string, string]> = [];
    if (r.k1) items.push(['Đăng kiểm', r.han_dang_kiem]);
    if (r.k2) items.push(['Bảo hiểm', r.han_bao_hiem]);
    for (const [loai, han] of items) {
      if (!han) continue;
      const diff = Math.round((new Date(han).getTime() - Date.now()) / 86400000);
      out.push({ bks: r.bks, hang: r.hang, dong: r.dong, loai, han, con_bao_nhieu_ngay: diff });
    }
  }
  return out;
}

/* ===================== v4.3 P2 — Đánh giá xe (Xưởng) ===================== */
const XEP_LOAI = ['A', 'B', 'C', 'D', 'E'];
export interface XeScoreArg {
  xe_id: string;
  diem: number;
  xep_loai: string;
  ghi_chu?: string;
}
/** Lưu đánh giá xe (xe_danh_gia). Cần đăng nhập. */
export async function xeScoreSave(
  api: XeApi,
  arg: XeScoreArg
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const u = api.auth.current();
  if (!u) return { ok: false, error: 'Chưa đăng nhập.' };
  const xeId = String(arg.xe_id || '').trim();
  if (!xeId) return { ok: false, error: 'Thiếu xe_id.' };
  const xe = await api.db.row<{ id: string }>("SELECT id FROM xe WHERE id=$1 AND deleted_at=''", xeId);
  if (!xe) return { ok: false, error: 'Không tìm thấy xe ' + xeId + '.' };
  const xep = String(arg.xep_loai || '').toUpperCase();
  if (!XEP_LOAI.includes(xep)) return { ok: false, error: 'Xếp loại phải là A/B/C/D/E.' };
  const diem = Number(arg.diem);
  if (!(diem >= 0 && diem <= 100)) return { ok: false, error: 'Điểm phải từ 0-100.' };
  const id = await api.db.nextId('XG');
  await api.db.run(
    'INSERT INTO xe_danh_gia(id, tenant_id, xe_id, diem, xep_loai, ghi_chu, nguoi_danh_gia, deleted_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    id, 'c1', xeId, diem, xep, arg.ghi_chu || '', u.name || u.id || '', ''
  );
  await api.db.audit('xe/danh_gia', 'xe_danh_gia', id, u.name || u.id || '', 'Đánh giá xe ' + xeId + ':' + xep);
  return { ok: true, id };
}

/** Lịch sử đánh giá xe (mới nhất trước). Cần đăng nhập. */
export async function xeScoreGet(
  api: XeApi,
  arg: { xe_id: string }
): Promise<Array<Record<string, unknown>>> {
  const u = api.auth.current();
  if (!u) return [];
  const xeId = String(arg.xe_id || '').trim();
  if (!xeId) return [];
  return api.db.rows<Record<string, unknown>>(
    'SELECT id, xe_id, diem, xep_loai, ghi_chu, nguoi_danh_gia FROM xe_danh_gia WHERE xe_id=$1 AND deleted_at=$2 ORDER BY id DESC',
    xeId, ''
  );
}
