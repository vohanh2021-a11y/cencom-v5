/**
 * kho.ts — Module Kho & Mua sắm GĐ3 (port từ server/kho.js v3.6 — NGUYÊN logic).
 * Thay đổi so với v3.6:
 *  - mọi hàm async (pg pool); audit/ghi bọc transaction (audit nằm CÙNG transaction).
 *  - `dmFromBaoGia` KHÔNG port (phụ thuộc AI-OCR `ocr_xac_nhan`/`ocr_result` — đã chốt BỎ v4).
 *    Giữ stub trả lỗi rõ ràng để client cũ không crash contract.
 *  - `thanhLyList`: bỏ `p.bks` (schema v4 phieu_nhap không có cột bks).
 */
import type { Db } from './db.js';
import type {
  VattuRow,
  DeNghiMuaRow,
  DmMuaCtRow,
  PhieuNhapRow,
  PhieuNhapCtRow,
  PhieuXuatRow,
  PhieuXuatCtRow,
} from './types.js';

/* ---------- auth/perm helper (port giữ nguyên kho.js) ---------- */
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
  canApproveMua(db: Db, role: string, tong: number): Promise<boolean>;
}

export interface KhoApi {
  db: Db;
  auth: AuthLike;
  perm: PermLike;
}

export const DM_TT: Record<string, string> = {
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
  tu_choi: 'Từ chối',
  da_nhap: 'Đã nhập',
};

function meId(api: KhoApi): string {
  const u = api.auth.current();
  return u ? u.id || u.name : '';
}
async function checkLock(api: KhoApi, m: string, f: string): Promise<void> {
  const u = api.auth.current();
  if (!u) throw new Error('Chưa đăng nhập.');
  if (!(await api.perm.can(api.db, u.role, m, f))) throw new Error('Không đủ quyền: cần ' + m + '.' + f);
}
export function vnd(n: number | string): string {
  return String(Number(n || 0).toLocaleString('vi-VN')).replace(/,/g, '.') + ' đ';
}
async function vtById(db: Db, id: number | string): Promise<VattuRow | null> {
  id = Number(id);
  if (!id) return null;
  return (await db.row<VattuRow>("SELECT * FROM vattu WHERE id=$1 AND deleted_at=''", id)) || null;
}
async function vtByTen(db: Db, ten: string): Promise<VattuRow | null> {
  const t = String(ten || '').trim().toLowerCase();
  if (!t) return null;
  return (
    (await db.row<VattuRow>("SELECT * FROM vattu WHERE lower(name)=$1 AND deleted_at=''", t)) ||
    (await db.row<VattuRow>("SELECT * FROM vattu WHERE lower(name) LIKE $1 AND deleted_at=''", '%' + t + '%')) ||
    null
  );
}

/* ---------------- danh mục vật tư ---------------- */
export async function vatTuList(api: KhoApi): Promise<VattuRow[]> {
  await checkLock(api, 'kho', 'xem');
  return api.db.rows<VattuRow>("SELECT * FROM vattu WHERE deleted_at='' ORDER BY nhom, name");
}

export async function vatTuSave(
  api: KhoApi,
  rec: Partial<VattuRow> & { code?: string; donvi?: string } | undefined
): Promise<{ ok: boolean; id?: number; error?: string }> {
  await checkLock(api, 'kho', 'tao');
  rec = rec || {};
  const name = String(rec.name || '').trim();
  if (!name) return { ok: false, error: 'Thiếu tên vật tư.' };
  const code = String(rec.code || '').trim().toUpperCase() || 'VT-' + String(Date.now()).slice(-6);
  const gia = Number(rec.gia) || 0;
  const ton = Number(rec.ton) || 0;
  const ton_min = Number(rec.ton_min) || 0;
  const id = Number(rec.id) || 0;
  if (id) {
    const old = await vtById(api.db, id);
    if (!old) return { ok: false, error: 'Không thấy vật tư.' };
    await api.db.run(
      'UPDATE vattu SET code=$1, name=$2, nhom=$3, donvi=$4, gia=$5, ton=$6, ton_min=$7 WHERE id=$8',
      code, name, rec.nhom || old.nhom, rec.donvi || old.donvi, gia, ton, ton_min, id
    );
    await api.db.audit('kho', 'vattu', String(id), meId(api), 'Cập nhật vật tư ' + name);
    return { ok: true, id };
  }
  const dup = await api.db.row<{ id: number }>('SELECT id FROM vattu WHERE code=$1', code);
  if (dup) {
    await api.db.run(
      'UPDATE vattu SET name=$1, nhom=$2, donvi=$3, gia=$4, ton_min=$5 WHERE id=$6',
      name, rec.nhom || '', rec.donvi || '', gia, ton_min, dup.id
    );
    return { ok: true, id: dup.id };
  }
  const ins = await api.db.run(
    'INSERT INTO vattu(code, name, nhom, donvi, gia, ton, ton_min, active) VALUES($1,$2,$3,$4,$5,$6,$7,1) RETURNING id',
    code, name, rec.nhom || '', rec.donvi || '', gia, ton, ton_min
  );
  const rows = (await api.db.rows<{ id: number }>('SELECT id FROM vattu WHERE code=$1', code));
  return { ok: true, id: rows[0] ? rows[0].id : (ins.rowCount || 0) };
}

export async function vatTuDel(
  api: KhoApi,
  id: number
): Promise<{ ok: boolean; error?: string }> {
  await checkLock(api, 'kho', 'xoa');
  const v = await vtById(api.db, id);
  if (!v) return { ok: false, error: 'Không thấy vật tư.' };
  const nhap = await api.db.row<{ c: number }>(
    "SELECT COUNT(*) c FROM phieu_nh_ct WHERE vattu_id=$1 AND deleted_at=''", v.id
  );
  const xuat = await api.db.row<{ c: number }>(
    "SELECT COUNT(*) c FROM phieu_xuat_ct WHERE vattu_id=$1 AND deleted_at=''", v.id
  );
  if ((nhap?.c || 0) > 0 || (xuat?.c || 0) > 0) {
    return { ok: false, error: 'Vật tư đã có phiếu nhập/xuất, không thể xoá. Hãy ẩn bằng cách đặt tồn = 0.' };
  }
  await api.db.softDelete('vattu', 'id', v.id, meId(api));
  return { ok: true };
}

/* ---------------- tồn kho + cảnh báo ---------------- */
export async function tonKho(
  api: KhoApi
): Promise<{
  rows: Array<{
    id: number; code: string; name: string; nhom: string; donvi: string;
    gia: number; ton: number; ton_min: number; ton_cu_hong: number;
    thieu: number; low: boolean;
  }>;
  lowCount: number;
  giaTriTonKho: number;
}> {
  await checkLock(api, 'kho', 'xem');
  const rows = await api.db.rows<VattuRow>("SELECT * FROM vattu WHERE deleted_at='' ORDER BY (ton-ton_min), nhom, name");
  const low = rows.filter((v) => Number(v.ton) < Number(v.ton_min));
  return {
    rows: rows.map((v) => ({
      id: v.id, code: v.code, name: v.name, nhom: v.nhom, donvi: v.donvi,
      gia: v.gia, ton: v.ton, ton_min: v.ton_min,
      ton_cu_hong: v.ton_cu_hong || 0,
      thieu: Math.max(0, Number(v.ton_min) - Number(v.ton)),
      low: Number(v.ton) < Number(v.ton_min)
    })),
    lowCount: low.length,
    giaTriTonKho: rows.reduce((a, v) => a + Number(v.ton) * Number(v.gia), 0)
  };
}

/* ---------------- đề nghị mua ---------------- */
export async function dmList(api: KhoApi): Promise<Array<DeNghiMuaRow & { so_dong: number; label: string }>> {
  await checkLock(api, 'mua', 'xem');
  const rows = await api.db.rows<DeNghiMuaRow & { so_dong: number }>(
    "SELECT d.*, (SELECT COUNT(*) FROM dm_mua_ct c WHERE c.dm_id=d.id AND c.deleted_at='') so_dong " +
    "FROM de_nghi_mua d WHERE d.deleted_at='' ORDER BY d.ngay DESC, d.id DESC"
  );
  return rows.map((d) => ({ ...d, label: DM_TT[d.trang_thai] || d.trang_thai }));
}

export async function dmDetail(
  api: KhoApi,
  id: string
): Promise<{ dm: DeNghiMuaRow & { label: string }; ct: DmMuaCtRow[] } | null> {
  await checkLock(api, 'mua', 'xem');
  const d = await api.db.row<DeNghiMuaRow>("SELECT * FROM de_nghi_mua WHERE id=$1 AND deleted_at=''", String(id));
  if (!d) return null;
  const ct = await api.db.rows<DmMuaCtRow>("SELECT * FROM dm_mua_ct WHERE dm_id=$1 AND deleted_at='' ORDER BY id", id);
  return { dm: { ...d, label: DM_TT[d.trang_thai] || d.trang_thai }, ct };
}

interface DmItemInput {
  vattu_id?: number;
  name?: string;
  donvi?: string;
  so_luong?: number;
  dgia?: number;
  sc_id?: string;
}

export async function dmCreate(
  api: KhoApi,
  rec: { items?: DmItemInput[]; ghi_chu?: string } | undefined
): Promise<{ ok: boolean; id?: string; tong?: number; error?: string }> {
  await checkLock(api, 'mua', 'tao');
  rec = rec || {};
  const items = (rec.items || []).filter((x) => x && (Number(x.vattu_id) || String(x.name || '').trim()));
  if (!items.length) return { ok: false, error: 'Không có vật tư nào để đề nghị.' };
  return api.db.transaction(async (tx) => {
    const id = await tx.nextId('DNM');
    await tx.run(
      'INSERT INTO de_nghi_mua(id, nguoi_lap, ngay, trang_thai, ghi_chu) VALUES($1,$2,$3,$4,$5)',
      id, meId(api), tx.today(), 'cho_duyet', String(rec.ghi_chu || '')
    );
    for (const it of items) {
      const cat = it.vattu_id ? await vtById(tx, it.vattu_id) : null;
      const sl = Math.max(1, Number(it.so_luong) || 1);
      const gia = Number(it.dgia) || (cat ? Number(cat.gia) : 0);
      await tx.run(
        'INSERT INTO dm_mua_ct(dm_id, vattu_id, ten, donvi, so_luong, dg_dk, dg_tt, sc_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        id, Number(it.vattu_id) || 0, cat ? cat.name : String(it.name || ''),
        cat ? cat.donvi : String(it.donvi || ''), sl, gia, gia, String(it.sc_id || '')
      );
    }
    const tongRow = await tx.row<{ s: number }>('SELECT COALESCE(SUM(so_luong*dg_dk),0) s FROM dm_mua_ct WHERE dm_id=$1', id);
    const tong = Number(tongRow?.s || 0);
    await tx.run('UPDATE de_nghi_mua SET tong=$1 WHERE id=$2', tong, id);
    await tx.audit('mua', 'de_nghi_mua', String(id), meId(api), 'Tạo đề nghị mua ' + id);
    return { ok: true, id, tong };
  });
}

export async function dmFromSC(
  api: KhoApi,
  scId: string
): Promise<{ ok: boolean; id?: string; tong?: number; error?: string }> {
  await checkLock(api, 'mua', 'tao');
  const miss = await api.db.rows<import('./types.js').ScVattuRow>(
    "SELECT * FROM sc_vattu WHERE sc_id=$1 AND tt='can_mua' AND vattu_id>0 AND deleted_at=''", scId
  );
  if (!miss.length) return { ok: false, error: 'Không còn vật tư cần mua.' };
  const open = await api.db.row<{ dm_id: string }>(
    "SELECT c.dm_id FROM dm_mua_ct c JOIN de_nghi_mua d ON d.id=c.dm_id " +
    "WHERE c.sc_id=$1 AND d.trang_thai IN ('cho_duyet') AND c.deleted_at='' LIMIT 1", scId
  );
  if (open) return { ok: false, error: 'Đã có đề nghị mở: ' + open.dm_id };
  const by: Record<number, { vattu_id: number; name: string; donvi: string; so_luong: number; dgia: number; sc_id: string }> = {};
  for (const v of miss) {
    if (!by[v.vattu_id]) by[v.vattu_id] = { vattu_id: v.vattu_id, name: v.ten, donvi: v.donvi, so_luong: 0, dgia: v.gd_dk, sc_id: scId };
    by[v.vattu_id]!.so_luong += Number(v.so_luong) || 0;
  }
  const out = await dmCreate(api, { items: Object.values(by), ghi_chu: 'Vật tư cho phiếu sửa chữa ' + scId });
  // GĐ3.7: liên kết báo giá NCC đã tạo cho SC vào đề nghị mua này (để checkHoSo đủ bước)
  if (out && out.ok && out.id) {
    await api.db.run("UPDATE bao_gia_ncc SET dm_id=$1 WHERE sc_id=$2 AND dm_id='' AND deleted_at=''", out.id, scId);
  }
  return out;
}

/** GĐ3.7: tự động tạo Đề nghị mua từ báo giá NCC.
 *  v4 đã BỎ AI-OCR (không còn `ocr_xac_nhan`/`ocr_result`) → stub trả lỗi để client cũ không crash. */
export async function dmFromBaoGia(
  _api: KhoApi,
  _scId: string
): Promise<{ ok: boolean; error?: string }> {
  return { ok: false, error: 'Tính năng tạo đề nghị mua từ ảnh báo giá (AI-OCR) đã bỏ ở v4. Dùng "Đề nghị mua từ SC" thay thế.' };
}

export async function dmAutoBu(
  api: KhoApi
): Promise<{ ok: boolean; id?: string | null; tong?: number; message?: string; error?: string }> {
  await checkLock(api, 'mua', 'tao');
  const items: DmItemInput[] = [];
  const vats = await api.db.rows<VattuRow>("SELECT * FROM vattu WHERE ton_min>0 AND ton<ton_min AND deleted_at=''");
  for (const v of vats) {
    const short = Math.max(0, Number(v.ton_min) - Number(v.ton));
    if (short <= 0) continue;
    const open = await api.db.row<{ c: number }>(
      "SELECT COUNT(*) c FROM dm_mua_ct c JOIN de_nghi_mua d ON d.id=c.dm_id " +
      "WHERE c.vattu_id=$1 AND d.trang_thai IN ('cho_duyet','da_duyet') AND c.deleted_at=''", v.id
    );
    if ((open?.c || 0) > 0) continue;
    items.push({ vattu_id: v.id, so_luong: short, dgia: v.gia });
  }
  if (!items.length) return { ok: true, id: null, message: 'Không cần bổ sung tồn.' };
  const out = await dmCreate(api, { items, ghi_chu: 'Tự động bổ sung tồn tối thiểu' });
  return { ...out, ok: true };
}

export async function dmDecide(
  api: KhoApi,
  id: string,
  action: string,
  lyDo?: string
): Promise<{ ok: boolean; trang_thai?: string; error?: string }> {
  await checkLock(api, 'mua', 'duy'); // (được canApproveMua kiểm tra tiếp)
  const u = api.auth.current();
  if (!u) throw new Error('Chưa đăng nhập.');
  const d = await api.db.row<DeNghiMuaRow>("SELECT * FROM de_nghi_mua WHERE id=$1 AND deleted_at=''", String(id));
  if (!d) return { ok: false, error: 'Không thấy đề nghị.' };
  if (d.trang_thai !== 'cho_duyet') return { ok: false, error: 'Đề nghị đã xử lý.' };
  if (!(await api.perm.canApproveMua(api.db, u.role, d.tong))) {
    return { ok: false, error: 'Chưa đủ quyền — cần Giám đốc duyệt giá trị lớn.' };
  }
  if (action === 'ok') {
    await api.db.run(
      "UPDATE de_nghi_mua SET trang_thai='da_duyet', nguoi_duyet=$1, ngay_duyet=$2 WHERE id=$3",
      meId(api), api.db.today(), String(id)
    );
  } else {
    await api.db.run(
      "UPDATE de_nghi_mua SET trang_thai='tu_choi', ly_do_tu_choi=$1 WHERE id=$2",
      String(lyDo || ''), String(id)
    );
  }
  await api.db.audit('mua', 'de_nghi_mua', String(id), meId(api), action === 'ok' ? 'Duyệt' : 'Từ chối');
  return { ok: true, trang_thai: action === 'ok' ? 'da_duyet' : 'tu_choi' };
}

export async function dmDelete(api: KhoApi, id: string): Promise<{ ok: boolean; error?: string }> {
  await checkLock(api, 'mua', 'xoa');
  const d = await api.db.row<DeNghiMuaRow>("SELECT * FROM de_nghi_mua WHERE id=$1 AND deleted_at=''", String(id));
  if (!d) return { ok: false, error: 'Không thấy đề nghị.' };
  const nhap = await api.db.row<{ c: number }>(
    "SELECT COUNT(*) c FROM phieu_nhap WHERE ref_dm=$1 AND deleted_at=''", d.id
  );
  if ((nhap?.c || 0) > 0) return { ok: false, error: 'Đề nghị đã có phiếu nhập kho, không thể xoá.' };
  await api.db.softDelete('de_nghi_mua', 'id', String(id), meId(api));
  return { ok: true };
}

/* ---------------- nhập kho ---------------- */
/** Ghi thêm 1 mốc giá vào lịch sử giá vật tư (GĐ3.7: không xoá giá cũ). */
export async function ghiGiaLichSu(
  db: Db,
  vattuId: number,
  ten: string,
  gia: number,
  phieuId: string,
  nguon: string,
  ncc: string
): Promise<void> {
  if (Number(gia) <= 0) return;
  await db.run(
    'INSERT INTO vattu_gia_lich_su(vattu_id, ten, ngay, gia, phieu_id, nguon, ncc) VALUES($1,$2,$3,$4,$5,$6,$7)',
    Number(vattuId) || 0, String(ten || ''), db.today(), Number(gia) || 0,
    String(phieuId || ''), String(nguon || 'nhap_kho'), String(ncc || '')
  );
}

export async function giaLichSuList(api: KhoApi, vattuId?: number): Promise<unknown[]> {
  await checkLock(api, 'kho', 'xem');
  if (vattuId) {
    return api.db.rows(
      "SELECT * FROM vattu_gia_lich_su WHERE vattu_id=$1 AND deleted_at='' ORDER BY ngay DESC, id DESC LIMIT 200",
      Number(vattuId)
    );
  }
  return api.db.rows("SELECT * FROM vattu_gia_lich_su WHERE deleted_at='' ORDER BY ngay DESC, id DESC LIMIT 1000");
}

/** Xuất tự động CHỈ KHI NHẬP ĐỦ: khi mọi vật tư cần mua của SC đã nhận đủ,
 *  tạo đúng 1 phiếu xuất cho SC, set sc_vattu da_xuat, giảm tồn. Ngược lại chờ.
 *  `inTx=true` khi gọi từ trong transaction (vd phNhapCreate) — tránh nested transaction. */
export async function autoXuatSC(api: KhoApi, scId: string, inTx = false): Promise<string | null> {
  const sc = await api.db.row<{ id: string }>("SELECT id FROM phieu_sua WHERE id=$1 AND deleted_at=''", String(scId));
  if (!sc) return null;
  const needRows = await api.db.rows<import('./types.js').ScVattuRow>(
    "SELECT * FROM sc_vattu WHERE sc_id=$1 AND tt IN ('can_mua','da_mua') AND deleted_at=''",
    String(scId)
  );
  if (!needRows.length) return null;
  for (const r of needRows) {
    const req = Number(r.so_luong) || 0;
    const recvRow = await api.db.row<{ s: number }>(
      "SELECT COALESCE(SUM(so_luong),0) s FROM phieu_nh_ct WHERE ref_sc=$1 AND vattu_id=$2 AND deleted_at=''",
      String(scId), Number(r.vattu_id) || 0
    );
    const recv = Number(recvRow?.s || 0) || 0;
    if (recv < req) return null; // chưa đủ → chờ đợt nhập tiếp theo
  }
  const body = async (tx: Db): Promise<string> => {
    const phId = await tx.nextId('PXX');
    await tx.run('INSERT INTO phieu_xuat(id, ngay, nguoi_lap, ref_sc, ghi_chu) VALUES($1,$2,$3,$4,$5)',
      phId, tx.today(), meId(api), String(scId), 'Xuất tự động khi nhập đủ vật tư (liên thông)');
    let tong = 0;
    for (const r of needRows) {
      const cat = await vtById(tx, Number(r.vattu_id) || 0);
      if (!cat) continue;
      const sl = Number(r.so_luong) || 0;
      const gia = Number(r.gia_ngay) || Number(cat.gia) || 0;
      await tx.run(
        'INSERT INTO phieu_xuat_ct(ph_id, vattu_id, ten, donvi, so_luong, dgia, thanh, ref_sc) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        phId, cat.id, cat.name, cat.donvi, sl, gia, sl * gia, String(scId)
      );
      await tx.run('UPDATE vattu SET ton = ton - $1 WHERE id=$2', sl, cat.id);
      await tx.run("UPDATE sc_vattu SET tt='da_xuat' WHERE id=$1", r.id);
      tong += sl * gia;
    }
    await tx.audit('kho', 'phieu_xuat', String(phId), meId(api), 'Xuất tự động đủ vật tư cho SC ' + scId);
    return phId;
  };
  if (inTx) return body(api.db);
  return api.db.transaction((tx) => body(tx));
}

export async function phNhapList(
  api: KhoApi
): Promise<Array<PhieuNhapRow & { so_dong: number; tong: number }>> {
  await checkLock(api, 'kho', 'xem');
  const ps = await api.db.rows<PhieuNhapRow>("SELECT * FROM phieu_nhap WHERE deleted_at='' ORDER BY ngay DESC, id DESC");
  const out: Array<PhieuNhapRow & { so_dong: number; tong: number }> = [];
  for (const p of ps) {
    const c = await api.db.row<{ c: number }>(
      "SELECT COUNT(*) c FROM phieu_nh_ct WHERE ph_id=$1 AND deleted_at=''", p.id
    );
    const s = await api.db.row<{ s: number }>(
      "SELECT COALESCE(SUM(thanh),0) s FROM phieu_nh_ct WHERE ph_id=$1 AND deleted_at=''", p.id
    );
    out.push({ ...p, so_dong: Number(c?.c || 0), tong: Number(p.tong) || Number(s?.s || 0) });
  }
  return out;
}

export async function phNhapGet(
  api: KhoApi,
  id: string
): Promise<{ ph: PhieuNhapRow & { tong: number }; ct: PhieuNhapCtRow[] } | null> {
  await checkLock(api, 'kho', 'xem');
  const h = await api.db.row<PhieuNhapRow>("SELECT * FROM phieu_nhap WHERE id=$1 AND deleted_at=''", String(id));
  if (!h) return null;
  const ct = await api.db.rows<PhieuNhapCtRow>("SELECT * FROM phieu_nh_ct WHERE ph_id=$1 AND deleted_at='' ORDER BY id", id);
  const xuat = await api.db.row<{ id: string }>(
    "SELECT id FROM phieu_xuat WHERE ghi_chu LIKE $1 AND deleted_at='' ORDER BY id LIMIT 1",
    '%' + h.id + '%'
  );
  return { ph: { ...h, tong: h.tong || ct.reduce((a, x) => a + Number(x.thanh), 0) }, ct };
}

interface PhNhapItemInput {
  vattu_id?: number;
  ten?: string;
  donvi?: string;
  so_luong?: number;
  dgia?: number;
  dgia_tt?: number;
  dg_tt?: number;
  dg_dk?: number;
  sc_id?: string;
  ref_baogia?: string;
}
interface PhNhapRec {
  ref_dm?: string;
  loai_nhap?: string;
  items?: PhNhapItemInput[];
  nha_cc?: string;
  nguoi_giao?: string;
  ncc_dia_chi?: string;
  ncc_sdt?: string;
  ghi_chu?: string;
  thanh_ly?: Array<{ vattu_id?: number; ten?: string; donvi?: string; so_luong?: number; ly_do?: string; gia_thanh_ly?: number }>;
}

export async function phNhapCreate(
  api: KhoApi,
  rec: PhNhapRec | undefined
): Promise<{ ok: boolean; id?: string; tong?: number; loai_nhap?: string; error?: string }> {
  await checkLock(api, 'kho', 'tao');
  rec = rec || {};
  const loai = rec.loai_nhap === 'cu_hong' ? 'cu_hong' : 'moi';
  return api.db.transaction(async (tx) => {
    const id = await tx.nextId('PXN');
    let items: Array<{ vattu_id?: number; ten?: string; donvi?: string; so_luong?: number; dgia?: number; sc_id?: string; ref_baogia?: string }> = [];
    let refBaoGia = '';
    if (rec.ref_dm) {
      const dm = await tx.row<DeNghiMuaRow>('SELECT * FROM de_nghi_mua WHERE id=$1', rec.ref_dm);
      if (!dm || dm.trang_thai !== 'da_duyet') return { ok: false, error: 'Đề nghị mua chưa duyệt.' };
      items = await tx.rows<DmMuaCtRow>("SELECT * FROM dm_mua_ct WHERE dm_id=$1 AND deleted_at=''", rec.ref_dm);
      const bg = await tx.row<{ id: number }>(
        "SELECT id FROM bao_gia_ncc WHERE dm_id=$1 AND deleted_at='' ORDER BY id DESC LIMIT 1", rec.ref_dm
      );
      refBaoGia = bg ? String(bg.id) : '';
    } else if (Array.isArray(rec.items)) {
      items = rec.items.map((it) => ({
        vattu_id: it.vattu_id, ten: it.ten || '', donvi: it.donvi || '',
        so_luong: Number(it.so_luong) || 0, dgia: Number(it.dgia_tt) || Number(it.dgia) || 0,
        sc_id: it.sc_id || '', ref_baogia: it.ref_baogia || ''
      }));
    }
    if (!items.length) return { ok: false, error: 'Không có dòng hàng.' };
    await tx.run(
      'INSERT INTO phieu_nhap(id, ngay, nguoi_lap, nha_cc, nguoi_duyet, ref_dm, tong, ghi_chu, loai_nhap, nguoi_giao, ncc_dia_chi, ncc_sdt) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
      id, tx.today(), meId(api), rec.nha_cc || '', '', rec.ref_dm || '', 0,
      rec.ghi_chu || '', loai, rec.nguoi_giao || '', rec.ncc_dia_chi || '', rec.ncc_sdt || ''
    );
    const scIds: Record<string, number> = {};
    let tong = 0;
    for (const it of items) {
      const catid = Number(it.vattu_id) || 0;
      const cat = catid ? await vtById(tx, catid) : null;
      const sl = Number(it.so_luong) || 0;
      if (sl <= 0 || !cat) continue;
      const gia = Number(it.dgia) || Number((it as DmMuaCtRow).dg_tt) || Number((it as DmMuaCtRow).dg_dk) || Number(cat.gia) || 0;
      const scId = String(it.sc_id || '');
      const bgId = Number(it.ref_baogia) || Number(refBaoGia) || null;
      await tx.run(
        'INSERT INTO phieu_nh_ct(ph_id, vattu_id, ten, donvi, so_luong, dgia, thanh, ref_dm, ref_baogia, ref_sc, ncc, gia_ngay) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        id, cat.id, cat.name, cat.donvi, sl, gia, sl * gia,
        rec.ref_dm || '', bgId, scId, rec.nha_cc || '', gia
      );
      tong += sl * gia;
      if (loai === 'cu_hong') {
        // GĐ3.7: nhập vật tư cũ/hỏng → đưa vào kho hư hỏng riêng (ton_cu_hong), KHÔNG thay đổi tồn dùng.
        await tx.run('UPDATE vattu SET ton_cu_hong = ton_cu_hong + $1 WHERE id=$2', sl, cat.id);
      } else {
        await tx.run('UPDATE vattu SET ton = ton + $1, gia = $2 WHERE id=$3', sl, gia, cat.id);
        await ghiGiaLichSu(tx, cat.id, cat.name, gia, id, 'nhap_kho', rec.nha_cc || '');
        if (scId) {
          scIds[scId] = 1;
          await tx.run(
            "UPDATE sc_vattu SET tt='da_mua', ncc=$1, gia_ngay=$2 WHERE sc_id=$3 AND vattu_id=$4 AND tt='can_mua'",
            rec.nha_cc || '', gia, scId, catid
          );
        }
      }
    }
    // ghi bảng thanh lý vật tư cũ/hỏng (nếu có)
    if (loai === 'cu_hong' && Array.isArray(rec.thanh_ly)) {
      for (const t of rec.thanh_ly) {
        const sl = Number(t.so_luong) || 0;
        if (sl <= 0) continue;
        await tx.run(
          'INSERT INTO phieu_nhap_thanhly(ph_id, vattu_id, ten, donvi, so_luong, ly_do, gia_thanh_ly) VALUES($1,$2,$3,$4,$5,$6,$7)',
          id, Number(t.vattu_id) || 0, String(t.ten || ''), String(t.donvi || ''), sl,
          String(t.ly_do || ''), Number(t.gia_thanh_ly) || 0
        );
      }
    }
    const sumRow = await tx.row<{ s: number }>('SELECT COALESCE(SUM(thanh),0) s FROM phieu_nh_ct WHERE ph_id=$1', id);
    const sum = Number(sumRow?.s || 0);
    await tx.run('UPDATE phieu_nhap SET tong=$1 WHERE id=$2', sum, id);
    if (rec.ref_dm) await tx.run("UPDATE de_nghi_mua SET trang_thai='da_nhap' WHERE id=$1", rec.ref_dm);
    await tx.audit('kho', 'phieu_nhap', String(id), meId(api), 'Nhập kho ' + (loai === 'cu_hong' ? 'vật tư cũ/hỏng/thanh lý' : 'vật tư mới') + ' ' + id);
    // Liên thông: nếu nhập phục vụ SC → kiểm tra nhập đủ rồi mới xuất tự động (đúng 1 PXX/SC)
    for (const sid of Object.keys(scIds)) {
      await autoXuatSC({ db: tx, auth: api.auth, perm: api.perm }, sid, true);
    }
    return { ok: true, id, tong: sum, loai_nhap: loai };
  });
}

/* ---------------- xuất kho ---------------- */
export async function phXuatList(
  api: KhoApi
): Promise<Array<PhieuXuatRow & { tong: number; so_dong: number }>> {
  await checkLock(api, 'kho', 'xem');
  return api.db.rows<PhieuXuatRow & { tong: number; so_dong: number }>(
    "SELECT p.*, (SELECT COALESCE(SUM(thanh),0) FROM phieu_xuat_ct c WHERE c.ph_id=p.id AND c.deleted_at='') tong, " +
    "(SELECT COUNT(*) FROM phieu_xuat_ct c WHERE c.ph_id=p.id AND c.deleted_at='') so_dong " +
    "FROM phieu_xuat p WHERE p.deleted_at='' ORDER BY p.ngay DESC, p.id DESC"
  );
}

export async function phXuatGet(
  api: KhoApi,
  id: string
): Promise<{ ph: PhieuXuatRow & { tong: number }; ct: PhieuXuatCtRow[] } | null> {
  await checkLock(api, 'kho', 'xem');
  const h = await api.db.row<PhieuXuatRow>("SELECT * FROM phieu_xuat WHERE id=$1 AND deleted_at=''", String(id));
  if (!h) return null;
  const ct = await api.db.rows<PhieuXuatCtRow>("SELECT * FROM phieu_xuat_ct WHERE ph_id=$1 AND deleted_at='' ORDER BY id", id);
  return { ph: { ...h, tong: ct.reduce((a, x) => a + Number(x.thanh), 0) }, ct };
}

interface PhXuatItemInput {
  vattu_id?: number;
  so_luong?: number;
}
interface PhXuatRec {
  loai_xuat?: string;
  items?: PhXuatItemInput[];
  ref_sc?: string;
  ghi_chu?: string;
  nguoi_nhan?: string;
}

export async function phXuatCreate(
  api: KhoApi,
  rec: PhXuatRec | undefined
): Promise<{ ok: boolean; id?: string; tong?: number; loai_xuat?: string; error?: string }> {
  await checkLock(api, 'kho', 'xuat');
  rec = rec || {};
  const loai = rec.loai_xuat === 'cu_hong' ? 'cu_hong' : 'dung';
  const items = (rec.items || []).filter((i) => Number(i.so_luong) > 0);
  if (!items.length) return { ok: false, error: 'Không có hàng xuất.' };
  return api.db.transaction(async (tx) => {
    const id = await tx.nextId('PXX');
    await tx.run(
      'INSERT INTO phieu_xuat(id, ngay, nguoi_lap, ref_sc, ghi_chu, nguoi_nhan, loai_xuat) VALUES($1,$2,$3,$4,$5,$6,$7)',
      id, tx.today(), meId(api), rec.ref_sc || '', rec.ghi_chu || '', rec.nguoi_nhan || '', loai
    );
    let tong = 0;
    for (const it of items) {
      const cat = await vtById(tx, it.vattu_id || 0);
      if (!cat) continue;
      const sl = Number(it.so_luong) || 0;
      const isHh = loai === 'cu_hong';
      const col = isHh ? 'ton_cu_hong' : 'ton';
      const dgia = isHh ? 0 : cat.gia;
      const avail = Number((cat as unknown as Record<string, number>)[col]) || 0;
      if (avail < sl) throw new Error('Không đủ tồn ' + (isHh ? 'hư hỏng ' : '') + cat.name + '.');
      await tx.run('UPDATE vattu SET ' + col + ' = ' + col + ' - $1 WHERE id=$2', sl, cat.id);
      await tx.run('INSERT INTO phieu_xuat_ct(ph_id, vattu_id, ten, donvi, so_luong, dgia, thanh) VALUES($1,$2,$3,$4,$5,$6,$7)',
        id, cat.id, cat.name, cat.donvi, sl, dgia, sl * dgia);
      tong += sl * dgia;
      if (rec.ref_sc) {
        await tx.run("UPDATE sc_vattu SET tt='da_xuat' WHERE sc_id=$1 AND vattu_id=$2 AND deleted_at=''", rec.ref_sc, cat.id);
      }
    }
    const sumRow = await tx.row<{ s: number }>('SELECT COALESCE(SUM(thanh),0) s FROM phieu_xuat_ct WHERE ph_id=$1', id);
    const sum = Number(sumRow?.s || 0);
    await tx.audit('kho', 'phieu_xuat', String(id), meId(api), (loai === 'cu_hong' ? 'Xuất thanh lý kho hư hỏng ' : 'Xuất kho ') + id);
    return { ok: true, id, tong: sum, loai_xuat: loai };
  });
}

/* ---------------- Danh sách VT thanh lý ---------------- */
export async function thanhLyList(
  api: KhoApi,
  q?: { sc_id?: string }
): Promise<unknown[]> {
  await checkLock(api, 'kho', 'xem');
  let where = "t.deleted_at=''";
  const args: unknown[] = [];
  if (q && q.sc_id) {
    // Lọc theo SC: tìm các phiếu nhập (ph_id) có chi tiết ref_sc khớp.
    // LƯU Ý: sửa bug nguồn v3.6 (gốc so p.id với ref_sc — không bao giờ khớp).
    where += ' AND t.ph_id IN (SELECT ph_id FROM phieu_nh_ct WHERE ref_sc=$' + (args.length + 1) + ')';
    args.push(q.sc_id);
  }
  return api.db.rows(
    'SELECT t.*, v.name as vattu_ten, v.donvi, p.id as ph_nhap_id ' +
    'FROM phieu_nhap_thanhly t ' +
    'LEFT JOIN vattu v ON t.vattu_id = v.id ' +
    'LEFT JOIN phieu_nhap p ON t.ph_id = p.id ' +
    'WHERE ' + where + ' ORDER BY t.ngay_thanh_ly DESC LIMIT 500',
    ...args
  );
}

/* ---------------- GĐ3.7: vận hành 8 bước — bổ trợ kho/xưởng ---------------- */

/** A4: GĐ3.7 — Tự động tạo phiếu nhập VT cũ/hỏng + ghi bảng thanh lý từ danh sách VT
 *  loại thay thế (loai_xu_ly='thay_the') của SC. Chỉ khi SC còn trạng thái cho phép,
 *  tránh tạo trùng (đã có phiếu cu_hong ref_sc cho cùng SC → báo lỗi) — chống IDOR/bùng nổ dữ liệu. */
export async function autoGenCuHong(
  api: KhoApi,
  scId: string
): Promise<{ ok: boolean; id?: string; so_dong?: number; error?: string }> {
  await checkLock(api, 'kho', 'tao');
  scId = String(scId || '');
  const sc = await api.db.row<{ id: string; trang_thai: string }>("SELECT id, trang_thai FROM phieu_sua WHERE id=$1 AND deleted_at=''", scId);
  if (!sc) return { ok: false, error: 'Không tìm thấy phiếu sửa chữa.' };
  if (['dang_sua', 'cho_nghiem', 'da_hoan'].indexOf(sc.trang_thai) < 0) {
    return { ok: false, error: 'Chỉ tạo VT cũ/hỏng khi phiếu đang sửa/đã hoàn.' };
  }
  const trung = await api.db.row<{ c: number }>(
    "SELECT COUNT(*) c FROM phieu_nh_ct WHERE ref_sc=$1 AND ph_id IN (SELECT id FROM phieu_nhap WHERE loai_nhap='cu_hong' AND deleted_at='') AND deleted_at=''",
    scId
  );
  if (Number(trung && trung.c) > 0) return { ok: false, error: 'Phiếu này đã tạo nhập VT cũ/hỏng rồi.' };
  const thay = (await api.db.rows<import('./types.js').ScVattuRow>(
    "SELECT * FROM sc_vattu WHERE sc_id=$1 AND loai_xu_ly='thay_the' AND deleted_at=''", scId
  )).filter((v) => Number(v.so_luong) > 0);
  if (!thay.length) return { ok: false, error: 'Phiếu này không có vật tư loại thay thế.' };
  return api.db.transaction(async (tx) => {
    const id = await tx.nextId('PXN');
    await tx.run(
      'INSERT INTO phieu_nhap(id, ngay, nguoi_lap, nha_cc, tong, ghi_chu, loai_nhap) VALUES($1,$2,$3,$4,$5,$6,$7)',
      id, tx.today(), meId(api), 'Thu hồi nội bộ', 0,
      'Tự động từ SC ' + scId + ' (vật tư thay thế cũ/hỏng)', 'cu_hong'
    );
    for (const v of thay) {
      const sl = Number(v.so_luong) || 0;
      if (sl <= 0) continue;
      await tx.run(
        'INSERT INTO phieu_nh_ct(ph_id, vattu_id, ten, donvi, so_luong, dgia, thanh, ref_sc, ncc) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        id, Number(v.vattu_id) || 0, v.ten, v.donvi, sl, 0, 0, scId, 'Thu hồi nội bộ'
      );
      await tx.run('UPDATE vattu SET ton_cu_hong = ton_cu_hong + $1 WHERE id=$2', sl, Number(v.vattu_id) || 0);
      await tx.run(
        'INSERT INTO phieu_nhap_thanhly(ph_id, vattu_id, ten, donvi, so_luong, ly_do, gia_thanh_ly) VALUES($1,$2,$3,$4,$5,$6,$7)',
        id, Number(v.vattu_id) || 0, v.ten, v.donvi, sl, 'Thay thế — tự động từ SC ' + scId, 0
      );
    }
    await tx.audit('kho', 'phieu_nhap', String(id), meId(api), 'Tự động nhập VT cũ/hỏng từ SC ' + scId);
    return { ok: true, id, so_dong: thay.length };
  });
}

/** A5: GĐ3.7 — Danh sách đề nghị mua liên kết với 1 SC
 *  (qua dm_mua_ct.sc_id khi tạo bằng dmFromSC, hoặc phieu_nh_ct.ref_dm sau khi nhập kho). */
export async function dmListBySc(
  api: KhoApi,
  scId: string
): Promise<Array<DeNghiMuaRow & { so_dong: number; label: string }>> {
  await checkLock(api, 'mua', 'xem');
  scId = String(scId || '');
  const rows = await api.db.rows<DeNghiMuaRow & { so_dong: number }>(
    "SELECT DISTINCT d.*, (SELECT COUNT(*) FROM dm_mua_ct c WHERE c.dm_id=d.id AND c.deleted_at='') so_dong " +
    "FROM de_nghi_mua d " +
    "WHERE d.deleted_at='' AND ( " +
    "  d.id IN (SELECT dm_id FROM dm_mua_ct WHERE sc_id=$1 AND deleted_at='') " +
    "  OR d.id IN (SELECT ref_dm FROM phieu_nh_ct WHERE ref_sc=$2 AND deleted_at='' AND ref_dm<>'') " +
    ") ORDER BY d.ngay DESC, d.id DESC",
    scId, scId
  );
  return rows.map((d) => ({ ...d, label: DM_TT[d.trang_thai] || d.trang_thai }));
}
