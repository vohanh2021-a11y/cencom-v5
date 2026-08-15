/**
 * xuong.ts — Dashboard thời gian thực cho Quản lý xưởng GĐ3.6 (port server/xuong.js v3.6).
 * Tổng hợp từ các bảng hiện có (không tạo bảng mới).
 * LƯU Ý mapping schema v4: sc_congviec KHÔNG có cột `tien` (dùng `thanh`);
 * enum `tt` không có 'done'/'huy' (dùng 'hoan'/'') — đã map tương ứng (ghi chú mỗi chỗ).
 */
import type { Db } from './db.js';
import * as cache from './cache.js';

/* ---------- auth/perm helper (port giữ nguyên xuong.js) ---------- */
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
export interface XuongApi {
  db: Db;
  auth: AuthLike;
  perm: PermLike;
}

function meId(api: XuongApi): string {
  const u = api.auth.current();
  return u ? u.id : '';
}
async function checkLock(api: XuongApi, m: string, f: string): Promise<void> {
  const u = api.auth.current();
  if (!u) throw new Error('Chưa đăng nhập.');
  if (!(await api.perm.can(api.db, u.role, m, f))) throw new Error('Không đủ quyền: cần ' + m + '.' + f);
}
export function vnd(n: number | string): string {
  return String(Number(n || 0).toLocaleString('vi-VN')).replace(/,/g, '.') + ' đ';
}

async function deXuatMini(api: XuongApi, t: Record<string, unknown>): Promise<Record<string, unknown>> {
  const xe = await api.db.xeByBks(String(t.bks));
  return {
    id: t.id, bks: t.bks, ngay: t.ngay, mo_ta: t.mo_ta,
    muc_uu_tien: t.muc_uu_tien, trang_thai: t.trang_thai,
    nguoi_tao: t.nguoi_tao, sc_id: t.sc_id,
    xe: xe ? xe.hang + ' ' + xe.dong : ''
  };
}
function scMini(s: Record<string, unknown>): Record<string, unknown> {
  return {
    id: s.id, bks: s.bks, ngay: s.ngay, mo_ta: s.mo_ta,
    trang_thai: s.trang_thai, tong: s.tong, tong_vnd: vnd(Number(s.tong)),
    nguoi_lap: s.nguoi_lap, de_xuat_id: s.de_xuat_id || ''
  };
}

export async function xuongDashboard(api: XuongApi): Promise<Record<string, unknown>> {
  await checkLock(api, 'xuong', 'xem');
  const db = api.db;
  const today = db.today();

  const dxChoDuyet = await db.rows<Record<string, unknown>>(
    "SELECT * FROM de_xuat_sua_chua WHERE trang_thai='cho_duyet' AND deleted_at='' ORDER BY ngay ASC, id ASC"
  );
  const dxDaDuyet = await db.rows<Record<string, unknown>>(
    "SELECT * FROM de_xuat_sua_chua WHERE trang_thai='da_duyet' AND deleted_at='' ORDER BY ngay DESC, id DESC"
  );
  const dxMoiHomNayRow = await db.row<{ n: number }>(
    "SELECT COUNT(*) n FROM de_xuat_sua_chua WHERE ngay=$1 AND trang_thai<>'tu_choi' AND deleted_at=''", today
  );

  const scDangSua = await db.rows<Record<string, unknown>>(
    "SELECT * FROM phieu_sua WHERE trang_thai IN ('de_xuat','da_duyet','dang_sua') AND deleted_at='' ORDER BY ngay ASC, id ASC"
  );
  const scChoNghiem = await db.rows<Record<string, unknown>>(
    "SELECT * FROM phieu_sua WHERE trang_thai='cho_nghiem' AND deleted_at='' ORDER BY ngay ASC, id ASC"
  );
  const scHoanHomNay = await db.rows<Record<string, unknown>>(
    "SELECT * FROM phieu_sua WHERE ngay_nghiem=$1 AND trang_thai='da_hoan' AND deleted_at='' ORDER BY ngay_nghiem DESC", today
  );
  const scQuyetHomNay = await db.rows<Record<string, unknown>>(
    'SELECT * FROM lich_sua WHERE ngay=$1 ORDER BY id DESC', today
  );

  /* Công việc đang dở theo thợ */
  const congviecTheoTho = await db.rows<Record<string, unknown>>(
    "SELECT w.tho_id, u.name tho_name, COUNT(*) n " +
    "FROM sc_congviec w LEFT JOIN users u ON u.id=w.tho_id " +
    "WHERE w.tt IN ('todo','dang') AND w.deleted_at='' AND w.tho_id<>'' " +
    "GROUP BY w.tho_id, u.name ORDER BY n DESC"
  );
  const congviecChuaThoRow = await db.row<{ n: number }>(
    "SELECT COUNT(*) n FROM sc_congviec WHERE tt IN ('todo','dang') AND (tho_id='' OR tho_id IS NULL) AND deleted_at=''"
  );

  /* Vật tư dưới tồn min */
  const vtThieu = (await db.rows<Record<string, unknown>>(
    "SELECT * FROM vattu WHERE ton_min>0 AND ton<ton_min AND deleted_at='' ORDER BY (ton_min-ton) DESC"
  )).slice(0, 20);

  const tongSC = scDangSua.length + scChoNghiem.length;
  const tienQuyetHomNay = scQuyetHomNay.reduce((a, r) => a + Number(r.tong || 0), 0);

  return {
    today,
    de_xuat: {
      cho_duyet: await Promise.all(dxChoDuyet.map((t) => deXuatMini(api, t))),
      da_duyet: await Promise.all(dxDaDuyet.map((t) => deXuatMini(api, t))),
      moi_hom_nay: Number(dxMoiHomNayRow?.n || 0)
    },
    sc: {
      dang_sua: scDangSua.map(scMini),
      cho_nghiem: scChoNghiem.map(scMini),
      hoan_hom_nay: scHoanHomNay.map(scMini),
      quyet_toan_hom_nay: scQuyetHomNay.map((r) => ({
        id: r.id, sc_id: r.sc_id, bks: r.bks, tong: r.tong, tong_vnd: vnd(Number(r.tong))
      })),
      tong: tongSC,
      tien_quyet_hom_nay: vnd(tienQuyetHomNay)
    },
    tho: { congviec_theo_tho: congviecTheoTho, congviec_chua_tho: Number(congviecChuaThoRow?.n || 0) },
    vattu_thieu: vtThieu.map((v) => ({
      id: v.id, name: v.name, donvi: v.donvi, ton: v.ton, ton_min: v.ton_min,
      thieu: (Number(v.ton_min) || 0) - (Number(v.ton) || 0), gia: v.gia
    })),
    tien_quyet: vnd(tienQuyetHomNay)
  };
}

/* ---------------- Bảng điều khiển (quản lý/giám đốc/quản trị) ----------------
 * KPI toàn xưởng + Kanban tình trạng sửa chữa + tải công việc của thợ.
 * Không hiển thị cho kế toán (kế toán chỉ xem KPI tài chính/kho).
 * v3.6.2: Kanban simplified — 5 cột, 1 xe = 1 card (gộp nhiều SC). */
export async function dashboardAll(api: XuongApi): Promise<Record<string, unknown>> {
  const u = api.auth.current();
  if (!u) throw new Error('Chưa đăng nhập.');
  if (u.role === 'ketoan') {
    throw new Error('Kế toán không xem được Bảng điều khiển xưởng.');
  }
  if (!['admin', 'giamdoc', 'quanly', 'xuong'].includes(u.role)) {
    throw new Error('Không đủ quyền xem Bảng điều khiển.');
  }
  const db = api.db;
  const today = db.today();

  const count = async (sql: string, ...args: unknown[]): Promise<number> => {
    const r = await db.row<{ n: number }>(sql, ...args);
    return Number(r?.n || 0);
  };

  /* KPI */
  const kpi: Record<string, number> = {
    xe: await count("SELECT COUNT(*) n FROM xe WHERE deleted_at=''"),
    sc_de_xuat: await count("SELECT COUNT(*) n FROM phieu_sua WHERE trang_thai='de_xuat' AND deleted_at=''"),
    sc_cho_duyet: await count("SELECT COUNT(*) n FROM phieu_sua WHERE trang_thai IN ('de_xuat','da_duyet') AND deleted_at=''"),
    sc_dang_sua: await count("SELECT COUNT(*) n FROM phieu_sua WHERE trang_thai='dang_sua' AND deleted_at=''"),
    sc_cho_nghiem: await count("SELECT COUNT(*) n FROM phieu_sua WHERE trang_thai='cho_nghiem' AND deleted_at=''"),
    dx_cho_duyet: await count("SELECT COUNT(*) n FROM de_xuat_sua_chua WHERE trang_thai='cho_duyet' AND deleted_at=''"),
    dx_da_duyet: await count("SELECT COUNT(*) n FROM de_xuat_sua_chua WHERE trang_thai='da_duyet' AND deleted_at=''"),
    sc_hoan_hom_nay: await count("SELECT COUNT(*) n FROM phieu_sua WHERE ngay_nghiem=$1 AND trang_thai='da_hoan' AND deleted_at=''", today),
    tien_quyet_hom_nay: 0,
    vattu_thieu: await count("SELECT COUNT(*) n FROM vattu WHERE ton_min>0 AND ton<ton_min AND deleted_at=''"),
    chat_unread: await count("SELECT COUNT(*) c FROM chat_messages m WHERE m.to_id=$1 AND m.is_read=0", (u || {}).id)
  };
  const tienHomNay = await db.row<{ s: number }>('SELECT SUM(tong) s FROM lich_sua WHERE ngay=$1', today);
  kpi.tien_quyet_hom_nay = Number(tienHomNay && tienHomNay.s || 0);

  /* Kanban simplified: 5 cột, bỏ da_tong_duyet/da_hoan/da_quyet; 1 xe = 1 card */
  const STATUSES = ['de_xuat', 'da_duyet', 'dang_sua', 'cho_nghiem', 'tu_choi'];
  const COL_TT: Record<string, string> = { de_xuat: 'Đề xuất', da_duyet: 'Đã duyệt', dang_sua: 'Đang sửa', cho_nghiem: 'Chờ nghiệm thu', tu_choi: 'Từ chối' };
  const PRIORITY_ORDER = ['dang_sua', 'cho_nghiem', 'da_duyet', 'de_xuat', 'tu_choi'];

  const allSC = await db.rows<Record<string, unknown>>(
    "SELECT * FROM phieu_sua WHERE trang_thai IN ('de_xuat','da_duyet','dang_sua','cho_nghiem','tu_choi') AND deleted_at='' ORDER BY ngay ASC, id ASC"
  );

  const byBks: Record<string, Array<Record<string, unknown>>> = {};
  allSC.forEach((p) => {
    const bks = String(p.bks);
    if (!byBks[bks]) byBks[bks] = [];
    byBks[bks].push(p);
  });

  const grouped: Record<string, Array<Record<string, unknown>>> = {};
  STATUSES.forEach((s) => { grouped[s] = []; });

  for (const bks of Object.keys(byBks)) {
    const scs = byBks[bks]!;
    const xe = await db.xeByBks(bks);

    let primaryState = 'de_xuat';
    for (const st of PRIORITY_ORDER) {
      if (scs.some((p) => p.trang_thai === st)) { primaryState = st; break; }
    }

    const tongTien = scs.reduce((a, p) => a + (Number(p.tong) || 0), 0);
    const scIds = scs.map((p) => p.id);

    const topSC = scs.find((p) => p.trang_thai === primaryState) || scs[0];
    // LƯU Ý v4: sc_congviec không có tt='huy' — bỏ filter huy (enum không có), map 'hoan' thay 'done'
    const cong = await db.rows<Record<string, unknown>>(
      "SELECT * FROM sc_congviec WHERE sc_id=$1 AND deleted_at=''", String(topSC!.id)
    );
    const tongCong = cong.reduce((a, c) => a + (Number(c.thanh) || 0), 0); // v4: `thanh` thay `tien`
    const soHoan = cong.filter((c) => c.tt === 'hoan').length; // v4: 'hoan' thay 'done'
    const tt = cong.length ? Math.round(soHoan / cong.length * 100) : 0;
    const tho = cong.length
      ? ((await db.row<{ name: string }>('SELECT name FROM users WHERE id=$1', String(cong[0]!.tho_id)))?.name || '')
      : '';

    let eta: Record<string, unknown> | string = '';
    let etaNgay = '';
    for (const p of scs) {
      if (p.ngay_du_kien) {
        if (!etaNgay || String(p.ngay_du_kien) > etaNgay) {
          etaNgay = String(p.ngay_du_kien);
          const du = Date.parse(String(p.ngay_du_kien)) - Date.parse(today);
          eta = { ngay: p.ngay_du_kien, con: Math.ceil(du / 86400000) };
        }
      }
    }

    const scDetails = [];
    for (const p of scs) {
      const cv = await db.rows<Record<string, unknown>>(
        "SELECT * FROM sc_congviec WHERE sc_id=$1 AND deleted_at=''", String(p.id)
      );
      const cvHoan = cv.filter((c) => c.tt === 'hoan').length;
      scDetails.push({
        id: p.id, bks: p.bks, mo_ta: p.mo_ta || '', ngay: p.ngay,
        trang_thai: p.trang_thai, tong: p.tong, tong_vnd: vnd(Number(p.tong)),
        nguoi_lap: p.nguoi_lap || '', nguoi_duyet: p.nguoi_duyet || '',
        ngay_bat_dau: p.ngay_bat_dau || '', ngay_du_kien: p.ngay_du_kien || '',
        ngay_nghiem: p.ngay_nghiem || '', la_sua_ngoai: p.la_sua_ngoai || 0,
        so_cv: cv.length, so_cv_hoan: cvHoan,
        tho: cv.length
          ? ((await db.row<{ name: string }>('SELECT name FROM users WHERE id=$1', String(cv[0]!.tho_id)))?.name || '')
          : ''
      });
    }

    grouped[primaryState]!.push({
      bks, hang: xe ? xe.hang + ' ' + xe.dong : '', nam_sx: xe ? xe.nam_sx : '',
      sc_count: scs.length, tong_tien: tongTien, tong_tien_vnd: vnd(tongTien),
      sc_ids: scIds,
      sc_dang_sua: scs.filter((p) => p.trang_thai === 'dang_sua').length,
      sc_cho_nghiem: scs.filter((p) => p.trang_thai === 'cho_nghiem').length,
      sc_cho_duyet: scs.filter((p) => ['de_xuat', 'da_duyet'].includes(String(p.trang_thai))).length,
      phan_tram: tt, so_cv: cong.length, so_cv_hoan: soHoan,
      tho_chinh: tho, eta, sc_details: scDetails
    });
  }

  /* Sắp xếp card trong mỗi cột: ưu tiên trễ hạn trước */
  STATUSES.forEach((s) => {
    grouped[s]!.sort((a, b) => {
      const ea = a.eta && typeof a.eta === 'object' ? Number((a.eta as Record<string, unknown>).con) : 9999;
      const eb = b.eta && typeof b.eta === 'object' ? Number((b.eta as Record<string, unknown>).con) : 9999;
      return (isNaN(ea) ? 9999 : ea) - (isNaN(eb) ? 9999 : eb);
    });
  });

  /* Tải công việc theo thợ */
  const tho = await db.rows<Record<string, unknown>>(
    "SELECT w.tho_id, u.name tho_name, COUNT(*) n " +
    "FROM sc_congviec w LEFT JOIN users u ON u.id=w.tho_id " +
    "WHERE w.tt IN ('todo','dang') AND w.deleted_at='' AND w.tho_id<>'' " +
    "GROUP BY w.tho_id, u.name ORDER BY n DESC"
  );

  /* Báo cáo chi phí sửa chữa trong tháng */
  const ym = today.slice(0, 7);
  const bcRows = await db.rows<Record<string, unknown>>(
    "SELECT p.la_sua_ngoai, COALESCE(SUM(ls.tong),0) tong, COUNT(*) n " +
    "FROM lich_sua ls JOIN phieu_sua p ON p.id=ls.sc_id " +
    "WHERE ls.ngay LIKE $1 AND ls.deleted_at='' AND p.deleted_at='' " +
    "GROUP BY p.la_sua_ngoai", ym + '-%'
  );
  const bcTrong = bcRows.filter((r) => Number(r.la_sua_ngoai) === 0)[0] || { tong: 0, n: 0 };
  const bcNgoai = bcRows.filter((r) => Number(r.la_sua_ngoai) === 1)[0] || { tong: 0, n: 0 };
  const baocao_thang = {
    thang: ym,
    trong: { tien: Number(bcTrong.tong), so: Number(bcTrong.n) },
    ngoai: { tien: Number(bcNgoai.tong), so: Number(bcNgoai.n) },
    tong_tien: Number(bcTrong.tong) + Number(bcNgoai.tong),
    tong_so: Number(bcTrong.n) + Number(bcNgoai.n)
  };

  return {
    today,
    kpi: {
      xe: kpi.xe,
      sc_cho_duyet: kpi.sc_cho_duyet, sc_dang_sua: kpi.sc_dang_sua,
      sc_cho_nghiem: kpi.sc_cho_nghiem,
      dx_cho_duyet: kpi.dx_cho_duyet, dx_da_duyet: kpi.dx_da_duyet,
      sc_hoan_hom_nay: kpi.sc_hoan_hom_nay,
      tien_quyet_hom_nay: vnd(kpi.tien_quyet_hom_nay),
      vattu_thieu: kpi.vattu_thieu,
      chat_unread: kpi.chat_unread
    },
    cols: STATUSES.map((s) => ({ key: s, label: COL_TT[s], cards: grouped[s] })),
    tho,
    baocao_thang
  };
}

/* Phase 5: cache dashboard TTL 60s — key theo role để không lộ dữ liệu chéo. */
function _role(api: XuongApi): string {
  const u = api.auth.current();
  return u ? (u.role || '') : '';
}
export function xuongDashboardCached(api: XuongApi): Promise<Record<string, unknown>> {
  return cache.cached('dash:xuong:' + _role(api), 60000, () => xuongDashboard(api));
}
export function dashboardAllCached(api: XuongApi): Promise<Record<string, unknown>> {
  return cache.cached('dash:all:' + _role(api), 60000, () => dashboardAll(api));
}