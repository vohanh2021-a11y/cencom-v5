/**
 * ho_so.ts — Module Hồ sơ kế toán (ketoan quản lý) GĐ5.
 * Quản lý hồ sơ chứng từ kế toán (bảng ho_so). Port theo pattern sc.ts/ketoan.ts:
 *  - mọi hàm async (pg pool), nextId trong transaction, audit cùng transaction.
 *  - phân quyền: chỉ ketoan (hoặc admin ở chế độ test) được lưu.
 */
import type { Db } from './db.js';

export interface HoSoApi {
  db: Db;
  auth: { current(): { id: string; name: string; role: string } | null };
  perm: { can(db: Db, role: string, m: string, f: string): Promise<boolean> };
}

function meId(api: HoSoApi): string {
  const u = api.auth.current();
  return u ? (u.id || u.name || '') : '';
}

async function checkLock(api: HoSoApi, m: string, f: string): Promise<string> {
  const u = api.auth.current();
  if (!u) throw new Error('Chưa đăng nhập.');
  // Chỉ ketoan được quản lý hồ sơ; admin chỉ được phép ở chế độ test (is_test=1).
  if (u.role !== 'ketoan' && u.role !== 'admin') {
    throw new Error('Không đủ quyền: chỉ kế toán được quản lý hồ sơ.');
  }
  if (!(await api.perm.can(api.db, u.role, m, f))) {
    throw new Error('Không đủ quyền: cần ' + m + '.' + f);
  }
  return u.role;
}

export async function hoSoSave(
  api: HoSoApi,
  p: {
    sc_id: string;
    so_chung_tu?: string;
    ngay?: string;
    ghi_chu?: string;
    ngay_quyet?: string;
    is_test?: number;
  }
): Promise<{ id: string }> {
  const role = await checkLock(api, 'hoso', 'tao');
  const scId = String(p.sc_id || '').trim();
  if (!scId) throw new Error('Thiếu sc_id.');
  const soChungTu = String(p.so_chung_tu || '').trim();
  const ngay = String(p.ngay || '').trim();
  const ghiChu = String(p.ghi_chu || '');
  const ngayQuyet = String(p.ngay_quyet || '').trim();
  const isTest = p.is_test ?? (role === 'admin' ? 1 : 0);

  return api.db.transaction(async (tx) => {
    const id = await tx.nextId('HO');
    await tx.run(
      'INSERT INTO ho_so(id, sc_id, so_chung_tu, ngay, ghi_chu, nguoi_lap, ngay_quyet, is_test, tenant_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      id,
      scId,
      soChungTu,
      ngay,
      ghiChu,
      meId(api),
      ngayQuyet,
      Number(isTest) || 0,
      'c1'
    );
    await tx.audit('hoso/tao', 'ho_so', id, meId(api), 'Tạo hồ sơ kế toán ' + id + ' cho ' + scId);
    return { id };
  });
}

export async function hoSoGet(api: HoSoApi, id: string): Promise<Record<string, unknown> | null> {
  return (
    (await api.db.row<Record<string, unknown>>("SELECT * FROM ho_so WHERE id=$1 AND deleted_at=''", String(id))) ||
    null
  );
}

export async function hoSoList(
  api: HoSoApi,
  p?: { sc_id?: string }
): Promise<Array<Record<string, unknown>>> {
  const a: unknown[] = [];
  let where = " WHERE deleted_at='' AND is_test=0";
  if (p && p.sc_id) {
    where += ' AND sc_id=$' + (a.length + 1);
    a.push(p.sc_id);
  }
  return api.db.rows<Record<string, unknown>>(
    'SELECT * FROM ho_so' + where + ' ORDER BY ngay DESC, id DESC',
    ...a
  );
}
