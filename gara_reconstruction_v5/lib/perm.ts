import type { Db, PermLike } from './types';

export const ROLES = ['admin','giamdoc','xuong','ketoan','kho'] as const;

export const MATRIX: Record<string, Record<string,string[]>> = {
  // W2b: module `mua` — 'duy' = quyền DUYỆT DM TRÊN NGƯỠNG giá trị
  // (config `duyet_mua_nguong`). Nguồn v3.6: MATRIX mua.duy = {ketoan,
  // giamdoc} (perm.js:104–105) NHƯNG perm.canApproveMua (perm.js:118–123)
  // hard-code: chỉ admin/giamdoc vô hạn; ketoan bị chặn ở dmDecide core
  // (lib/core/kho.ts port NGUYÊN) ⇒ ở tầng MATRIX chỉ giamdoc mang 'duy'
  // (admin bypass sẵn ở can() dòng dưới). Module khác KHÔNG đụng.
  giamdoc: { xe:['xem'], sc:['xem'], kho:['xem'], mua:['duy'], baogia:['xem'], hoso:['xem'], dashboard:['xem'], activityFeed:['xem'], report:['xem'] },
  admin:   { all:['all'] },
  xuong:   { sc:['xem','tao','sua','kehoach'], xe:['xem'], kho:['xem'], baogia:['xem'], hoso:['xem'], dashboard:['xem'], activityFeed:['xem'] },
  ketoan:  { baogia:['xem','tao'], hoso:['xem','tao','sua'], sc:['xem','kehoach'], kho:['xem'], xe:['xem'], report:['xem'], dashboard:['xem'], activityFeed:['xem'] },
  kho:     { kho:['xem','tao','sua','xuat'], xe:['xem'], sc:['xem'], baogia:['xem'], hoso:['xem'], dm:['xem','tao'], activityFeed:['xem'] },
};

export async function can(_db: Db, role: string, m: string, f: string): Promise<boolean> {
  if (role === 'admin') return true;
  const rm = MATRIX[role]; if (!rm) return false;
  if (rm.all?.includes('all')) return true;
  return !!rm[m]?.includes(f);
}
