/**
 * baogia.ts — Báo giá nhà cung cấp (GĐ3.7, bước 3 của bộ hồ sơ sửa chữa).
 * Port server/baogia.js v3.6 — ĐÃ SỬA theo PLAN v4:
 *  - BỎ bắt buộc ảnh chụp JPG + AI-OCR (ai.js/ocr_vi.js) — `bao_gia_ncc` chỉ còn metadata;
 *  - items báo giá nhập tay nằm trong `dm_mua_ct` (gắn qua `dm_id`);
 *  - BỎ `baoGiaOcr`, `baoGiaCompare` (không còn ocr_result để so sánh).
 */
import type { Db } from './db.js';
import * as kho from './kho.js';
import { paginate, normPage } from './list.js';
import { logActivity } from './activity.js';

export interface Actor {
  id: string;
  name: string;
  role: string;
  phone?: string;
  phong_ban?: string;
}
export interface AuthLike {
  current(): Actor | null;
}
export interface PermLike {
  can(db: Db, role: string, m: string, f: string): Promise<boolean>;
}
export interface BaoGiaApi {
  db: Db;
  auth: AuthLike;
  perm: PermLike;
}

function meId(api: BaoGiaApi): string {
  const u = api.auth.current();
  return u ? (u.id || u.name) : '';
}
async function checkLock(api: BaoGiaApi, m: string, f: string): Promise<void> {
  const u = api.auth.current();
  if (!u) throw new Error('Chưa đăng nhập.');
  if (!(await api.perm.can(api.db, u.role, m, f))) throw new Error('Không đủ quyền: cần ' + m + '.' + f);
}

export async function baoGiaList(api: BaoGiaApi, q: Record<string, unknown> = {}): Promise<Array<Record<string, unknown>> & { total: number; page: number; limit: number; pages: number }> {
    await checkLock(api, 'mua', 'xem');
    const db = api.db;
    const a: unknown[] = [];
    let where = " WHERE deleted_at=''";
    if (q.sc_id) { where += ' AND sc_id=$' + (a.length + 1); a.push(q.sc_id); }
    if (q.dm_id) { where += ' AND dm_id=$' + (a.length + 1); a.push(q.dm_id); }
    if (q.loai_chung_tu) { where += ' AND loai_chung_tu=$' + (a.length + 1); a.push(q.loai_chung_tu); }
    const { page, limit } = normPage({ page: q.page, limit: q.limit });
    const rows = await paginate<Record<string, unknown>>(db, 'SELECT * FROM bao_gia_ncc t', where, a, 'ORDER BY t.id DESC', page, limit, 'bao_gia_ncc t');
    (rows as any).total = rows.total;
    (rows as any).page = rows.page;
    (rows as any).limit = rows.limit;
    (rows as any).pages = rows.pages;
    return rows as any;
  }

export async function baoGiaGet(api: BaoGiaApi, id: number | string): Promise<Record<string, unknown> | null> {
  await checkLock(api, 'mua', 'xem');
  return (await api.db.row<Record<string, unknown>>("SELECT * FROM bao_gia_ncc WHERE id=$1 AND deleted_at=''", Number(id))) ?? null;
}

/** Tạo báo giá / hóa đơn thanh toán (nhập tay — KHÔNG còn ảnh/OCR theo PLAN v4).
 *  Yêu cầu `ncc_ten`; items nhập tay gắn qua `dm_id` (dm_mua_ct) — nếu truyền `items` trực tiếp
 *  thì tự tạo Đề nghị mua để chứa items rồi gắn `dm_id` cho báo giá. */
export async function baoGiaCreate(
  api: BaoGiaApi,
  rec: {
    ncc_ten?: string;
    ncc_dia_chi?: string;
    ncc_sdt?: string;
    ngay?: string;
    sc_id?: string;
    dm_id?: string;
    loai_chung_tu?: string;
    ref_phieu_nhap?: string;
    items?: Array<{ vattu_id?: number; ten?: string; donvi?: string; so_luong?: number; dgia?: number }>;
  } = {}
): Promise<{ ok: boolean; id?: number; error?: string }> {
  await checkLock(api, 'mua', 'tao');
  const db = api.db;
  const isTest = api.auth.current()?.role === 'admin' ? 1 : 0;
  const ncc_ten = String(rec.ncc_ten || '').trim();
  if (!ncc_ten) return { ok: false, error: 'Bắt buộc nhập tên nhà cung cấp (ncc_ten).' };

  let dmId = String(rec.dm_id || '').trim();
  // Nhập tay items → tạo Đề nghị mua để chứa items (dm_mua_ct) rồi gắn dm_id
  if (!dmId && Array.isArray(rec.items) && rec.items.length) {
    const dm = await kho.dmCreate(api as unknown as import('./kho.js').KhoApi, {
      items: rec.items.map((it) => ({
        vattu_id: it.vattu_id, name: it.ten, donvi: it.donvi,
        so_luong: it.so_luong, dgia: it.dgia, sc_id: rec.sc_id,
      })),
      ghi_chu: 'Báo giá NCC ' + ncc_ten,
    });
    if (!dm.ok || !dm.id) return { ok: false, error: dm.error || 'Không tạo được đề nghị mua cho items.' };
    dmId = dm.id;
  }

  const scId = String(rec.sc_id || '').trim();
  const scCheck = scId ? await db.row<{ c: number }>("SELECT COUNT(*) c FROM phieu_sua WHERE id=$1 AND deleted_at=''", scId) : { c: 0 };
  const loai_ct = ['bao_gia', 'hoa_don', 'khac'].indexOf(String(rec.loai_chung_tu)) >= 0 ? String(rec.loai_chung_tu) : 'bao_gia';
  const ngay = String(rec.ngay || db.today());

  const r = await db.row<{ id: number }>(
    'INSERT INTO bao_gia_ncc(dm_id, sc_id, ncc_ten, ncc_dia_chi, ncc_sdt, ngay, loai_chung_tu, ref_phieu_nhap, nguoi_lap, is_test) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
    dmId, scId && Number(scCheck?.c) ? scId : '',
    ncc_ten, String(rec.ncc_dia_chi || '').trim(),
    String(rec.ncc_sdt || '').trim(), ngay, loai_ct,
    String(rec.ref_phieu_nhap || '').trim(), meId(api), isTest
  );
  const newId = Number(r?.id);
  await db.audit('mua', 'bao_gia_ncc', String(newId), meId(api), 'Tạo chứng từ NCC (' + loai_ct + ') ' + ncc_ten);
  if (scId && Number(scCheck?.c)) {
    await db.run("UPDATE phieu_sua SET trang_thai='da_duyet' WHERE id=$1 AND trang_thai='de_xuat'", scId);
  }
  try { const u = api.auth.current(); await logActivity(api.db, { actor_id: u?.id, actor_role: u?.role, hanh_dong: 'baogia_luu', doi_tuong: 'baogia', doi_tuong_id: String(newId), sc_id: scId, mo_ta: 'Lưu báo giá NCC' }); } catch (_) {}
  return { ok: true, id: newId };
}

/** RPC cũ dùng AI-OCR — đã BỎ ở v4 theo PLAN. Stub trả lỗi để client cũ không crash. */
export async function baoGiaOcr(
  _api: BaoGiaApi,
  _id: number | string
): Promise<{ ok: false; error: string }> {
  return { ok: false, error: 'Tính năng OCR báo giá (AI) đã bỏ ở v4. Nhập tay items qua Đề nghị mua (dm_id).' };
}

/** Xác nhận/điều chỉnh thông tin chứng từ NCC (v4 không còn ocr_xac_nhan — chỉ cập nhật metadata). */
export async function baoGiaConfirm(
  api: BaoGiaApi,
  id: number | string,
  rec: { ncc_ten?: string; ncc_dia_chi?: string; ncc_sdt?: string; ngay?: string; loai_chung_tu?: string } = {}
): Promise<{ ok: boolean; error?: string }> {
  await checkLock(api, 'mua', 'tao');
  const db = api.db;
  const b = await db.row<Record<string, unknown>>("SELECT * FROM bao_gia_ncc WHERE id=$1 AND deleted_at=''", Number(id));
  if (!b) return { ok: false, error: 'Không thấy chứng từ.' };
  const ncc_ten = String(rec.ncc_ten != null ? rec.ncc_ten : b.ncc_ten || '');
  const loai_ct = String(rec.loai_chung_tu || b.loai_chung_tu || 'bao_gia');
  const ngay = String(rec.ngay || b.ngay || db.today());
  await db.run(
    'UPDATE bao_gia_ncc SET ncc_ten=$1, ncc_dia_chi=$2, ncc_sdt=$3, ngay=$4, loai_chung_tu=$5 WHERE id=$6',
    ncc_ten,
    String(rec.ncc_dia_chi != null ? rec.ncc_dia_chi : b.ncc_dia_chi || ''),
    String(rec.ncc_sdt != null ? rec.ncc_sdt : b.ncc_sdt || ''),
    ngay, loai_ct, Number(id)
  );
  await db.audit('mua', 'bao_gia_ncc', String(id), meId(api), 'Xác nhận chứng từ NCC (' + loai_ct + ') ' + ncc_ten);
  return { ok: true };
}

export async function baoGiaDel(api: BaoGiaApi, id: number | string): Promise<{ ok: boolean; error?: string }> {
  await checkLock(api, 'mua', 'xoa');
  const db = api.db;
  const b = await db.row<Record<string, unknown>>("SELECT * FROM bao_gia_ncc WHERE id=$1 AND deleted_at=''", Number(id));
  if (!b) return { ok: false, error: 'Không thấy báo giá.' };
  await db.softDelete('bao_gia_ncc', 'id', Number(id), meId(api));
  return { ok: true };
}