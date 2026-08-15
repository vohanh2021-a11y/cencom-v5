/**
 * de_xuat.ts — Module "Đề xuất sửa chữa" GĐ3.6 (thay thế module Thăm khám TK).
 *
 * Luồng nghiệp vụ (đơn giản hóa theo yêu cầu dự án — bỏ giao diện lái xe / thợ):
 *   Xưởng tạo đề xuất (cho_duyet)
 *     → Quản lý / Giám đốc duyệt: da_duyet | tu_choi
 *     → Xưởng tạo phiếu sửa chữa từ đề xuất (scCreate với de_xuat_id)
 *       → trạng thái đề xuất chuyển thành da_chuyen_sc (SC chạy quy trình hiện tại).
 * Thay đổi so với tk.ts cũ: không còn thợ / xưởng nhận / ảnh; chỉ xoay quanh xưởng + quản lý.
 * Mọi hàm async (pg pool); audit nằm CÙNG transaction (gọi qua tx.audit).
 */
import type { Db } from './db.js';
import type { DeXuatSuaChuaRow } from './types.js';
import * as sc from './sc.js';
import type { ScApi } from './sc.js';

export const DX_TT: Record<string, string> = {
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
  tu_choi: 'Từ chối',
  da_chuyen_sc: 'Đã chuyển phiếu sửa chữa',
};
export const UU_TIEN: Record<string, string> = {
  Khan_cap: 'Khẩn cấp', Xu_ly_som: 'Xử lý sớm', Binh_thuong: 'Bình thường',
};

/* ---------- auth/perm helper ---------- */
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
export interface DeXuatApi {
  db: Db;
  auth: AuthLike;
  perm: PermLike;
}

function meId(api: DeXuatApi): string {
  const u = api.auth.current();
  return u ? u.id : '';
}
function meName(api: DeXuatApi): string {
  const u = api.auth.current();
  return u ? u.name : '';
}
function meRole(api: DeXuatApi): string {
  const u = api.auth.current();
  return u ? u.role : '';
}
async function checkLock(api: DeXuatApi, m: string, f: string): Promise<void> {
  const u = api.auth.current();
  if (!u) throw new Error('Chưa đăng nhập.');
  if (!(await api.perm.can(api.db, u.role, m, f))) throw new Error('Không đủ quyền: cần ' + m + '.' + f);
}

async function getDeXuat(api: DeXuatApi, id: string): Promise<DeXuatSuaChuaRow | undefined> {
  return api.db.row<DeXuatSuaChuaRow>(
    "SELECT * FROM de_xuat_sua_chua WHERE id=$1 AND deleted_at=''", String(id)
  );
}

function safeList(s: unknown): string[] {
  try {
    const a = JSON.parse(String(s || '[]'));
    return Array.isArray(a) ? a.map((x) => String(x)) : [];
  } catch {
    return String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
  }
}

async function decorate(api: DeXuatApi, t: DeXuatSuaChuaRow): Promise<Record<string, unknown>> {
  const xe = await api.db.xeByBks(t.bks);
  return {
    id: t.id, bks: t.bks, ngay: t.ngay, mo_ta: t.mo_ta,
    dau_hieu: safeList(t.dau_hieu),
    muc_uu_tien: t.muc_uu_tien,
    muc_uu_tien_label: UU_TIEN[t.muc_uu_tien] || t.muc_uu_tien,
    trang_thai: t.trang_thai, label: DX_TT[t.trang_thai] || t.trang_thai,
    nguoi_tao: t.nguoi_tao, nguoi_duyet: t.nguoi_duyet,
    ngay_duyet: t.ngay_duyet, ly_do_tu_choi: t.ly_do_tu_choi,
    sc_id: t.sc_id,
    xe: xe ? { bks: xe.bks, hang: xe.hang, dong: xe.dong, phong_ban: xe.phong_ban } : null,
  };
}

/* ---------------- Tạo đề xuất (xưởng) ---------------- */
export async function deXuatCreate(
  api: DeXuatApi,
  rec: { bks?: string; mo_ta?: string; dau_hieu?: string[]; muc_uu_tien?: string } | undefined
): Promise<{ ok: boolean; id?: string; error?: string }> {
  await checkLock(api, 'de_xuat', 'tao');
  rec = rec || {};
  const bks = String(rec.bks || '').trim().toUpperCase();
  if (!bks) return { ok: false, error: 'Thiếu biển số xe.' };
  const xe = await api.db.xeByBks(bks);
  if (!xe) return { ok: false, error: 'Chưa có xe ' + bks + ' trong sổ.' };
  const moTa = String(rec.mo_ta || '').trim();
  if (!moTa) return { ok: false, error: 'Thiếu mô tả dấu hiệu / yêu cầu sửa chữa.' };
  return api.db.transaction(async (tx) => {
    const id = await tx.nextId('DX');
    await tx.run(
      'INSERT INTO de_xuat_sua_chua(id, bks, ngay, nguoi_tao, mo_ta, dau_hieu, muc_uu_tien, trang_thai) ' +
      'VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      id, bks, tx.today(), meName(api), moTa,
      JSON.stringify(Array.isArray(rec.dau_hieu) ? rec.dau_hieu : []),
      ['Khan_cap', 'Xu_ly_som', 'Binh_thuong'].indexOf(String(rec.muc_uu_tien)) >= 0 ? rec.muc_uu_tien : 'Binh_thuong',
      'cho_duyet'
    );
    await tx.audit('de_xuat', 'de_xuat_sua_chua', id, meId(api), 'Xưởng tạo đề xuất sửa chữa ' + id + ' cho ' + bks);
    await tx.logNhatKy('Xưởng tạo đề xuất sửa chữa ' + id + ' (' + bks + '): ' + moTa.slice(0, 60), meName(api));
    return { ok: true, id };
  });
}

/* ---------------- Danh sách / chi tiết ---------------- */
export async function deXuatList(
  api: DeXuatApi,
  q: { bks?: string; trang_thai?: string; tu?: string; den?: string; limit?: number } = {}
): Promise<Record<string, unknown>[]> {
  await checkLock(api, 'de_xuat', 'xem');
  q = q || {};
  const u = api.auth.current();
  if (!u) throw new Error('Chưa đăng nhập.');
  let sql = "SELECT * FROM de_xuat_sua_chua WHERE deleted_at=''";
  const a: unknown[] = [];
  // Xưởng chỉ thấy đề xuất do mình tạo; quản lý/giám đốc thấy tất cả (theo ma trận)
  if (u.role === 'xuong') {
    sql += ' AND nguoi_tao=$' + (a.length + 1);
    a.push(u.name);
  }
  if (q.bks) { sql += ' AND upper(bks)=upper($' + (a.length + 1) + ')'; a.push(String(q.bks).toUpperCase()); }
  if (q.trang_thai) { sql += ' AND trang_thai=$' + (a.length + 1); a.push(q.trang_thai); }
  if (q.tu) { sql += ' AND ngay>=$' + (a.length + 1); a.push(q.tu); }
  if (q.den) { sql += ' AND ngay<=$' + (a.length + 1); a.push(q.den); }
  sql += ' ORDER BY ngay DESC, id DESC LIMIT ' + Math.min(+(q.limit as number) || 500, 5000);
  const rows = await api.db.rows<DeXuatSuaChuaRow>(sql, ...a);
  const out: Record<string, unknown>[] = [];
  for (const t of rows) out.push(await decorate(api, t));
  return out;
}

export async function deXuatGet(
  api: DeXuatApi,
  id: string
): Promise<Record<string, unknown> | { ok: false; error: string } | null> {
  await checkLock(api, 'de_xuat', 'xem');
  const t = await getDeXuat(api, String(id));
  if (!t) return null;
  const u = api.auth.current();
  if (u && u.role === 'xuong' && t.nguoi_tao !== u.name) {
    return { ok: false, error: 'Bạn không có quyền xem đề xuất này.' };
  }
  return decorate(api, t);
}

/* ---------------- Quản lý / Giám đốc duyệt ---------------- */
export async function deXuatApprove(
  api: DeXuatApi,
  id: string,
  action: string,
  lyDo?: string
): Promise<{ ok: boolean; trang_thai?: string; error?: string }> {
  await checkLock(api, 'de_xuat', 'duy');
  const t = await getDeXuat(api, id);
  if (!t) return { ok: false, error: 'Không thấy đề xuất.' };
  if (t.trang_thai !== 'cho_duyet') {
    return { ok: false, error: 'Đề xuất đang ở trạng thái: ' + DX_TT[t.trang_thai] };
  }
  if (action === 'ok') {
    await api.db.run("UPDATE de_xuat_sua_chua SET trang_thai='da_duyet', nguoi_duyet=$1, ngay_duyet=$2 WHERE id=$3",
      meName(api), api.db.today(), String(id));
  } else {
    await api.db.run("UPDATE de_xuat_sua_chua SET trang_thai='tu_choi', nguoi_duyet=$1, ngay_duyet=$2, ly_do_tu_choi=$3 WHERE id=$4",
      meName(api), api.db.today(), String(lyDo || ''), String(id));
  }
  await api.db.audit('de_xuat', 'de_xuat_sua_chua', String(id), meId(api),
    action === 'ok' ? 'Quản lý duyệt đề xuất sửa chữa' : 'Quản lý từ chối: ' + String(lyDo || ''));
  return { ok: true, trang_thai: action === 'ok' ? 'da_duyet' : 'tu_choi' };
}

/* ---------------- Xưởng tạo phiếu sửa chữa từ đề xuất ---------------- */
export async function deXuatToSC(
  api: DeXuatApi,
  id: string,
  extra?: {
    congviec?: Array<{ congviec_id?: number; ten?: string; donvi?: string; so_luong?: number; don_gia?: number; ghi_chu?: string; tho_id?: string; stt?: number; nguyen_nhan?: string; loai_xu_ly?: string }>;
    vattu?: Array<{ vattu_id?: number; ten?: string; donvi?: string; so_luong?: number; gd_dk?: number; gd_tt?: number; stt?: number; nguyen_nhan?: string; loai_xu_ly?: string }>;
  }
): Promise<{ ok: boolean; sc_id?: string; error?: string }> {
  await checkLock(api, 'de_xuat', 'sua');
  const t = await getDeXuat(api, id);
  if (!t) return { ok: false, error: 'Không thấy đề xuất.' };
  if (t.sc_id) return { ok: false, error: 'Đề xuất này đã có phiếu sửa chữa: ' + t.sc_id };
  if (t.trang_thai !== 'da_duyet') {
    return { ok: false, error: 'Đề xuất chưa được duyệt (đang: ' + DX_TT[t.trang_thai] + ').' };
  }
  const u = api.auth.current();
  if (!u) throw new Error('Chưa đăng nhập.');
  if (!(await api.perm.can(api.db, u.role, 'sc', 'tao'))) throw new Error('Không đủ quyền: cần sc.tao');
  const rec = {
    bks: t.bks,
    mo_ta: 'Từ đề xuất ' + t.id + (t.mo_ta ? ' — ' + t.mo_ta : ''),
    de_xuat_id: t.id,
    congviec: (extra && extra.congviec) || [],
    vattu: (extra && extra.vattu) || [],
  };
  const scApi: ScApi = { db: api.db, auth: api.auth, perm: api.perm as unknown as ScApi['perm'] };
  const out = await sc.scCreate(scApi, rec);
  const scId = out.id;
  if (out.ok !== false && scId) {
    await api.db.run("UPDATE de_xuat_sua_chua SET sc_id=$1, trang_thai='da_chuyen_sc' WHERE id=$2",
      scId, String(id));
    await api.db.audit('de_xuat', 'de_xuat_sua_chua', String(id), meId(api), 'Tạo phiếu sửa chữa ' + scId + ' từ đề xuất');
    return { ok: true, sc_id: scId };
  }
  return { ok: false, error: out.error || 'Tạo phiếu sửa chữa thất bại.' };
}

/* Phase 5: cache danh sách đề xuất (phân theo role + filter) TTL 60s */
export function deXuatListCached(
  api: DeXuatApi,
  cache: { cached<T>(k: string, ttl: number, fn: () => Promise<T>): Promise<T> },
  q: { bks?: string; trang_thai?: string; tu?: string; den?: string; limit?: number } = {}
): Promise<Record<string, unknown>[]> {
  const u = api.auth.current();
  const k = 'deXuatList:' + (u ? u.role : '?') + ':' + JSON.stringify(q || {});
  return cache.cached(k, 60000, () => deXuatList(api, q));
}

export default {
  DX_TT, UU_TIEN,
  deXuatCreate, deXuatList, deXuatGet, deXuatApprove, deXuatToSC, deXuatListCached,
};
