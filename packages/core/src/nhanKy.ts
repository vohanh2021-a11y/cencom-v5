/**
 * nhanKy.ts — Chữ ký (GĐ3.7): tên + vùng ký tay + chữ ký số base64 trên từng phiếu.
 * Port server/nhanKy.js v3.6 — NGUY��N logic.
 * Mỗi phiếu (phieu_loai + phieu_id) có nhiều vị trí (nguoi_lap, thu_kho, lai_xe...).
 * In ra giấy: hiển thị tên + vùng để ký tay; nếu có chu_ky_data thì in ảnh chữ ký.
 */
import type { Db } from './db.js';

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
export interface NhanKyApi {
  db: Db;
  auth: AuthLike;
  perm: PermLike;
}

export const VI_TRI_LABEL: Record<string, string> = {
  nguoi_lap: 'Người lập', thu_kho: 'Thủ kho', lai_xe: 'Lái xe',
  kt_truong: 'Kế toán trưởng', xuong: 'Quản lý xưởng',
  ben_giao: 'Bên giao', ben_nhan: 'Bên nhận', giam_doc: 'Giám đốc'
};

function meId(api: NhanKyApi): string {
  const u = api.auth.current();
  return u ? (u.id || u.name) : '';
}
async function checkLock(api: NhanKyApi, m: string, f: string): Promise<void> {
  const u = api.auth.current();
  if (!u) throw new Error('Chưa đăng nhập.');
  if (!(await api.perm.can(api.db, u.role, m, f))) throw new Error('Không đủ quyền: cần ' + m + '.' + f);
}

export async function nhanKyList(
  api: NhanKyApi,
  phieuLoai: string,
  phieuId: string
): Promise<Array<Record<string, unknown> & { vi_tri_label: string }>> {
  await checkLock(api, 'sc', 'xem');
  const rows = await api.db.rows<Record<string, unknown>>(
    "SELECT * FROM nhan_ky WHERE phieu_loai=$1 AND phieu_id=$2 AND deleted_at='' ORDER BY id",
    String(phieuLoai), String(phieuId)
  );
  return rows.map((k) => ({ ...k, vi_tri_label: VI_TRI_LABEL[k.vi_tri as string] || String(k.vi_tri) }));
}

export async function nhanKySet(
  api: NhanKyApi,
  phieuLoai: string,
  phieuId: string,
  patches: Array<{ vi_tri?: string; nguoi_ky?: string; chu_ky_data?: string }>
): Promise<{ ok: boolean; error?: string }> {
  await checkLock(api, 'sc', 'sua');
  if (!Array.isArray(patches) || !patches.length) return { ok: false, error: 'Thiếu chữ ký.' };
  const db = api.db;
  for (const p of patches) {
    const viTri = String(p.vi_tri || '').trim();
    if (!viTri) continue;
    const nguoiKy = String(p.nguoi_ky || '').trim();
    const chuKy = String(p.chu_ky_data || '').trim();
    if (chuKy && chuKy.length > 2e6) throw new Error('��nh chữ ký quá lớn.');
    const exist = await db.row<{ id: number }>(
      "SELECT id FROM nhan_ky WHERE phieu_loai=$1 AND phieu_id=$2 AND vi_tri=$3 AND deleted_at=''",
      String(phieuLoai), String(phieuId), viTri
    );
    if (exist) {
      await db.run('UPDATE nhan_ky SET nguoi_ky=$1, chu_ky_data=$2, ngay_ky=$3 WHERE id=$4',
        nguoiKy, chuKy, db.today(), exist.id);
    } else {
      await db.run('INSERT INTO nhan_ky(phieu_loai, phieu_id, vi_tri, nguoi_ky, chu_ky_data, ngay_ky) VALUES($1,$2,$3,$4,$5,$6)',
        String(phieuLoai), String(phieuId), viTri, nguoiKy, chuKy, db.today());
    }
  }
  await db.audit('sign', 'nhan_ky', String(phieuId), meId(api), 'Cập nhật chữ ký ' + phieuLoai);
  return { ok: true };
}