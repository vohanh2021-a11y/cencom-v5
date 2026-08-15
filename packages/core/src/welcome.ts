/**
 * welcome.ts — Dữ liệu màn Trang chủ chào m��ng GĐ3 (sau đăng nhập).
 * Port server/welcome.js v3.6 — NGUY��N logic.
 * Nội dung biến thiên theo vai: th�� / kho / kế toán / quản lý / giám đốc / admin / lái xe / xưởng.
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
export interface WelcomeApi {
  db: Db;
  auth: AuthLike;
}

/** Ngày dạng yyyy-mm-dd với độ lệch ngày (0 = hôm nay, -1 = hôm qua). */
export function dateVN(offset: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p2 = (n: number): string => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Chúc ngày mới tốt lành';
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chúc tối vui vẻ';
}

export function viDate(): { thu: string; ngay: string; gio: string } {
  const d = new Date();
  const days = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  return {
    thu: days[d.getDay()]!,
    ngay: d.getDate() + ' tháng ' + (d.getMonth() + 1) + ', ' + d.getFullYear(),
    gio: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  };
}

export const SHORTCUTS: Record<string, Array<[string, string]>> = {
  tho: [['sc_new', 'Phiếu sửa chữa'], ['sc_my', 'Việc của tôi'], ['sc_list', 'Sửa chữa']],
  khoa: [['kho_ton', 'Tồn kho'], ['dm_new', 'Đề nghị mua'], ['sc_list', 'Sửa chữa']],
  ketoan: [['dm_pending', 'Duyệt mua'], ['qtoan', 'Quyết toán'], ['kho_ton', 'Kho']],
  quanly: [['dx_approve', 'Duyệt đề xuất'], ['sc_pending', 'Duyệt sửa'], ['asset', 'Tài sản']],
  giamdoc: [['sc_pending', 'Duyệt sửa'], ['dm_pending', 'Duyệt mua'], ['asset', 'Tài sản']],
  xuong: [['xuong', 'Bảng điều hành xưởng'], ['dx_new', 'Tạo đề xuất'], ['sc_list', 'Sửa chữa']],
  admin: [['perm', 'Phân quyền'], ['ids', 'Người dùng'], ['asset', 'Tài sản']]
};

async function cnt(db: Db, sql: string, ...params: unknown[]): Promise<number> {
  const r = await db.row<{ c: number }>(sql, ...params);
  return r ? (Number(r.c) || 0) : 0;
}

async function lowTonList(db: Db, limit = 8): Promise<Array<{ id: number; name: string; donvi: string; ton: number; ton_min: number; thieu: number }>> {
  const rows = await db.rows<Record<string, unknown>>(
    "SELECT * FROM vattu WHERE ton < ton_min AND deleted_at='' ORDER BY (ton_min - ton) DESC LIMIT " + limit
  );
  return rows.map((v) => ({
    id: Number(v.id), name: String(v.name), donvi: String(v.donvi),
    ton: Number(v.ton), ton_min: Number(v.ton_min),
    thieu: Math.max(0, Number(v.ton_min) - Number(v.ton))
  }));
}

export async function welcome(api: WelcomeApi): Promise<Record<string, unknown>> {
  const u = api.auth.current();
  const role = u ? u.role : '';
  const mid = (u && u.id) || '';
  const dd = viDate();
  const db = api.db;

  const stats = {
    xe: await cnt(db, "SELECT COUNT(*) c FROM xe WHERE deleted_at=''"),
    scChoDuyet: await cnt(db, "SELECT COUNT(*) c FROM phieu_sua WHERE trang_thai='de_xuat' AND deleted_at=''"),
    scDang: await cnt(db, "SELECT COUNT(*) c FROM phieu_sua WHERE trang_thai IN ('dang_sua','cho_nghiem') AND deleted_at=''"),
    scChoNghiem: await cnt(db, "SELECT COUNT(*) c FROM phieu_sua WHERE trang_thai='cho_nghiem' AND deleted_at=''"),
    dmChoDuyet: await cnt(db, "SELECT COUNT(*) c FROM de_nghi_mua WHERE trang_thai='cho_duyet' AND deleted_at=''"),
    lowTon: await cnt(db, "SELECT COUNT(*) c FROM vattu WHERE ton < ton_min AND deleted_at=''"),
    dxChoDuyet: await cnt(db, "SELECT COUNT(*) c FROM de_xuat_sua_chua WHERE trang_thai='cho_duyet' AND deleted_at=''"),
    dxDaDuyet: await cnt(db, "SELECT COUNT(*) c FROM de_xuat_sua_chua WHERE trang_thai='da_duyet' AND deleted_at=''"),
    chatUnread: await cnt(db, "SELECT COUNT(*) c FROM chat_messages WHERE to_id=$1 AND is_read=0", mid)
  };

  const myTasks: Array<Record<string, unknown>> = [];
  if (role === 'tho' || role === 'admin') {
    const jobs = await db.rows<Record<string, unknown>>(
      "SELECT w.id, w.sc_id, w.ten, w.tt, s.bks FROM sc_congviec w LEFT JOIN phieu_sua s ON s.id=w.sc_id " +
      "WHERE w.tho_id=$1 AND w.tt <> 'hoan' AND w.deleted_at='' ORDER BY w.id LIMIT 20", mid
    );
    jobs.forEach((w) => myTasks.push({ type: 'job', sc_id: w.sc_id, bks: w.bks, ten: w.ten, tt: w.tt }));
  }
  if (['quanly', 'giamdoc'].includes(role)) {
    const scs = await db.rows<Record<string, unknown>>(
      "SELECT * FROM phieu_sua WHERE trang_thai='de_xuat' AND deleted_at='' ORDER BY ngay DESC LIMIT 8"
    );
    scs.forEach((p) => myTasks.push({ type: 'approve_sc', sc_id: p.id, bks: p.bks, tong: p.tong }));
    myTasks.push({ type: 'note', text: 'Có ' + stats.scChoDuyet + ' phiếu sửa chữa đang chờ duyệt.' });
  }
  if (['ketoan', 'giamdoc'].includes(role)) {
    const dms = await db.rows<Record<string, unknown>>(
      "SELECT * FROM de_nghi_mua WHERE trang_thai='cho_duyet' AND deleted_at='' ORDER BY ngay DESC LIMIT 8"
    );
    dms.forEach((d) => myTasks.push({ type: 'approve_dm', dm_id: d.id, tong: d.tong }));
    myTasks.push({ type: 'note', text: 'Có ' + stats.dmChoDuyet + ' đề nghị mua đang chờ duyệt.' });
  }
  if (['quanly', 'giamdoc'].includes(role)) {
    const dxs = await db.rows<Record<string, unknown>>(
      "SELECT * FROM de_xuat_sua_chua WHERE trang_thai='cho_duyet' AND deleted_at='' ORDER BY ngay DESC LIMIT 8"
    );
    dxs.forEach((t) => myTasks.push({ type: 'approve_dx', dx_id: t.id, bks: t.bks, mo_ta: t.mo_ta }));
    myTasks.push({ type: 'note', text: 'Có ' + stats.dxChoDuyet + ' đề xuất sửa chữa đang chờ duyệt.' });
  }
  if (role === 'xuong') {
    const dxs = await db.rows<Record<string, unknown>>(
      "SELECT * FROM de_xuat_sua_chua WHERE trang_thai='da_duyet' AND deleted_at='' ORDER BY ngay ASC LIMIT 8"
    );
    dxs.forEach((t) => myTasks.push({ type: 'dx_to_sc', dx_id: t.id, bks: t.bks, mo_ta: t.mo_ta }));
    const scs = await db.rows<Record<string, unknown>>(
      "SELECT * FROM phieu_sua WHERE trang_thai='cho_nghiem' AND deleted_at='' ORDER BY ngay ASC LIMIT 8"
    );
    scs.forEach((p) => myTasks.push({ type: 'nghiem_sc', sc_id: p.id, bks: p.bks, tong: p.tong }));
    myTasks.push({ type: 'note', text: 'Có ' + stats.dxDaDuyet + ' đề xuất đã duyệt chờ tạo phiếu, ' +
      stats.scChoNghiem + ' phiếu chờ nghiệm thu.' });
  }

  const myToday = {
    xong: await cnt(db, "SELECT COUNT(*) c FROM sc_congviec WHERE tho_id=$1 AND tt='hoan' AND deleted_at=''", mid),
    con: await cnt(db, "SELECT COUNT(*) c FROM sc_congviec WHERE tho_id=$1 AND tt<>'hoan' AND deleted_at=''", mid)
  };
  const myYesterday = {
    xong: await cnt(db, "SELECT COUNT(*) c FROM lich_sua WHERE ngay=$1 AND nguoi=$2 AND deleted_at=''", dateVN(-1), mid)
  };

  const shortcutsForRole = (SHORTCUTS[role] ?? SHORTCUTS.admin)!;
  return {
    ok: true,
    me: { id: mid, name: u ? u.name : '', role },
    greeting: greeting(),
    thu: dd.thu, ngay: dd.ngay, gio: dd.gio,
    shortcuts: shortcutsForRole.map(([view, label]) => ({ view, label })),
    myToday,
    myYesterday,
    stats: {
      xe: stats.xe,
      scChoDuyet: stats.scChoDuyet,
      scDang: stats.scDang,
      dmChoDuyet: stats.dmChoDuyet,
      lowTon: stats.lowTon,
      dxChoDuyet: stats.dxChoDuyet,
      dxDaDuyet: stats.dxDaDuyet,
      chatUnread: stats.chatUnread
    },
    myTasks,
    lowTon: (['quanly', 'giamdoc', 'khoa', 'ketoan'].includes(role)) ? await lowTonList(db, 6) : []
  };
}