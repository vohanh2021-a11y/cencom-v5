/**
 * tk.ts — Module "Yêu cầu thăm khám sửa chữa" GĐ3.6 (port từ server/tk.js v3.6 — NGUYÊN logic).
 *
 * Luồng nghiệp vụ:
 *   Lái xe gửi (cho_duyet)
 *     → Quản lý đội xe duyệt: da_duyet | tu_choi
 *     → Quản lý xưởng nhận:   xuong_nhan | xuong_tu_choi
 *     → Xưởng chọn thợ:       da_giao_tho
 *     → Thợ bắt đầu:          dang_thuc_hien
 *     → Thợ tạo SC (tk_id):   liên kết phieu_sua → chạy quy trình SC hiện tại
 *     → Hoàn tất thăm khám:   da_hoan | da_huy
 * Thay đổi so với v3.6: mọi hàm async; `scCreate` nhận api; cache dùng cached() async.
 */
import type { Db } from './db.js';
import * as cache from './cache.js';
import * as sc from './sc.js';
import { saveImg } from './chat.js';
import type { ScApi } from './sc.js';

export const TK_TT: Record<string, string> = {
  cho_duyet: 'Chờ quản lý đội xe duyệt',
  da_duyet: 'Đã duyệt — chờ xưởng nhận',
  tu_choi: 'Quản lý đội xe từ chối',
  xuong_nhan: 'Xưởng đã nhận',
  xuong_tu_choi: 'Xưởng từ chối',
  da_giao_tho: 'Đã giao thợ thăm khám',
  dang_thuc_hien: 'Đang thăm khám / sửa chữa',
  da_hoan: 'Hoàn tất',
  da_huy: 'Đã hủy',
};
export const UU_TIEN: Record<string, string> = {
  Khan_cap: 'Khẩn cấp', Xu_ly_som: 'Xử lý sớm', Binh_thuong: 'Bình thường',
};

/* ---------- auth/perm helper (port giữ nguyên tk.js) ---------- */
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
export interface TkApi {
  db: Db;
  auth: AuthLike;
  perm: PermLike;
}

function meId(api: TkApi): string {
  const u = api.auth.current();
  return u ? u.id : '';
}
function meName(api: TkApi): string {
  const u = api.auth.current();
  return u ? u.name : '';
}
function meRole(api: TkApi): string {
  const u = api.auth.current();
  return u ? u.role : '';
}
async function checkLock(api: TkApi, m: string, f: string): Promise<void> {
  const u = api.auth.current();
  if (!u) throw new Error('Chưa đăng nhập.');
  if (!(await api.perm.can(api.db, u.role, m, f))) throw new Error('Không đủ quyền: cần ' + m + '.' + f);
}

async function getTK(api: TkApi, id: string): Promise<import('./types.js').YeuCauThamKhamRow | undefined> {
  return api.db.row<import('./types.js').YeuCauThamKhamRow>(
    "SELECT * FROM yeu_cau_tham_kham WHERE id=$1 AND deleted_at=''", String(id)
  );
}

/** Lái xe chỉ được phép thao tác với xe của mình. */
export async function isMyVehicle(api: TkApi, bks: string): Promise<boolean> {
  const u = api.auth.current();
  if (!u) return false;
  const x = await api.db.xeByBks(bks);
  if (!x) return false;
  return String(x.lai_xe_id || '').toUpperCase() === String(u.id || '').toUpperCase() ||
         String(x.lai_xe || '').toUpperCase() === String(u.name || '').toUpperCase();
}

function safeList(s: unknown): string[] {
  try {
    const a = JSON.parse(String(s || '[]'));
    return Array.isArray(a) ? a : [];
  } catch {
    return String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
  }
}

async function decorate(api: TkApi, t: import('./types.js').YeuCauThamKhamRow): Promise<Record<string, unknown>> {
  const xe = await api.db.xeByBks(t.bks);
  return {
    id: t.id, bks: t.bks, lai_xe: t.lai_xe, ngay: t.ngay, mo_ta: t.mo_ta,
    dau_hieu: safeList(t.dau_hieu), muc_uu_tien: t.muc_uu_tien,
    muc_uu_tien_label: UU_TIEN[t.muc_uu_tien] || t.muc_uu_tien,
    trang_thai: t.trang_thai, label: TK_TT[t.trang_thai] || t.trang_thai,
    nguoi_duyet: t.nguoi_duyet, ngay_duyet: t.ngay_duyet, ly_do_tu_choi: t.ly_do_tu_choi,
    nguoi_xuong: t.nguoi_xuong, ngay_xuong: t.ngay_xuong, ly_do_xuong: t.ly_do_xuong,
    tho_id: t.tho_id, ngay_giao_tho: t.ngay_giao_tho,
    sc_id: t.sc_id, img_paths: safeList(t.img_paths),
    xe: xe ? { bks: xe.bks, hang: xe.hang, dong: xe.dong, phong_ban: xe.phong_ban, lai_xe: xe.lai_xe } : null
  };
}

/* ---------------- Tạo yêu cầu ---------------- */
export async function tkCreate(
  api: TkApi,
  rec: { bks?: string; mo_ta?: string; dau_hieu?: string[]; muc_uu_tien?: string; imgs?: string[] } | undefined
): Promise<{ ok: boolean; id?: string; error?: string }> {
  await checkLock(api, 'tk', 'tao');
  rec = rec || {};
  const bks = String(rec.bks || '').trim().toUpperCase();
  if (!bks) return { ok: false, error: 'Thiếu biển số xe.' };
  const xe = await api.db.xeByBks(bks);
  if (!xe) return { ok: false, error: 'Chưa có xe ' + bks + ' trong sổ.' };
  if (meRole(api) === 'laixe' && !(await isMyVehicle(api, bks))) {
    return { ok: false, error: 'Xe ' + bks + ' không nằm trong xe bạn được giao.' };
  }
  const moTa = String(rec.mo_ta || '').trim();
  if (!moTa) return { ok: false, error: 'Thiếu mô tả dấu hiệu / bệnh của xe.' };
  return api.db.transaction(async (tx) => {
    const id = await tx.nextId('TK');
    await tx.run(
      'INSERT INTO yeu_cau_tham_kham(id, bks, lai_xe, ngay, mo_ta, dau_hieu, muc_uu_tien, trang_thai, img_paths) ' +
      'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      id, bks, meId(api), tx.today(), moTa,
      JSON.stringify(Array.isArray(rec.dau_hieu) ? rec.dau_hieu : []),
      ['Khan_cap', 'Xu_ly_som', 'Binh_thuong'].indexOf(String(rec.muc_uu_tien)) >= 0 ? rec.muc_uu_tien : 'Binh_thuong',
      'cho_duyet', '[]'
    );
    if (Array.isArray(rec.imgs)) {
      for (const b64 of rec.imgs) {
        if (b64) await tkAddImg({ db: tx, auth: api.auth, perm: api.perm }, id, b64, true);
      }
    }
    await tx.audit('tk', 'yeu_cau_tham_kham', id, meId(api), 'Lái xe gửi yêu cầu thăm khám ' + id + ' cho ' + bks);
    await tx.logNhatKy('Lái xe gửi yêu cầu thăm khám ' + id + ' (' + bks + '): ' + moTa.slice(0, 60), meName(api));
    return { ok: true, id };
  });
}

/* ---------------- Danh sách / chi tiết ---------------- */
export async function tkList(
  api: TkApi,
  q: { bks?: string; trang_thai?: string; lai_xe?: string; tu?: string; den?: string; limit?: number } = {}
): Promise<Record<string, unknown>[]> {
  await checkLock(api, 'tk', 'xem');
  q = q || {};
  const u = api.auth.current();
  if (!u) throw new Error('Chưa đăng nhập.');
  let sql = "SELECT * FROM yeu_cau_tham_kham WHERE deleted_at=''";
  const a: unknown[] = [];
  if (u.role === 'laixe') {
    sql += ' AND upper(lai_xe)=upper($' + (a.length + 1) + ')';
    a.push(u.id);
  }
  if (u.role === 'quanly' && u.phong_ban) {
    // Quản lý đội xe chỉ thấy xe thuộc phòng ban của mình (nếu được gán phòng ban)
    sql += ' AND bks IN (SELECT bks FROM xe WHERE phong_ban=$' + (a.length + 1) + ')';
    a.push(u.phong_ban);
  }
  if (q.bks) { sql += ' AND upper(bks)=upper($' + (a.length + 1) + ')'; a.push(String(q.bks).toUpperCase()); }
  if (q.trang_thai) { sql += ' AND trang_thai=$' + (a.length + 1); a.push(q.trang_thai); }
  if (q.lai_xe) { sql += ' AND upper(lai_xe)=upper($' + (a.length + 1) + ')'; a.push(q.lai_xe); }
  if (q.tu) { sql += ' AND ngay>=$' + (a.length + 1); a.push(q.tu); }
  if (q.den) { sql += ' AND ngay<=$' + (a.length + 1); a.push(q.den); }
  sql += ' ORDER BY ngay DESC, id DESC LIMIT ' + Math.min(+(q.limit as number) || 500, 5000);
  const rows = await api.db.rows<import('./types.js').YeuCauThamKhamRow>(sql, ...a);
  const out: Record<string, unknown>[] = [];
  for (const t of rows) out.push(await decorate(api, t));
  return out;
}

export async function tkGet(
  api: TkApi,
  id: string
): Promise<Record<string, unknown> | { ok: false; error: string } | null> {
  await checkLock(api, 'tk', 'xem');
  const t = await getTK(api, String(id));
  if (!t) return null;
  if (meRole(api) === 'laixe' && t.lai_xe !== meId(api)) {
    return { ok: false, error: 'Bạn không có quyền xem yêu cầu này.' };
  }
  return decorate(api, t);
}

/* ---------------- Quản lý đội xe duyệt ---------------- */
export async function tkApprove(
  api: TkApi,
  id: string,
  action: string,
  lyDo?: string
): Promise<{ ok: boolean; trang_thai?: string; error?: string }> {
  await checkLock(api, 'tk', 'duy');
  const t = await getTK(api, id);
  if (!t) return { ok: false, error: 'Không thấy yêu cầu.' };
  if (t.trang_thai !== 'cho_duyet') {
    return { ok: false, error: 'Yêu cầu đang ở trạng thái: ' + TK_TT[t.trang_thai] };
  }
  if (action === 'ok') {
    await api.db.run("UPDATE yeu_cau_tham_kham SET trang_thai='da_duyet', nguoi_duyet=$1, ngay_duyet=$2 WHERE id=$3",
      meName(api), api.db.today(), String(id));
  } else {
    await api.db.run("UPDATE yeu_cau_tham_kham SET trang_thai='tu_choi', nguoi_duyet=$1, ngay_duyet=$2, ly_do_tu_choi=$3 WHERE id=$4",
      meName(api), api.db.today(), String(lyDo || ''), String(id));
  }
  await api.db.audit('tk', 'yeu_cau_tham_kham', String(id), meId(api),
    action === 'ok' ? 'Quản lý đội xe duyệt yêu cầu thăm khám' : 'Quản lý đội xe từ chối: ' + String(lyDo || ''));
  return { ok: true, trang_thai: action === 'ok' ? 'da_duyet' : 'tu_choi' };
}

/* ---------------- Quản lý xưởng nhận / từ chối ---------------- */
export async function tkWorkshop(
  api: TkApi,
  id: string,
  action: string,
  lyDo?: string
): Promise<{ ok: boolean; trang_thai?: string; error?: string }> {
  await checkLock(api, 'tk', 'duy');
  const t = await getTK(api, id);
  if (!t) return { ok: false, error: 'Không thấy yêu cầu.' };
  if (t.trang_thai !== 'da_duyet') {
    return { ok: false, error: 'Yêu cầu đang ở trạng thái: ' + TK_TT[t.trang_thai] + ' — chưa tới bước xưởng.' };
  }
  if (action === 'ok') {
    await api.db.run("UPDATE yeu_cau_tham_kham SET trang_thai='xuong_nhan', nguoi_xuong=$1, ngay_xuong=$2, ly_do_xuong='' WHERE id=$3",
      meName(api), api.db.today(), String(id));
  } else {
    await api.db.run("UPDATE yeu_cau_tham_kham SET trang_thai='xuong_tu_choi', nguoi_xuong=$1, ngay_xuong=$2, ly_do_xuong=$3 WHERE id=$4",
      meName(api), api.db.today(), String(lyDo || ''), String(id));
  }
  await api.db.audit('tk', 'yeu_cau_tham_kham', String(id), meId(api),
    action === 'ok' ? 'Quản lý xưởng nhận lệnh thăm khám' : 'Quản lý xưởng từ chối: ' + String(lyDo || ''));
  return { ok: true, trang_thai: action === 'ok' ? 'xuong_nhan' : 'xuong_tu_choi' };
}

/* ---------------- Xưởng giao thợ ---------------- */
export async function tkAssign(
  api: TkApi,
  id: string,
  thoId: string
): Promise<{ ok: boolean; trang_thai?: string; tho_id?: string; error?: string }> {
  await checkLock(api, 'tk', 'sua');
  const t = await getTK(api, id);
  if (!t) return { ok: false, error: 'Không thấy yêu cầu.' };
  if (t.trang_thai !== 'xuong_nhan') {
    return { ok: false, error: 'Yêu cầu chưa sẵn sàng giao thợ (đang: ' + TK_TT[t.trang_thai] + ').' };
  }
  const tho = await api.db.userByLogin(String(thoId || ''));
  if (!tho) return { ok: false, error: 'Không thấy thợ ' + thoId };
  await api.db.run("UPDATE yeu_cau_tham_kham SET trang_thai='da_giao_tho', tho_id=$1, ngay_giao_tho=$2 WHERE id=$3",
    tho.id, api.db.today(), String(id));
  await api.db.audit('tk', 'yeu_cau_tham_kham', String(id), meId(api), 'Xưởng giao thợ ' + tho.name + ' thăm khám');
  return { ok: true, trang_thai: 'da_giao_tho', tho_id: tho.id };
}

/* ---------------- Thợ bắt đầu / hoàn tất ---------------- */
export async function tkStart(
  api: TkApi,
  id: string
): Promise<{ ok: boolean; trang_thai?: string; error?: string }> {
  await checkLock(api, 'tk', 'sua');
  const t = await getTK(api, id);
  if (!t) return { ok: false, error: 'Không thấy yêu cầu.' };
  const me = meId(api);
  const role = meRole(api);
  if (['laixe'].indexOf(role) >= 0) return { ok: false, error: 'Chỉ thợ/quản lý xưởng bắt đầu được.' };
  if (['da_giao_tho', 'xuong_nhan'].indexOf(t.trang_thai) < 0) {
    return { ok: false, error: 'Chưa sẵn sàng bắt đầu (đang: ' + TK_TT[t.trang_thai] + ').' };
  }
  if (t.trang_thai === 'da_giao_tho' && t.tho_id && t.tho_id !== me && role !== 'xuong' && role !== 'admin') {
    return { ok: false, error: 'Lệnh đã giao cho thợ khác.' };
  }
  await api.db.run("UPDATE yeu_cau_tham_kham SET trang_thai='dang_thuc_hien', tho_id=COALESCE(NULLIF(tho_id,''),$1), ngay_giao_tho=COALESCE(NULLIF(ngay_giao_tho,''),$2) WHERE id=$3",
    me, api.db.today(), String(id));
  await api.db.audit('tk', 'yeu_cau_tham_kham', String(id), meId(api), 'Bắt đầu thăm khám');
  return { ok: true, trang_thai: 'dang_thuc_hien' };
}

/** Thợ tạo phiếu sửa chữa từ yêu cầu thăm khám — nối tiếp quy trình SC hiện tại. */
export async function tkCreateSC(
  api: TkApi,
  id: string,
  extra?: {
    congviec?: Array<{ congviec_id?: number; ten?: string; donvi?: string; so_luong?: number; don_gia?: number; ghi_chu?: string; tho_id?: string; stt?: number; nguyen_nhan?: string; loai_xu_ly?: string }>;
    vattu?: Array<{ vattu_id?: number; ten?: string; donvi?: string; so_luong?: number; gd_dk?: number; gd_tt?: number; stt?: number; nguyen_nhan?: string; loai_xu_ly?: string }>;
  }
): Promise<{ ok: boolean; sc_id?: string; error?: string }> {
  await checkLock(api, 'tk', 'sua');
  const t = await getTK(api, id);
  if (!t) return { ok: false, error: 'Không thấy yêu cầu.' };
  if (t.sc_id) return { ok: false, error: 'Yêu cầu này đã có phiếu sửa chữa: ' + t.sc_id };
  if (['da_giao_tho', 'xuong_nhan', 'dang_thuc_hien'].indexOf(t.trang_thai) < 0) {
    return { ok: false, error: 'Yêu cầu chưa sẵn sàng lập phiếu sửa chữa (đang: ' + TK_TT[t.trang_thai] + ').' };
  }
  const me = meId(api);
  const role = meRole(api);
  if (t.trang_thai === 'da_giao_tho' && t.tho_id && t.tho_id !== me &&
      ['xuong', 'admin'].indexOf(role) < 0) {
    return { ok: false, error: 'Lệnh đã giao cho thợ khác.' };
  }
  const u = api.auth.current();
  if (!u) throw new Error('Chưa đăng nhập.');
  if (!(await api.perm.can(api.db, u.role, 'sc', 'tao'))) throw new Error('Không đủ quyền: cần sc.tao');
  const rec = {
    bks: t.bks,
    mo_ta: 'Từ yêu cầu thăm khám ' + t.id + (t.mo_ta ? ' — ' + t.mo_ta : ''),
    tk_id: t.id,
    congviec: (extra && extra.congviec) || [],
    vattu: (extra && extra.vattu) || []
  };
  const scApi: ScApi = { db: api.db, auth: api.auth, perm: api.perm as unknown as ScApi['perm'] };
  const out = await sc.scCreate(scApi, rec);
  if (out.ok !== false) {
    await api.db.run("UPDATE yeu_cau_tham_kham SET sc_id=$1, trang_thai='dang_thuc_hien' WHERE id=$2",
      out.id, String(id));
    await api.db.audit('tk', 'yeu_cau_tham_kham', String(id), meId(api), 'Tạo phiếu sửa chữa ' + out.id + ' từ yêu cầu thăm khám');
  }
  return { ok: true, sc_id: out.id };
}

export async function tkFinish(
  api: TkApi,
  id: string,
  ghiChu?: string
): Promise<{ ok: boolean; trang_thai?: string; error?: string }> {
  await checkLock(api, 'tk', 'sua');
  const t = await getTK(api, id);
  if (!t) return { ok: false, error: 'Không thấy yêu cầu.' };
  if (['dang_thuc_hien', 'da_giao_tho', 'xuong_nhan'].indexOf(t.trang_thai) < 0) {
    return { ok: false, error: 'Yêu cầu chưa sẵn sàng hoàn tất.' };
  }
  await api.db.run("UPDATE yeu_cau_tham_kham SET trang_thai='da_hoan', mo_ta=mo_ta || $1 WHERE id=$2",
    (ghiChu ? ' | ' + String(ghiChu) : ''), String(id));
  await api.db.audit('tk', 'yeu_cau_tham_kham', String(id), meId(api), 'Hoàn tất thăm khám');
  return { ok: true, trang_thai: 'da_hoan' };
}

/* ---------------- Ảnh kèm (tái dùng chat_imgs) ---------------- */
export async function tkSendImg(
  api: TkApi,
  id: string,
  b64: string
): Promise<{ ok: boolean; file?: string; error?: string }> {
  await checkLock(api, 'tk', 'tao');
  const t = await getTK(api, id);
  if (!t) return { ok: false, error: 'Không thấy yêu cầu.' };
  return tkAddImg(api, id, b64, false);
}
export async function tkAddImg(
  api: TkApi,
  id: string,
  b64: string,
  skipLock: boolean
): Promise<{ ok: boolean; file?: string; error?: string }> {
  if (!skipLock) await checkLock(api, 'tk', 'tao');
  const t = await getTK(api, id);
  if (!t) return { ok: false, error: 'Không thấy yêu cầu.' };
  const file = saveImg('TK' + String(id).replace(/[^A-Za-z0-9]/g, ''), b64);
  if (!file) return { ok: false, error: 'File không phải ảnh JPG hợp lệ.' };
  const imgs = safeList(t.img_paths);
  imgs.push(file);
  await api.db.run('UPDATE yeu_cau_tham_kham SET img_paths=$1 WHERE id=$2', JSON.stringify(imgs), String(id));
  return { ok: true, file };
}

/* Phase 5: cache danh sách thăm khám (phân theo role + filter) TTL 60s */
export function tkListCached(
  api: TkApi,
  q: { bks?: string; trang_thai?: string; lai_xe?: string; tu?: string; den?: string; limit?: number } = {}
): Promise<Record<string, unknown>[]> {
  const u = api.auth.current();
  const k = 'tkList:' + (u ? u.role : '?') + ':' + JSON.stringify(q || {});
  return cache.cached(k, 60000, () => tkList(api, q));
}