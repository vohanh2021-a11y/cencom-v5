/**
 * asset.ts — Quyết toán sửa chữa + Lý lịch sửa chữa + Giá trị thực tế (GTTV) GĐ3.
 * GTTV = Nguyên giá − Khấu hao + Chi phí tích lũy.
 * Port server/asset.js v3.6. LƯU Ý schema v4: bao_gia_ncc KHÔNG còn cột
 * ocr_xac_nhan/anh_bao_gia (đã bỏ AI-OCR) — checkHoSo bước 3 chỉ đếm báo giá.
 */
import type { Db } from './db.js';
import * as cache from './cache.js';

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
export interface AssetApi {
  db: Db;
  auth: AuthLike;
  perm: PermLike;
}

function meId(api: AssetApi): string {
  const u = api.auth.current();
  return u ? (u.id || u.name) : '';
}
async function checkLock(api: AssetApi, m: string, f: string): Promise<void> {
  const u = api.auth.current();
  if (!u) throw new Error('Chưa đăng nhập.');
  if (!(await api.perm.can(api.db, u.role, m, f))) throw new Error('Không đủ quyền: cần ' + m + '.' + f);
}
export function vnd(n: number | string): string {
  return String(Number(n || 0).toLocaleString('vi-VN')).replace(/,/g, '.') + ' đ';
}
export async function khauHaoNam(api: AssetApi): Promise<number> {
  return Math.max(1, Number(await api.db.configGet('khau_hao_nam', '10')) || 10);
}

export async function khauHao(api: AssetApi, xe: { nguyen_gia?: number | null; nam_sx?: string | number | null }): Promise<number> {
  const nguyen = Number(xe && xe.nguyen_gia) || 0;
  if (nguyen <= 0) return 0;
  const now = new Date().getFullYear();
  const soNam = Math.max(0, now - (Number(xe.nam_sx) || now));
  const gioiHan = Math.min(soNam, await khauHaoNam(api));
  return Math.round((nguyen / (await khauHaoNam(api))) * gioiHan);
}

export async function chiTichLuy(api: AssetApi, bks: string): Promise<{ tong: number; soLan: number }> {
  const r = await api.db.row<{ s: number; n: number }>(
    "SELECT COALESCE(SUM(tong),0) s, COUNT(*) n FROM lich_sua WHERE bks=$1 AND deleted_at=''", bks
  );
  return { tong: r ? Number(r.s) || 0 : 0, soLan: r ? Number(r.n) : 0 };
}

/* ---------------- Quyết toán chi phí sửa chữa ---------------- */
/** Kiểm tra bộ hồ sơ 8 bước (GĐ3.7, QC206 Điều 2: không thanh toán khi thiếu hồ sơ). */
export async function checkHoSo(api: AssetApi, scId: string): Promise<{ ok: boolean; miss: string[] }> {
  const db = api.db;
  const miss: string[] = [];
  // 1. Kế hoạch sửa chữa (mẫu 01) hoặc mô tả SC
  const sc = await db.row<Record<string, unknown>>("SELECT * FROM phieu_sua WHERE id=$1 AND deleted_at=''", scId);
  if (!sc) return { ok: false, miss: ['phiếu sửa chữa'] };
  const keHoach = await db.row<Record<string, unknown>>("SELECT 1 FROM ke_hoach_sc WHERE sc_id=$1 AND deleted_at=''", scId);
  if (!sc.mo_ta && !keHoach) miss.push('Kế hoạch sửa chữa (mẫu 01)');
  // 2. Bản kiểm tu (phieu_kiem_tu) hoặc có ít nhất 1 công việc/vật tư
  const cv = await db.row<{ c: number }>("SELECT COUNT(*) c FROM sc_congviec WHERE sc_id=$1 AND deleted_at=''", scId);
  const vt = await db.row<{ c: number }>("SELECT COUNT(*) c FROM sc_vattu WHERE sc_id=$1 AND deleted_at=''", scId);
  const kiemTu = await db.row<Record<string, unknown>>("SELECT 1 FROM phieu_kiem_tu WHERE sc_id=$1 AND deleted_at=''", scId);
  if ((Number(cv?.c) + Number(vt?.c)) === 0 && !kiemTu) miss.push('Bản kiểm tu (chưa có công việc/vật tư/kiểm tu)');
  // 3. Báo giá NCC (có ≥1 báo giá) — v4 bỏ ảnh OCR nên chỉ đếm báo giá còn hiệu lực
  const bg = await db.row<{ c: number }>(
    "SELECT COUNT(*) c FROM bao_gia_ncc WHERE sc_id=$1 AND deleted_at=''", scId
  );
  if (Number(bg?.c) === 0) miss.push('Phiếu mua vật tư (báo giá NCC)');
  // 4. Nhập kho mới
  const pns = await db.rows<Record<string, unknown>>("SELECT * FROM phieu_nhap WHERE deleted_at=''");
  const pn = [];
  for (const p of pns) {
    if (p.loai_nhap !== 'cu_hong' && p.ref_dm) {
      const bgRef = await db.row<Record<string, unknown>>(
        "SELECT 1 FROM bao_gia_ncc WHERE dm_id=$1 AND deleted_at=''", String(p.ref_dm)
      );
      if (bgRef) { pn.push(p); break; }
    }
  }
  if (!pn.length) miss.push('Phiếu nhập kho vật tư mới');
  // 5. Xuất kho cho SC
  const px = await db.row<{ c: number }>("SELECT COUNT(*) c FROM phieu_xuat WHERE ref_sc=$1 AND deleted_at=''", scId);
  if (Number(px?.c) === 0) miss.push('Phiếu xuất kho vật tư cho phiếu sửa chữa');
  // 6. Nhập kho vật tư cũ/hỏng (không bắt buộc nếu phiếu không có vật tư thay thế)
  const pnCh = await db.rows<Record<string, unknown>>("SELECT * FROM phieu_nhap WHERE loai_nhap='cu_hong' AND deleted_at=''");
  const _hasCuHong = pnCh.some((p) => String(p.ghi_chu).indexOf(scId) >= 0);
  // 7. Biên bản nghiệm thu
  const bb = await db.row<{ c: number }>("SELECT COUNT(*) c FROM bien_ban_nghiem WHERE sc_id=$1 AND deleted_at=''", scId);
  if (Number(bb?.c) === 0 && sc.trang_thai !== 'da_hoan') miss.push('Biên bản nghiệm thu');
  if (Number(bb?.c) === 0 && sc.ngay_nghiem) miss.push('Biên bản nghiệm thu & bàn giao');
  // 8. Bảng kê chi tiết (tự sinh khi in — đánh dấu đủ nếu có tổng)
  if (Number(sc.tong) <= 0) miss.push('Bảng kê chi tiết (tổng chi phí = 0)');
  return { ok: miss.length === 0, miss };
}

/* ---------------- Tổng hợp nhân công sửa chữa bên ngoài ---------------- */
export async function ncNgoaiReport(api: AssetApi, q: Record<string, unknown> = {}): Promise<{ ok: boolean; rows: Array<Record<string, unknown>>; tong: Array<{ don_vi: string; tien: number; so_phieu: number }> }> {
  await checkLock(api, 'asset', 'xem');
  const db = api.db;
  const a: unknown[] = [];
  let sql = "SELECT w.sc_id, w.ten, w.so_luong, w.don_gia, (w.so_luong*w.don_gia) AS thanh, w.ghi_chu, w.tt, " +
    "p.bks, p.don_vi_ngoai, p.ngay, p.trang_thai " +
    "FROM sc_congviec w JOIN phieu_sua p ON p.id=w.sc_id " +
    "WHERE p.la_sua_ngoai=1 AND w.deleted_at='' AND p.deleted_at='' ";
  if (q.don_vi_ngoai) { sql += 'AND upper(p.don_vi_ngoai) LIKE upper($' + (a.length + 1) + ') '; a.push('%' + String(q.don_vi_ngoai) + '%'); }
  if (q.tu) { sql += 'AND p.ngay>=$' + (a.length + 1) + ' '; a.push(q.tu); }
  if (q.den) { sql += 'AND p.ngay<=$' + (a.length + 1) + ' '; a.push(q.den); }
  sql += 'ORDER BY p.don_vi_ngoai, p.ngay DESC, w.sc_id';
  const rows = await db.rows<Record<string, unknown>>(sql, ...a);
  const byUnit: Record<string, { don_vi: string; tien: number; so_phieu: Record<string, number> }> = {};
  rows.forEach((r) => {
    const k = String(r.don_vi_ngoai || '(chưa rõ)');
    byUnit[k] = byUnit[k] || { don_vi: k, tien: 0, so_phieu: {} };
    byUnit[k].tien += Number(r.thanh) || 0;
    byUnit[k].so_phieu[String(r.sc_id)] = 1;
  });
  const tong = Object.keys(byUnit).map((k) => {
    return { don_vi: byUnit[k]!.don_vi, tien: byUnit[k]!.tien, so_phieu: Object.keys(byUnit[k]!.so_phieu).length };
  });
  return { ok: true, rows, tong };
}

export async function quyetToan(api: AssetApi, args: { id?: string; ghi_chu?: string } = {}): Promise<{ ok: boolean; tong?: number; error?: string }> {
  await checkLock(api, 'asset', 'quyet');
  const db = api.db;
  const scId = String(args && args.id || '');
  const sc = await db.row<Record<string, unknown>>("SELECT * FROM phieu_sua WHERE id=$1 AND deleted_at=''", scId);
  if (!sc) return { ok: false, error: 'Không tìm thấy phiếu sửa chữa.' };
  if (sc.trang_thai !== 'da_hoan') {
    return { ok: false, error: 'Phiếu chưa nghiệm thu xong (đang: ' + String(sc.trang_thai) + ').' };
  }
  const hs = await checkHoSo(api, scId);
  if (!hs.ok) {
    return { ok: false, error: 'Thiếu hồ sơ quyết toán: ' + hs.miss.join(', ') + '.' };
  }
  const dup = await db.row<{ id: string }>("SELECT id FROM lich_sua WHERE sc_id=$1 AND deleted_at=''", scId);
  if (dup) return { ok: false, error: 'Phiếu đã quyết toán trước đó.' };
  const nguoi = meId(api);
  const ghiChu = String(args.ghi_chu || '');
  await db.transaction(async (tx) => {
    await tx.run(
      'INSERT INTO lich_sua(sc_id, bks, ngay, tong_cong, tong_vt, tong, nguoi, ghi_chu) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      scId, String(sc.bks), tx.today(), sc.tong_cong, sc.tong_vt, sc.tong, nguoi, ghiChu
    );
    await tx.run("UPDATE phieu_sua SET trang_thai='da_quyet' WHERE id=$1", scId);
    await tx.audit('asset', 'lich_sua', scId, nguoi, 'Quyết toán phiếu ' + scId + ' (' + vnd(Number(sc.tong)) + ')');
  });
  return { ok: true, tong: Number(sc.tong) };
}

/* ---------------- Lý lịch sửa chữa ---------------- */
export async function lichSuaList(api: AssetApi, q: Record<string, unknown> = {}): Promise<Array<Record<string, unknown>>> {
  await checkLock(api, 'asset', 'xem');
  const db = api.db;
  let sql = "SELECT * FROM lich_sua WHERE deleted_at=''";
  const a: unknown[] = [];
  if (q.bks) { sql += ' AND upper(bks)=upper($' + (a.length + 1) + ')'; a.push(q.bks); }
  const limit = Math.min(Number(q.limit) || 500, 5000);
  sql += ' ORDER BY ngay DESC, id DESC LIMIT ' + limit;
  return db.rows<Record<string, unknown>>(sql, ...a);
}

export async function assetXe(api: AssetApi, bks: string): Promise<Record<string, unknown> | null> {
  await checkLock(api, 'asset', 'xem');
  const db = api.db;
  const xe = await db.row<Record<string, unknown>>("SELECT * FROM xe WHERE upper(bks)=upper($1) AND deleted_at=''", String(bks));
  if (!xe) return null;
  const kh = await khauHao(api, xe as { nguyen_gia?: number | null; nam_sx?: string | number | null });
  const tich = await chiTichLuy(api, String(xe.bks));
  const nguyen = Number(xe.nguyen_gia) || 0;
  const gttv = nguyen - kh + tich.tong;
  return {
    xe: {
      bks: xe.bks, hang: xe.hang, dong: xe.dong, nam_sx: xe.nam_sx,
      lai_xe: xe.lai_xe, phong_ban: xe.phong_ban, trang_thai: xe.trang_thai
    },
    nguyen_gia: nguyen,
    khau_hao_nam: await khauHaoNam(api),
    khau_hao: kh,
    so_lan_sua: tich.soLan,
    chi_phi_tich_luy: tich.tong,
    gttv
  };
}

export async function assetReport(api: AssetApi): Promise<{ rows: Array<Record<string, unknown>>; tong: Record<string, number> }> {
  await checkLock(api, 'asset', 'xem');
  const db = api.db;
  const list = await db.rows<Record<string, unknown>>("SELECT * FROM xe WHERE deleted_at='' ORDER BY bks");
  const rows = [];
  for (const v of list) {
    const kh = await khauHao(api, v as { nguyen_gia?: number | null; nam_sx?: string | number | null });
    const t = await chiTichLuy(api, String(v.bks));
    const nguyen = Number(v.nguyen_gia) || 0;
    rows.push({
      bks: v.bks, hang: v.hang, dong: v.dong, nam_sx: v.nam_sx,
      phong_ban: v.phong_ban, trang_thai: v.trang_thai,
      nguyen_gia: nguyen, khau_hao: kh, so_lan_sua: t.soLan,
      chi_phi_tich_luy: t.tong, gttv: nguyen - kh + t.tong
    });
  }
  return {
    rows,
    tong: {
      nguyen_gia: rows.reduce((a, r) => a + r.nguyen_gia, 0),
      khau_hao: rows.reduce((a, r) => a + r.khau_hao, 0),
      chi_phi_tich_luy: rows.reduce((a, r) => a + r.chi_phi_tich_luy, 0),
      gttv: rows.reduce((a, r) => a + r.gttv, 0)
    }
  };
}

/* Phase 5: cache báo cáo tài sản (read-only, nặng) TTL 60s. Key theo role tránh lộ chéo. */
export function assetReportCached(api: AssetApi): Promise<{ rows: Array<Record<string, unknown>>; tong: Record<string, number> }> {
  const cur = api.auth.current();
  const role = (cur && cur.role) || '';
  return cache.cached('asset:report:' + role, 60000, () => assetReport(api));
}