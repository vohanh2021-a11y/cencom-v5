import type { Db, PermLike } from './types';

export const ROLES = ['admin','giamdoc','xuong','ketoan','kho'] as const;

export const MATRIX: Record<string, Record<string,string[]>> = {
  // W2b: module `mua` — 'duy' = quyền DUYỆT DM TRÊN NGƯỠNG giá trị
  // (config `duyet_mua_nguong`). Nguồn v3.6: MATRIX mua.duy = {ketoan,
  // giamdoc} (perm.js:104–105) NHƯNG perm.canApproveMua (perm.js:118–123)
  // hard-code: chỉ admin/giamdoc vô hạn; ketoan bị chặn ở dmDecide core
  // (lib/core/kho.ts port NGUYÊN) ⇒ ở tầng MATRIX chỉ giamdoc mang 'duy'
  // (admin bypass sẵn ở can() dòng dưới). Module khác KHÔNG đụng.
  //
  // W3.5: module `sc` — 'duy' = duyệt/tổng-duyệt phiếu sửa chữa (scApprove/
  // scTongDuyet, ngưỡng config `duyet_sc_nguong`). Nguồn v3.6: MATRIX sc.duy =
  // {quanly, giamdoc} (perm.js:25–26) + hard-code canApproveSC (perm.js:112–117):
  //   admin/giamdoc VÔ HẠN; quanly chỉ khi tong ≤ ngưỡng; vai khác KHÔNG bao giờ.
  // v5 KHÔNG có role 'quanly' (users.role CHECK 5 vai — db/schema.sql dòng 7;
  // team vận hành v5 đã GỘP trách nhiệm quản lý vào 'xuong': see lib/core/xuong.ts
  // header — whitelist dashboard v3.6 {admin,giamdoc,quanly,xuong} map về sc.xem
  // của xuong/kho). ⇒ 'duy' giao giamdoc (vô hạn) + xuong (nhánh NGƯỠNG ≤
  // duyet_sc_nguong, thay vai quanly). Phán quyết ngưỡng enforce TRONG core
  // lib/core/sc.ts scApprove/scTongDuyet (cùng pattern W2b: MATRIX = cửa ma trận,
  // ngưỡng = lõi). ketoan/kho KHÔNG có 'duy' → 403 dispatch (đúng v3.6:
  // MATRIX v3.6 ketoan.sc và khoa.sc không 'duy').
  // W4-reg — module 'security'/'user'/'config' (lib/rpc.ts META đợt gộp):
  //  • security.doi_mk = TỰ đổi mật khẩu tài khoản của MÌNH (fn
  //    changePassword — lib/auth.ts:209, v3.6 publicFns handlers.js:668–674).
  //    CẤP cho MỌI vai: không phải quyền dữ liệu, và LUỒNG BUỘC phải mở —
  //    route /api/rpc chặn mọi fn khi must_change=1 (whitelist W4.1 port
  //    index.js:155); chặn fn này = deadlock tài khoản mới. Phán quyết thật
  //    (verify mk cũ + brute-force 5 lần/15' + cấm về default) ở LÕI auth.ts.
  //  • user/config ('admin') = quản trị tài khoản + ngưỡng duyệt. CHỈ ghi
  //    dưới admin để TÀI LIỆU HÓA ranh giới (can() dòng 33 bypass admin nên
  //    về cơ chế fail-closed do TẤC CẢ module ngoài ma trận — non-admin không
  //    có 'user'/'config' → dispatch 403 trước khi chạm core, core gateAdmin
  //    là lớp 2). KHÔNG cấp 2 module này cho vai nào khác.
  giamdoc: { xe:['xem'], sc:['xem','duy'], kho:['xem'], mua:['duy'], baogia:['xem'], hoso:['xem'], dashboard:['xem'], activityFeed:['xem'], report:['xem'], security:['doi_mk'] },
  admin:   { all:['all'], user:['admin'], config:['admin'], security:['doi_mk','admin'] },
  xuong:   { sc:['xem','tao','sua','kehoach','duy'], xe:['xem'], kho:['xem'], baogia:['xem'], hoso:['xem'], dashboard:['xem'], activityFeed:['xem'], security:['doi_mk'] },
  ketoan:  { baogia:['xem','tao'], hoso:['xem','tao','sua'], sc:['xem','kehoach'], kho:['xem'], xe:['xem'], report:['xem'], dashboard:['xem'], activityFeed:['xem'], security:['doi_mk'] },
  kho:     { kho:['xem','tao','sua','xuat'], xe:['xem'], sc:['xem'], baogia:['xem'], hoso:['xem'], dm:['xem','tao'], activityFeed:['xem'], security:['doi_mk'] },
};

export async function can(_db: Db, role: string, m: string, f: string): Promise<boolean> {
  if (role === 'admin') return true;
  const rm = MATRIX[role]; if (!rm) return false;
  if (rm.all?.includes('all')) return true;
  return !!rm[m]?.includes(f);
}
