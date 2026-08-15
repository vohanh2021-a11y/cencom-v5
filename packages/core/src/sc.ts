/**
 * sc.ts — Module Sửa chữa GĐ3 (port từ server/sc.js v3.6 — NGUYÊN logic).
 * Luồng: de_xuat → da_duyet (chia theo ngưỡng) → dang_sua → cho_nghiem → da_hoan
 * → da_quyet (quyết toán tạo lich_sua, do asset.ts).
 * Thay đổi so với v3.6: mọi hàm async (pg pool); audit/ghi bọc transaction
 * (audit nằm CÙNG transaction); nextId dùng executor hiện tại.
 */
import type { Db } from './db.js';
import type { PhieuSuaRow, ScCongViecRow, ScVattuRow, CongViecRow } from './types.js';

/* ---------- auth/perm helper (port giữ nguyên sc.js) ---------- */
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
  canApproveSC(db: Db, role: string, tong: number): Promise<boolean>;
  canQuyetToan(role: string): boolean;
  scNguong(db: Db): Promise<number>;
}

export const TT_LABEL: Record<string, string> = {
  de_xuat: 'Đề xuất',
  da_duyet: 'Đã duyệt',
  da_tong_duyet: 'Đã tổng duyệt',
  dang_sua: 'Đang sửa',
  cho_nghiem: 'Chờ nghiệm thu',
  da_hoan: 'Hoàn thành',
  da_quyet: 'Đã quyết toán',
  tu_choi: 'Từ chối',
};
export const CV_TT = { todo: 'Chưa làm', dang: 'Đang làm', hoan: 'Hoàn thành' };
export const ACTIVE_STATUS = ['de_xuat', 'da_duyet', 'dang_sua'];
export const LOAI_XU_LY = ['', 'thay_the', 'khac_phuc'];

export function vnd(n: number | string): string {
  return String(Number(n || 0).toLocaleString('vi-VN')).replace(/,/g, '.') + ' đ';
}

export interface ScApi {
  db: Db;
  auth: AuthLike;
  perm: PermLike;
}

function meId(api: ScApi): string {
  const u = api.auth.current();
  return u ? u.id || u.name : '';
}
function meRole(api: ScApi): string {
  const u = api.auth.current();
  return u ? u.role : '';
}
async function checkLock(api: ScApi, m: string, f: string): Promise<void> {
  const u = api.auth.current();
  if (!u) throw new Error('Chưa đăng nhập.');
  if (!(await api.perm.can(api.db, u.role, m, f))) throw new Error('Không đủ quyền: cần ' + m + '.' + f);
}

/* ---------------- Tính tổng ---------------- */
async function recalc(db: Db, scId: string): Promise<{ tongCong: number; tongVt: number; tong: number }> {
  const c = await db.row<{ s: number }>(
    "SELECT COALESCE(SUM(so_luong * don_gia),0) AS s FROM sc_congviec WHERE sc_id=$1 AND deleted_at=''",
    scId
  );
  const v = await db.row<{ s: number }>(
    "SELECT COALESCE(SUM(so_luong * (CASE WHEN gd_tt>0 THEN gd_tt ELSE gd_dk END)),0) AS s " +
      'FROM sc_vattu WHERE sc_id=$1 AND deleted_at=\'\'',
    scId
  );
  const tong = Number(c?.s || 0) + Number(v?.s || 0);
  await db.run('UPDATE phieu_sua SET tong_cong=$1, tong_vt=$2, tong=$3 WHERE id=$4', c?.s ?? 0, v?.s ?? 0, tong, scId);
  return { tongCong: Number(c?.s ?? 0), tongVt: Number(v?.s ?? 0), tong };
}

async function getSC(db: Db, id: string): Promise<PhieuSuaRow | undefined> {
  return db.row<PhieuSuaRow>("SELECT * FROM phieu_sua WHERE id=$1 AND deleted_at=''", String(id));
}

/* ---------------- Tạo phiếu ---------------- */
export async function scCreate(
  api: ScApi,
  rec: {
    bks?: string;
    phieu_kt?: string;
    mo_ta?: string;
    ghi_chu?: string;
    de_xuat_id?: string;
    ngay_du_kien?: string;
    tinh_trang_pt?: string;
    la_sua_ngoai?: boolean;
    don_vi_ngoai?: string;
    congviec?: Array<{
      congviec_id?: number;
      ten?: string;
      donvi?: string;
      so_luong?: number;
      don_gia?: number;
      ghi_chu?: string;
      tho_id?: string;
      stt?: number;
      nguyen_nhan?: string;
      loai_xu_ly?: string;
    }>;
    vattu?: Array<{
      vattu_id?: number;
      name?: string;
      ten?: string;
      donvi?: string;
      so_luong?: number;
      gd_dk?: number;
      stt?: number;
      nguyen_nhan?: string;
      loai_xu_ly?: string;
    }>;
  }
): Promise<{ ok: boolean; id?: string; tong?: number; error?: string }> {
  await checkLock(api, 'sc', 'tao');
  rec = rec || {};
  const bks = String(rec.bks || '').trim().toUpperCase();
  if (!bks) return { ok: false, error: 'Thiếu biển số xe.' };
  const xe = await api.db.xeByBks(bks);
  if (!xe) return { ok: false, error: 'Chưa có xe ' + bks + ' trong sổ.' };

  return api.db.transaction(async (tx) => {
    // Mã phiếu sửa chữa trong/ngoài khác nhau: SC- (nội) / SCN- (sửa chữa bên ngoài)
    const id = await tx.nextId(rec.la_sua_ngoai ? 'SCN' : 'SC');
    await tx.run(
      'INSERT INTO phieu_sua(id, bks, phieu_kt, nguoi_lap, ngay, mo_ta, trang_thai, ghi_chu, de_xuat_id, ngay_du_kien, tinh_trang_pt, la_sua_ngoai, don_vi_ngoai) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
      id,
      bks,
      rec.phieu_kt || '',
      meId(api),
      tx.today(),
      rec.mo_ta || '',
      'de_xuat',
      rec.ghi_chu || '',
      rec.de_xuat_id || '',
      rec.ngay_du_kien || '',
      rec.tinh_trang_pt || '',
      rec.la_sua_ngoai ? 1 : 0,
      String(rec.don_vi_ngoai || '')
    );
    for (const c of rec.congviec || []) {
      const cat = c.congviec_id
        ? await tx.row<CongViecRow>('SELECT * FROM congviec WHERE id=$1', c.congviec_id)
        : undefined;
      await tx.run(
        'INSERT INTO sc_congviec(sc_id, congviec_id, ten, donvi, so_luong, don_gia, thanh, ghi_chu, tho_id, tt, stt, nguyen_nhan, loai_xu_ly) ' +
          'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
        id,
        c.congviec_id || 0,
        cat ? cat.name : (c.ten || ''),
        cat ? cat.donvi : (c.donvi || ''),
        Number(c.so_luong) || 1,
        Number(c.don_gia) || (cat ? cat.don_gia : 0),
        0,
        c.ghi_chu || '',
        c.tho_id || '',
        'todo',
        Number(c.stt) || 0,
        String(c.nguyen_nhan || ''),
        LOAI_XU_LY.indexOf(c.loai_xu_ly || '') >= 0 ? c.loai_xu_ly : ''
      );
    }
    for (const v of rec.vattu || []) {
      const cat = v.vattu_id
        ? await tx.row<{ name: string; donvi: string; gia: number }>('SELECT * FROM vattu WHERE id=$1', v.vattu_id)
        : undefined;
      await tx.run(
        'INSERT INTO sc_vattu(sc_id, vattu_id, ten, donvi, so_luong, gd_dk, thanh, tt, stt, nguyen_nhan, loai_xu_ly) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
        id,
        v.vattu_id || 0,
        cat ? cat.name : (v.name || v.ten || ''),
        cat ? cat.donvi : (v.donvi || ''),
        Number(v.so_luong) || 0,
        Number(v.gd_dk) || (cat ? cat.gia : 0),
        0,
        'can_mua',
        Number(v.stt) || 0,
        String(v.nguyen_nhan || ''),
        LOAI_XU_LY.indexOf(v.loai_xu_ly || '') >= 0 ? v.loai_xu_ly : ''
      );
    }
    await syncPrices(tx, id);
    await recalc(tx, id);
    await tx.audit('sc', 'phieu_sua', id, meId(api), 'Tạo phiếu sửa chữa ' + id + ' cho ' + bks);
    const t = await recalc(tx, id);
    return { ok: true, id, tong: t.tong };
  });
}

async function syncPrices(db: Db, scId: string): Promise<void> {
  await db.run(
    'UPDATE sc_congviec SET don_gia = (SELECT don_gia FROM congviec c WHERE c.id = sc_congviec.congviec_id) ' +
      'WHERE sc_id=$1 AND congviec_id>0 AND don_gia=0',
    scId
  );
  await db.run(
    'UPDATE sc_vattu SET gd_dk = (SELECT gia FROM vattu v WHERE v.id = sc_vattu.vattu_id) ' +
      'WHERE sc_id=$1 AND vattu_id>0 AND gd_dk=0',
    scId
  );
}

/* ---------------- Danh sách / chi tiết ---------------- */
export async function scList(
  api: ScApi,
  q: { bks?: string; trang_thai?: string; tu?: string; den?: string; limit?: number } = {}
): Promise<Array<Record<string, unknown>>> {
  await checkLock(api, 'sc', 'xem');
  q = q || {};
  let sql =
    "SELECT p.*, (SELECT COUNT(*) FROM sc_congviec w WHERE w.sc_id=p.id AND w.deleted_at='') AS ncong, " +
    "(SELECT COUNT(*) FROM sc_vattu vv WHERE vv.sc_id=p.id AND vv.deleted_at='') AS nvt, " +
    '(SELECT u.name FROM users u WHERE u.id=p.nguoi_lap) AS nguoi_lap_name, ' +
    '(SELECT u.name FROM users u WHERE u.id=p.nguoi_duyet) AS nguoi_duyet_name ' +
    "FROM phieu_sua p WHERE p.deleted_at=''";
  const a: unknown[] = [];
  if (q.bks) {
    sql += ' AND upper(p.bks)=upper($' + (a.length + 1) + ')';
    a.push(q.bks);
  }
  if (q.trang_thai) {
    sql += ' AND p.trang_thai=$' + (a.length + 1);
    a.push(q.trang_thai);
  }
  if (q.tu) {
    sql += ' AND p.ngay>=$' + (a.length + 1);
    a.push(q.tu);
  }
  if (q.den) {
    sql += ' AND p.ngay<=$' + (a.length + 1);
    a.push(q.den);
  }
  const limit = Math.min(+(q.limit as number) || 500, 5000);
  sql += ' ORDER BY p.ngay DESC, p.id DESC LIMIT $' + (a.length + 1);
  a.push(limit);
  const raws = await api.db.rows<Record<string, unknown>>(sql, ...a);
  return raws.map((r) => ({
    id: r.id,
    bks: r.bks,
    phieu_kt: r.phieu_kt,
    nguoi_lap: r.nguoi_lap,
    nguoi_lap_name: r.nguoi_lap_name || r.nguoi_lap,
    ngay: r.ngay,
    mo_ta: r.mo_ta,
    trang_thai: r.trang_thai,
    nguoi_duyet: r.nguoi_duyet,
    tong_cong: r.tong_cong,
    tong_vt: r.tong_vt,
    tong: r.tong,
    ngay_du_kien: r.ngay_du_kien || '',
    ngay_bat_dau: r.ngay_bat_dau || '',
    nCong: r.ncong,
    nVt: r.nvt,
    label: TT_LABEL[String(r.trang_thai)],
    la_sua_ngoai: Number(r.la_sua_ngoai) || 0,
    don_vi_ngoai: r.don_vi_ngoai || '',
  }));
}

async function ktGet(api: ScApi, scId: string): Promise<Record<string, unknown> | null> {
  await checkLock(api, 'sc', 'xem');
  return (await api.db.row<Record<string, unknown>>("SELECT * FROM phieu_kiem_tu WHERE sc_id=$1 AND deleted_at=''", String(scId))) || null;
}
async function khGet(api: ScApi, scId: string): Promise<Record<string, unknown> | null> {
  await checkLock(api, 'sc', 'xem');
  return (await api.db.row<Record<string, unknown>>("SELECT * FROM ke_hoach_sc WHERE sc_id=$1 AND deleted_at=''", String(scId))) || null;
}

export async function scGet(
  api: ScApi,
  id: string
): Promise<{
  sc: PhieuSuaRow;
  label: string;
  nguoi_lap_name: string;
  nguoi_duyet_name: string;
  xe: { bks: string; hang: string; dong: string; nguyen_gia: number } | null;
  cong: ScCongViecRow[];
  vat: ScVattuRow[];
  bienBanNghiem: Record<string, unknown> | null;
  baoGiaCount: number;
  baoGias: Array<Record<string, unknown>>;
  phNhap: Array<Record<string, unknown>>;
  phXuat: Array<Record<string, unknown>>;
  kiemTu: Record<string, unknown> | null;
  keHoach: Record<string, unknown> | null;
  canEdit: boolean;
  canApprove: boolean;
  canTongDuyet: boolean;
  toUpper: number;
  canQuyet: boolean;
  canSetDeadline: boolean;
  myRole: string;
  myId: string;
} | null> {
  await checkLock(api, 'sc', 'xem');
  const r = await getSC(api.db, String(id));
  if (!r) return null;
  const u = api.auth.current();
  const cong = await api.db.rows<ScCongViecRow>(
    "SELECT * FROM sc_congviec WHERE sc_id=$1 AND deleted_at='' ORDER BY id",
    id
  );
  const vat = await api.db.rows<ScVattuRow>(
    "SELECT * FROM sc_vattu WHERE sc_id=$1 AND deleted_at='' ORDER BY id",
    id
  );
  const xe = await api.db.xeByBks(r.bks);
  const bbNghiem = await api.db.row<Record<string, unknown>>(
    "SELECT * FROM bien_ban_nghiem WHERE sc_id=$1 AND deleted_at='' ORDER BY id DESC LIMIT 1",
    id
  );
  const nguoiLapName = await api.db.row<{ name: string }>('SELECT name FROM users WHERE id=$1', r.nguoi_lap);
  const nguoiDuyetName = r.nguoi_duyet
    ? await api.db.row<{ name: string }>('SELECT name FROM users WHERE id=$1', r.nguoi_duyet)
    : undefined;
  // GĐ3.7 — bộ hồ sơ: đếm báo giá NCC đã xác nhận + phiếu nhập/xuất liên quan (BỎ ảnh/OCR)
  const baoGiaCount = await api.db.row<{ c: string }>(
    "SELECT COUNT(*) AS c FROM bao_gia_ncc WHERE sc_id=$1 AND deleted_at=''",
    id
  );
  const baoGias = await api.db.rows<Record<string, unknown>>(
    "SELECT id, ncc_ten, ngay, loai_chung_tu, ref_phieu_nhap FROM bao_gia_ncc WHERE sc_id=$1 AND deleted_at='' ORDER BY id",
    id
  );
  const dmRows = await api.db.rows<{ dm_id: string }>(
    "SELECT dm_id FROM bao_gia_ncc WHERE sc_id=$1 AND deleted_at='' AND dm_id<>''",
    id
  );
  const dmIds = dmRows.map((x) => x.dm_id);
  const phNhap = dmIds.length
    ? await api.db.rows<Record<string, unknown>>(
        "SELECT id, ngay, tong, loai_nhap FROM phieu_nhap WHERE deleted_at='' AND ref_dm IN (" +
          dmIds.map((_, i) => '$' + (i + 1)).join(',') +
          ') ORDER BY id',
        ...dmIds
      )
    : [];
  const phXuat = await api.db.rows<Record<string, unknown>>(
    "SELECT p.id, p.ngay, (SELECT COALESCE(SUM(thanh),0) FROM phieu_xuat_ct c WHERE c.ph_id=p.id AND c.deleted_at='') AS tong " +
      "FROM phieu_xuat p WHERE p.ref_sc=$1 AND p.deleted_at='' ORDER BY p.id",
    id
  );
  return {
    sc: r,
    label: TT_LABEL[r.trang_thai] || '',
    nguoi_lap_name: (nguoiLapName && nguoiLapName.name) || r.nguoi_lap,
    nguoi_duyet_name: (nguoiDuyetName && nguoiDuyetName.name) || '',
    xe: xe ? { bks: xe.bks, hang: xe.hang, dong: xe.dong, nguyen_gia: xe.nguyen_gia } : null,
    cong,
    vat,
    bienBanNghiem: bbNghiem || null,
    baoGiaCount: Number(baoGiaCount?.c ?? 0),
    baoGias,
    phNhap,
    phXuat,
    kiemTu: await ktGet(api, id),
    keHoach: await khGet(api, id),
    canEdit: ACTIVE_STATUS.indexOf(r.trang_thai) >= 0,
    canApprove: await api.perm.canApproveSC(api.db, u ? u.role : '', r.tong),
    canTongDuyet: r.trang_thai === 'da_duyet' && (await api.perm.canApproveSC(api.db, u ? u.role : '', r.tong)),
    toUpper: await api.perm.scNguong(api.db),
    canQuyet: api.perm.canQuyetToan(u ? u.role : ''),
    canSetDeadline: ['xuong', 'giamdoc', 'admin'].indexOf(u ? u.role : '') >= 0,
    myRole: u ? u.role : '',
    myId: meId(api),
  };
}

/* ---------------- Duyệt / từ chối ---------------- */
export async function scApprove(
  api: ScApi,
  id: string,
  action: 'ok' | 'no',
  lyDo?: string
): Promise<{ ok: boolean; trang_thai?: string; error?: string }> {
  await checkLock(api, 'sc', 'duy');
  const sc = await getSC(api.db, id);
  if (!sc) return { ok: false, error: 'Không tìm thấy phiếu.' };
  if (sc.trang_thai !== 'de_xuat') return { ok: false, error: 'Đang ' + TT_LABEL[sc.trang_thai] + ' — không duyệt được.' };
  if (!(await api.perm.canApproveSC(api.db, meRole(api), sc.tong))) {
    return { ok: false, error: 'Chưa đủ quyền duyệt (~' + vnd(sc.tong) + ') — cần Giám đốc.' };
  }
  return api.db.transaction(async (tx) => {
    if (action === 'ok') {
      await tx.run(
        "UPDATE phieu_sua SET trang_thai='da_duyet', nguoi_duyet=$1, ngay_duyet=$2, ly_do_tu_choi='' WHERE id=$3",
        meId(api),
        tx.today(),
        id
      );
    } else {
      await tx.run("UPDATE phieu_sua SET trang_thai='tu_choi', ly_do_tu_choi=$1 WHERE id=$2", String(lyDo || ''), id);
    }
    await tx.audit('approval', 'phieu_sua', id, meId(api), action === 'ok' ? 'Duyệt phiếu' : 'Từ chối phiếu');
    return { ok: true, trang_thai: action === 'ok' ? 'da_duyet' : 'tu_choi' };
  });
}

/* ---------------- Tổng duyệt kế hoạch (GĐ3.7: chốt 1 lần cuối) ---------------- */
export async function snapshotSC(
  db: Db,
  scId: string,
  nguoiChot: string,
  lyDo?: string
): Promise<{ sc: PhieuSuaRow; cong: ScCongViecRow[]; vat: ScVattuRow[]; baoGia: Array<Record<string, unknown>>; chot: { nguoi: string; ngay: string; lyDo: string } } | null> {
  const sc = await getSC(db, scId);
  if (!sc) return null;
  const cong = await db.rows<ScCongViecRow>(
    "SELECT * FROM sc_congviec WHERE sc_id=$1 AND deleted_at='' ORDER BY stt, id",
    scId
  );
  const vat = await db.rows<ScVattuRow>(
    "SELECT * FROM sc_vattu WHERE sc_id=$1 AND deleted_at='' ORDER BY stt, id",
    scId
  );
  const baoGia = await db.rows<Record<string, unknown>>(
    "SELECT * FROM bao_gia_ncc WHERE sc_id=$1 AND deleted_at='' ORDER BY id",
    scId
  );
  const snap = { sc, cong, vat, baoGia, chot: { nguoi: nguoiChot || '', ngay: db.today(), lyDo: lyDo || '' } };
  const json = JSON.stringify(snap);
  const exist = await db.row<{ id: number }>(
    "SELECT id FROM sc_phien_ban WHERE sc_id=$1 AND deleted_at=''",
    scId
  );
  if (exist) {
    await db.run('UPDATE sc_phien_ban SET snapshot=$1, nguoi_chot=$2, ngay_chot=$3 WHERE id=$4', json, nguoiChot || '', db.today(), exist.id);
  } else {
    await db.run('INSERT INTO sc_phien_ban(sc_id, nguoi_chot, ngay_chot, snapshot) VALUES($1,$2,$3,$4)', scId, nguoiChot || '', db.today(), json);
  }
  return snap;
}

export async function scTongDuyet(
  api: ScApi,
  id: string,
  action: 'ok' | 'no',
  lyDo?: string
): Promise<{ ok: boolean; trang_thai?: string; snapshot?: boolean; error?: string }> {
  await checkLock(api, 'sc', 'duy');
  const sc = await getSC(api.db, id);
  if (!sc) return { ok: false, error: 'Không tìm thấy phiếu.' };
  if (sc.trang_thai !== 'da_duyet') {
    return { ok: false, error: 'Phiếu đang ' + TT_LABEL[sc.trang_thai] + ' — chỉ tổng duyệt khi Đã duyệt.' };
  }
  if (!(await api.perm.canApproveSC(api.db, meRole(api), sc.tong))) {
    return { ok: false, error: 'Chưa đủ quyền tổng duyệt (~' + vnd(sc.tong) + ') — cần Giám đốc.' };
  }
  if (action === 'ok') {
    return api.db.transaction(async (tx) => {
      await snapshotSC(tx, id, meId(api));
      await tx.run(
        "UPDATE phieu_sua SET trang_thai='da_tong_duyet', nguoi_duyet=$1, ngay_duyet=$2, ly_do_tu_choi='' WHERE id=$3",
        meId(api),
        tx.today(),
        id
      );
      await tx.audit('tong-duyet', 'phieu_sua', id, meId(api), 'Tổng duyệt kế hoạch sửa chữa (đã lưu phiên bản)');
      return { ok: true, trang_thai: 'da_tong_duyet', snapshot: true };
    });
  }
  await api.db.run("UPDATE phieu_sua SET trang_thai='da_duyet', ly_do_tu_choi=$1 WHERE id=$2", String(lyDo || 'Từ chối tổng duyệt'), id);
  await api.db.audit('tong-duyet', 'phieu_sua', id, meId(api), 'Từ chối tổng duyệt: ' + String(lyDo || ''));
  return { ok: true, trang_thai: 'da_duyet' };
}

/* ---------------- Tiến độ ---------------- */
export async function scStart(api: ScApi, id: string): Promise<{ ok: boolean; error?: string }> {
  const sc = await getSC(api.db, id);
  if (!sc || (sc.trang_thai !== 'da_duyet' && sc.trang_thai !== 'da_tong_duyet')) {
    return { ok: false, error: 'Phiếu chưa sẵn sàng bắt đầu.' };
  }
  return api.db.transaction(async (tx) => {
    // GĐ3.7: khi chạy luôn lưu phiên bản kế hoạch đã duyệt (snapshot)
    const exist = await tx.row<{ id: number }>(
      "SELECT id FROM sc_phien_ban WHERE sc_id=$1 AND deleted_at=''",
      id
    );
    if (!exist) await snapshotSC(tx, id, meId(api));
    await khApplyToSC(tx, id);
    await tx.run("UPDATE phieu_sua SET trang_thai='dang_sua', ngay_bat_dau=$1 WHERE id=$2", tx.today(), id);
    await tx.audit('status', 'phieu_sua', id, meId(api), 'Bắt đầu sửa chữa');
    return { ok: true };
  });
}

/* ---------------- Hẹn trả xe (ngay_du_kien) — quản lý xưởng đặt ---------------- */
export async function scSetDeadline(
  api: ScApi,
  id: string,
  ngay: string
): Promise<{ ok: boolean; ngay_du_kien?: string; error?: string }> {
  await checkLock(api, 'sc', 'sua');
  if (['xuong', 'giamdoc', 'admin'].indexOf(meRole(api)) < 0) {
    return { ok: false, error: 'Chỉ quản lý xưởng đặt ngày hẹn trả xe.' };
  }
  const sc = await getSC(api.db, id);
  if (!sc) return { ok: false, error: 'Không tìm thấy phiếu.' };
  if (['de_xuat', 'tu_choi', 'da_quyet'].indexOf(sc.trang_thai) >= 0) {
    return { ok: false, error: 'Phiếu đang ' + TT_LABEL[sc.trang_thai] + ' — không đặt được ngày hẹn.' };
  }
  const d = String(ngay || '').trim();
  if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { ok: false, error: 'Ngày hẹn phải dạng YYYY-MM-DD.' };
  await api.db.run('UPDATE phieu_sua SET ngay_du_kien=$1 WHERE id=$2', d, String(id));
  await api.db.audit('deadline', 'phieu_sua', id, meId(api), 'Đặt ngày hẹn trả xe ' + (d || 'chưa rõ'));
  return { ok: true, ngay_du_kien: d };
}

export async function scWorkSet(
  api: ScApi,
  scId: string,
  itemId: number,
  patch: {
    ten?: string;
    so_luong?: number;
    don_gia?: number;
    tho_id?: string;
    tt?: string;
    ghi_chu?: string;
    stt?: number;
    nguyen_nhan?: string;
    loai_xu_ly?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  await checkLock(api, 'sc', 'sua');
  const sc = await getSC(api.db, scId);
  if (!sc || ACTIVE_STATUS.indexOf(sc.trang_thai) < 0) return { ok: false, error: 'Phiếu đang khóa.' };
  const rowsFound = await api.db.rows<{ id: number }>(
    "SELECT id FROM sc_congviec WHERE id=$1 AND sc_id=$2 AND deleted_at=''",
    itemId,
    scId
  );
  if (!rowsFound.length) return { ok: false, error: 'Không thấy hạng mục công việc.' };
  if (patch.ten !== undefined) await api.db.run('UPDATE sc_congviec SET ten=$1 WHERE id=$2', String(patch.ten), itemId);
  if (patch.so_luong !== undefined) await api.db.run('UPDATE sc_congviec SET so_luong=$1 WHERE id=$2', Number(patch.so_luong), itemId);
  if (patch.don_gia !== undefined && sc.trang_thai === 'de_xuat')
    await api.db.run('UPDATE sc_congviec SET don_gia=$1 WHERE id=$2', Number(patch.don_gia), itemId);
  if (patch.tho_id !== undefined) await api.db.run('UPDATE sc_congviec SET tho_id=$1 WHERE id=$2', String(patch.tho_id), itemId);
  if (patch.tt !== undefined) {
    if (['todo', 'dang', 'hoan'].indexOf(patch.tt) < 0) return { ok: false, error: 'Trạng thái công việc sai.' };
    await api.db.run('UPDATE sc_congviec SET tt=$1 WHERE id=$2', patch.tt, itemId);
  }
  if (patch.ghi_chu !== undefined) await api.db.run('UPDATE sc_congviec SET ghi_chu=$1 WHERE id=$2', String(patch.ghi_chu), itemId);
  if (patch.stt !== undefined) await api.db.run('UPDATE sc_congviec SET stt=$1 WHERE id=$2', Number(patch.stt) || 0, itemId);
  if (patch.nguyen_nhan !== undefined) await api.db.run('UPDATE sc_congviec SET nguyen_nhan=$1 WHERE id=$2', String(patch.nguyen_nhan), itemId);
  if (patch.loai_xu_ly !== undefined) {
    if (LOAI_XU_LY.indexOf(patch.loai_xu_ly) < 0) return { ok: false, error: 'Loại xử lý sai (thay_the/khac_phuc).' };
    await api.db.run('UPDATE sc_congviec SET loai_xu_ly=$1 WHERE id=$2', patch.loai_xu_ly, itemId);
  }
  await api.db.run('UPDATE sc_congviec SET thanh=so_luong*don_gia WHERE id=$1', itemId);
  await recalc(api.db, scId);
  await api.db.audit('work', 'sc_congviec', itemId, meId(api), 'Cập nhật công việc');
  return { ok: true };
}

export async function scWorkAdd(
  api: ScApi,
  scId: string,
  rec: {
    cat_id?: number;
    name?: string;
    donvi?: string;
    so_luong?: number;
    don_gia?: number;
    tho_id?: string;
    stt?: number;
    nguyen_nhan?: string;
    loai_xu_ly?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  await checkLock(api, 'sc', 'sua');
  const sc = await getSC(api.db, scId);
  if (!sc || ACTIVE_STATUS.indexOf(sc.trang_thai) < 0) return { ok: false, error: 'Phiếu đang khóa.' };
  const cat = rec && rec.cat_id
    ? await api.db.row<CongViecRow>('SELECT * FROM congviec WHERE id=$1', rec.cat_id)
    : undefined;
  await api.db.run(
    'INSERT INTO sc_congviec(sc_id, congviec_id, ten, donvi, so_luong, don_gia, thanh, ghi_chu, tho_id, tt, stt, nguyen_nhan, loai_xu_ly) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
    scId,
    rec.cat_id || 0,
    cat ? cat.name : (rec.name || ''),
    cat ? cat.donvi : (rec.donvi || ''),
    Number(rec.so_luong) || 1,
    Number(rec.don_gia) || (cat ? cat.don_gia : 0),
    0,
    '',
    rec.tho_id || '',
    'todo',
    Number(rec.stt) || 0,
    String(rec.nguyen_nhan || ''),
    LOAI_XU_LY.indexOf(rec.loai_xu_ly || '') >= 0 ? rec.loai_xu_ly : ''
  );
  await recalc(api.db, scId);
  return { ok: true };
}

export async function scWorkDel(api: ScApi, scId: string, itemId: number): Promise<{ ok: boolean }> {
  await checkLock(api, 'sc', 'sua');
  await api.db.softDelete('sc_congviec', 'id', itemId, meId(api));
  await recalc(api.db, scId);
  return { ok: true };
}

/* ---------------- Vật tư trong phiếu ---------------- */
export async function scVtAdd(
  api: ScApi,
  scId: string,
  rec: {
    vattu_id?: number;
    name?: string;
    donvi?: string;
    so_luong?: number;
    gd_dk?: number;
    stt?: number;
    nguyen_nhan?: string;
    loai_xu_ly?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  await checkLock(api, 'sc', 'sua');
  const sc = await getSC(api.db, scId);
  if (!sc || ACTIVE_STATUS.indexOf(sc.trang_thai) < 0) return { ok: false, error: 'Phiếu đang khóa.' };
  const cat = rec && rec.vattu_id
    ? await api.db.row<{ name: string; donvi: string; gia: number }>('SELECT * FROM vattu WHERE id=$1', rec.vattu_id)
    : undefined;
  await api.db.run(
    'INSERT INTO sc_vattu(sc_id, vattu_id, ten, donvi, so_luong, gd_dk, thanh, tt, stt, nguyen_nhan, loai_xu_ly) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
    scId,
    rec.vattu_id || 0,
    cat ? cat.name : (rec.name || ''),
    cat ? cat.donvi : (rec.donvi || ''),
    Number(rec.so_luong) || 0,
    Number(rec.gd_dk) || (cat ? cat.gia : 0),
    0,
    'can_mua',
    Number(rec.stt) || 0,
    String(rec.nguyen_nhan || ''),
    LOAI_XU_LY.indexOf(rec.loai_xu_ly || '') >= 0 ? rec.loai_xu_ly : ''
  );
  await recalc(api.db, scId);
  return { ok: true };
}

export async function scVtUpd(
  api: ScApi,
  scId: string,
  itemId: number,
  patch: {
    so_luong?: number;
    gd_tt?: number;
    gd_dk?: number;
    stt?: number;
    nguyen_nhan?: string;
    loai_xu_ly?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  await checkLock(api, 'sc', 'sua');
  const cur = await api.db.row<ScVattuRow>(
    "SELECT * FROM sc_vattu WHERE id=$1 AND sc_id=$2 AND deleted_at=''",
    itemId,
    scId
  );
  if (!cur) return { ok: false, error: 'Không thấy vật tư.' };
  if (patch.so_luong !== undefined) await api.db.run('UPDATE sc_vattu SET so_luong=$1 WHERE id=$2', Number(patch.so_luong), itemId);
  if (patch.gd_tt !== undefined) await api.db.run('UPDATE sc_vattu SET gd_tt=$1 WHERE id=$2', Number(patch.gd_tt), itemId);
  if (patch.gd_dk !== undefined) await api.db.run('UPDATE sc_vattu SET gd_dk=$1 WHERE id=$2', Number(patch.gd_dk), itemId);
  if (patch.stt !== undefined) await api.db.run('UPDATE sc_vattu SET stt=$1 WHERE id=$2', Number(patch.stt) || 0, itemId);
  if (patch.nguyen_nhan !== undefined) await api.db.run('UPDATE sc_vattu SET nguyen_nhan=$1 WHERE id=$2', String(patch.nguyen_nhan), itemId);
  if (patch.loai_xu_ly !== undefined) {
    if (LOAI_XU_LY.indexOf(patch.loai_xu_ly) < 0) return { ok: false, error: 'Loại xử lý sai (thay_the/khac_phuc).' };
    await api.db.run('UPDATE sc_vattu SET loai_xu_ly=$1 WHERE id=$2', patch.loai_xu_ly, itemId);
  }
  await api.db.run('UPDATE sc_vattu SET thanh=so_luong*(CASE WHEN gd_tt>0 THEN gd_tt ELSE gd_dk END) WHERE id=$1', itemId);
  await recalc(api.db, scId);
  return { ok: true };
}

export async function scVtDel(api: ScApi, scId: string, itemId: number): Promise<{ ok: boolean }> {
  await checkLock(api, 'sc', 'sua');
  await api.db.softDelete('sc_vattu', 'id', itemId, meId(api));
  await recalc(api.db, scId);
  return { ok: true };
}

/* ---------------- Hoàn / nghiệm thu ---------------- */
export async function scFinish(api: ScApi, scId: string): Promise<{ ok: boolean; error?: string }> {
  await checkLock(api, 'sc', 'sua');
  const sc = await getSC(api.db, scId);
  if (!sc || sc.trang_thai !== 'dang_sua') return { ok: false, error: 'Không ở giai đoạn đang sửa.' };
  const d = await api.db.row<{ n: number; done: number }>(
    "SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN tt='hoan' THEN 1 ELSE 0 END),0) AS done FROM sc_congviec WHERE sc_id=$1 AND deleted_at=''",
    scId
  );
  if (d && d.n > 0 && d.n !== d.done) return { ok: false, error: 'Còn công việc chưa hoàn thành.' };
  await api.db.run("UPDATE phieu_sua SET trang_thai='cho_nghiem' WHERE id=$1", scId);
  await api.db.audit('status', 'phieu_sua', scId, meId(api), 'Hoàn tất công việc — chờ nghiệm thu');
  return { ok: true };
}

export async function scNghiem(
  api: ScApi,
  scId: string,
  okNgh: boolean,
  lyNgh?: string,
  meta?: {
    ben_giao?: string;
    ben_nhan?: string;
    lai_xe?: string;
    bao_hanh_ngay?: string;
    ket_luan?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const role = meRole(api);
  if (['admin', 'quanly', 'giamdoc'].indexOf(role) < 0) return { ok: false, error: 'Chỉ quản lý/Giám đốc nghiệm thu.' };
  const sc = await getSC(api.db, scId);
  if (!sc || sc.trang_thai !== 'cho_nghiem') return { ok: false, error: 'Chưa sẵn sàng nghiệm thu.' };

  return api.db.transaction(async (tx) => {
    if (okNgh === false) {
      await tx.run("UPDATE phieu_sua SET trang_thai='dang_sua', ly_do_tu_choi=$1 WHERE id=$2", String(lyNgh || ''), scId);
    } else {
      await tx.run("UPDATE phieu_sua SET trang_thai='da_hoan', nguoi_nghiem=$1, ngay_nghiem=$2 WHERE id=$3", meId(api), tx.today(), scId);
      // GĐ3.7: lưu biên bản nghiệm thu & bàn giao (bên giao/nhận, bảo hành, kết luận) + tổng hợp
      if (meta && typeof meta === 'object') {
        const cvs = await tx.rows<ScCongViecRow>(
          "SELECT ten, so_luong, don_gia, thanh, gio_cong, tt FROM sc_congviec WHERE sc_id=$1 AND deleted_at=''",
          scId
        );
        const vts = await tx.rows<ScVattuRow>(
          "SELECT ten, so_luong, CASE WHEN gd_tt>0 THEN gd_tt ELSE gd_dk END AS dgia, thanh, tt FROM sc_vattu WHERE sc_id=$1 AND deleted_at=''",
          scId
        );
        const tongNhanCong = cvs.reduce((a, c) => a + (Number(c.so_luong) || 0) * (Number(c.don_gia) || 0), 0);
        const tongVatTu = vts.reduce((a, v) => a + (Number(v.so_luong) || 0) * (Number((v as ScVattuRow & { dgia: number }).dgia) || 0), 0);
        const chiTietJson = JSON.stringify({
          cong_viec: cvs.map((c) => ({ ...c, thanh: (Number(c.so_luong) || 0) * (Number(c.don_gia) || 0) })),
          vat_tu: vts.map((v) => ({ ...v, thanh: (Number(v.so_luong) || 0) * (Number((v as ScVattuRow & { dgia: number }).dgia) || 0) })),
        });
        await tx.run(
          'INSERT INTO bien_ban_nghiem(sc_id, bks, ngay, ben_giao, ben_nhan, lai_xe, bao_hanh_ngay, ket_luan, nguoi_lap, tong_vat_tu, tong_nhan_cong, chi_tiet_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
          scId,
          sc.bks,
          tx.today(),
          String(meta.ben_giao || ''),
          String(meta.ben_nhan || ''),
          String(meta.lai_xe || ''),
          String(meta.bao_hanh_ngay || ''),
          String(meta.ket_luan || 'Nghiệm thu đạt yêu cầu'),
          meId(api),
          tongVatTu,
          tongNhanCong,
          chiTietJson
        );
        await tx.audit('nghiem', 'bien_ban_nghiem', scId, meId(api), 'Lưu biên bản nghiệm thu & bàn giao');
      }
    }
    await tx.audit('nghiem-ul', 'phieu_sua', scId, meId(api), okNgh === false ? 'Nghiệm thu không đạt' : 'Nghiệm thu đạt');
    return { ok: true };
  });
}

/* ---------------- GĐ3.7.5: Bản kiểm tu (tách khỏi SC) ---------------- */
export async function ktSave(
  api: ScApi,
  rec: { sc_id?: string; bks?: string; chi_tiet?: unknown; ket_luan?: string }
): Promise<{ ok: boolean; id?: string; error?: string }> {
  await checkLock(api, 'sc', 'sua');
  rec = rec || {};
  const scId = String(rec.sc_id || '');
  const sc = await getSC(api.db, scId);
  if (!sc) return { ok: false, error: 'Không tìm thấy phiếu sửa chữa.' };
  if (ACTIVE_STATUS.indexOf(sc.trang_thai) < 0) return { ok: false, error: 'Phiếu đang khóa — không sửa kiểm tu.' };
  const bks = rec.bks || sc.bks;
  let chiTiet: string = rec.chi_tiet as string;
  if (chiTiet && typeof chiTiet !== 'string') {
    try {
      chiTiet = JSON.stringify(chiTiet);
    } catch {
      chiTiet = String(chiTiet);
    }
  }
  chiTiet = String(chiTiet || '');
  if (chiTiet.length > 60000) return { ok: false, error: 'Chi tiết kiểm tu quá dài.' };
  const ketLuan = String(rec.ket_luan || '');

  return api.db.transaction(async (tx) => {
    const exist = await tx.row<{ id: string }>(
      "SELECT id FROM phieu_kiem_tu WHERE sc_id=$1 AND deleted_at=''",
      scId
    );
    if (exist) {
      await tx.run('UPDATE phieu_kiem_tu SET bks=$1, ngay=$2, chi_tiet=$3, ket_luan=$4 WHERE id=$5', bks, tx.today(), chiTiet, ketLuan, exist.id);
      await tx.audit('kiemtu/sua', 'phieu_kiem_tu', exist.id, meId(api), 'Cập nhật bản kiểm tu SC ' + scId);
      return { ok: true, id: exist.id };
    }
    const id = await tx.nextId('KT');
    await tx.run(
      'INSERT INTO phieu_kiem_tu(id, sc_id, bks, nguoi_lap, ngay, chi_tiet, ket_luan) VALUES($1,$2,$3,$4,$5,$6,$7)',
      id,
      scId,
      bks,
      meId(api),
      tx.today(),
      chiTiet,
      ketLuan
    );
    await tx.audit('kiemtu/tao', 'phieu_kiem_tu', id, meId(api), 'Tạo bản kiểm tu SC ' + scId);
    return { ok: true, id };
  });
}

/* ---------------- GĐ3.7.5: Kế hoạch sửa chữa (mẫu 01) ---------------- */
export async function khSave(
  api: ScApi,
  rec: { sc_id?: string; hang_muc?: unknown; tong_du_kien?: number }
): Promise<{ ok: boolean; sc_id?: string; error?: string }> {
  rec = rec || {};
  const scId = String(rec.sc_id || '');
  const sc = await getSC(api.db, scId);
  if (!sc) return { ok: false, error: 'Không tìm thấy phiếu sửa chữa.' };
  const role = meRole(api);
  if (!(await api.perm.can(api.db, role, 'sc', 'kehoach')) && !(await api.perm.can(api.db, role, 'sc', 'sua'))) {
    return { ok: false, error: 'Không đủ quyền bổ sung kế hoạch sửa chữa.' };
  }
  if (['cho_nghiem', 'da_hoan', 'da_quyet'].indexOf(sc.trang_thai) >= 0) {
    return { ok: false, error: 'Phiếu đã nghiệm thu/quyết toán — không sửa kế hoạch.' };
  }
  let hangMuc: string = rec.hang_muc as string;
  if (hangMuc && typeof hangMuc !== 'string') {
    try {
      hangMuc = JSON.stringify(hangMuc);
    } catch {
      hangMuc = String(hangMuc);
    }
  }
  hangMuc = String(hangMuc || '');
  if (hangMuc.length > 60000) return { ok: false, error: 'Kế hoạch quá dài.' };
  const tong = Number(rec.tong_du_kien) || 0;

  return api.db.transaction(async (tx) => {
    const exist = await tx.row<{ sc_id: string }>('SELECT sc_id FROM ke_hoach_sc WHERE sc_id=$1', scId);
    if (exist) {
      await tx.run(
        'UPDATE ke_hoach_sc SET nguoi_bo_sung=$1, ngay=$2, hang_muc=$3, tong_du_kien=$4 WHERE sc_id=$5',
        meId(api),
        tx.today(),
        hangMuc,
        tong,
        scId
      );
      await tx.audit('kehoach/sua', 'ke_hoach_sc', scId, meId(api), 'Cập nhật kế hoạch sửa chữa SC ' + scId);
    } else {
      await tx.run(
        'INSERT INTO ke_hoach_sc(sc_id, nguoi_bo_sung, ngay, hang_muc, tong_du_kien) VALUES($1,$2,$3,$4,$5)',
        scId,
        meId(api),
        tx.today(),
        hangMuc,
        tong
      );
      await tx.audit('kehoach/tao', 'ke_hoach_sc', scId, meId(api), 'Tạo kế hoạch sửa chữa SC ' + scId);
    }
    return { ok: true, sc_id: scId };
  });
}

export async function khApplyToSC(db: Db, scId: string): Promise<boolean> {
  // Copy kế hoạch (mẫu 01) thành bộ công việc/vật tư thực tế khi SC chưa có dòng nào
  const kp = await db.row<{ hang_muc: string }>(
    "SELECT hang_muc FROM ke_hoach_sc WHERE sc_id=$1 AND deleted_at=''",
    scId
  );
  if (!kp || !kp.hang_muc) return false;
  try {
    const items = JSON.parse(kp.hang_muc) as Array<{
      loai: string;
      so_luong?: number;
      don_gia?: number;
      dgia?: number;
      vattu_id?: number;
      cat_id?: number;
      ten?: string;
      donvi?: string;
    }>;
    const nC = await db.row<{ n: string }>(
      "SELECT COUNT(*) AS n FROM sc_congviec WHERE sc_id=$1 AND deleted_at=''",
      scId
    );
    const nV = await db.row<{ n: string }>(
      "SELECT COUNT(*) AS n FROM sc_vattu WHERE sc_id=$1 AND deleted_at=''",
      scId
    );
    if (Number(nC?.n ?? 0) === 0 && Number(nV?.n ?? 0) === 0 && Array.isArray(items)) {
      for (const it of items) {
        const sl = Number(it.so_luong) || 0;
        const dg = Number(it.don_gia) || Number(it.dgia) || 0;
        if (it.loai === 'vt') {
          const cat = it.vattu_id
            ? await db.row<{ name: string; donvi: string }>('SELECT * FROM vattu WHERE id=$1', it.vattu_id)
            : undefined;
          await db.run(
            'INSERT INTO sc_vattu(sc_id, vattu_id, ten, donvi, so_luong, gd_dk, thanh, tt) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
            scId,
            it.vattu_id || 0,
            cat ? cat.name : it.ten,
            cat ? cat.donvi : it.donvi,
            sl,
            dg,
            0,
            'can_mua'
          );
        } else {
          const cat = it.cat_id
            ? await db.row<{ name: string; donvi: string }>('SELECT * FROM congviec WHERE id=$1', it.cat_id)
            : undefined;
          await db.run(
            'INSERT INTO sc_congviec(sc_id, congviec_id, ten, donvi, so_luong, don_gia, thanh, tt) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
            scId,
            it.cat_id || 0,
            cat ? cat.name : it.ten,
            cat ? cat.donvi : it.donvi,
            sl,
            dg,
            0,
            'todo'
          );
        }
      }
      await recalc(db, scId);
      return true;
    }
  } catch {
    /* bỏ qua JSON lỗi */
  }
  return false;
}

/* Phase 5: cache danh sách SC (phân theo role + filter) TTL 60s */
export async function scListCached(
  api: ScApi,
  cache: { cached<T>(k: string, ttl: number, fn: () => Promise<T>): Promise<T> },
  q: { bks?: string; trang_thai?: string; tu?: string; den?: string; limit?: number } = {}
): Promise<Array<Record<string, unknown>>> {
  const u = api.auth.current();
  const k = 'scList:' + (u ? u.role : '?') + ':' + JSON.stringify(q || {});
  return cache.cached(k, 60000, () => scList(api, q));
}

/* ---------------- danh mục công việc ---------------- */
export async function congViecList(api: ScApi): Promise<CongViecRow[]> {
  await checkLock(api, 'sc', 'xem');
  return api.db.rows<CongViecRow>("SELECT * FROM congviec WHERE deleted_at='' ORDER BY nhom, name");
}

export async function congViecSave(
  api: ScApi,
  rec: {
    id?: number;
    name?: string;
    code?: string;
    don_gia?: number;
    gio_cong?: number;
    nhom?: string;
    donvi?: string;
    mo_ta?: string;
  }
): Promise<{ ok: boolean; id?: number; error?: string }> {
  await checkLock(api, 'sc', 'sua');
  rec = rec || {};
  const name = String(rec.name || '').trim();
  if (!name) return { ok: false, error: 'Thiếu tên công việc.' };
  const code = String(rec.code || '').trim().toUpperCase() || 'CV-' + String(Date.now()).slice(-6);
  const gia = Number(rec.don_gia) || 0;
  const gioCong = Number(rec.gio_cong) || 0;
  const id = Number(rec.id) || 0;

  return api.db.transaction(async (tx) => {
    if (id) {
      const old = await tx.row<CongViecRow>("SELECT * FROM congviec WHERE id=$1 AND deleted_at=''", id);
      if (!old) return { ok: false, error: 'Không thấy công việc.' };
      await tx.run(
        'UPDATE congviec SET code=$1, name=$2, nhom=$3, donvi=$4, don_gia=$5, gio_cong=$6, mo_ta=$7 WHERE id=$8',
        code,
        name,
        rec.nhom || old.nhom,
        rec.donvi || old.donvi,
        gia,
        gioCong,
        rec.mo_ta || '',
        id
      );
      await tx.audit('sc', 'congviec', String(id), meId(api), 'Cập nhật công việc ' + name);
      return { ok: true, id };
    }
    const dup = await tx.row<{ id: number }>('SELECT id FROM congviec WHERE code=$1', code);
    if (dup) {
      await tx.run(
        'UPDATE congviec SET name=$1, nhom=$2, donvi=$3, gio_cong=$4, mo_ta=$5 WHERE id=$6',
        name,
        rec.nhom || '',
        rec.donvi || '',
        gioCong,
        rec.mo_ta || '',
        dup.id
      );
      return { ok: true, id: dup.id };
    }
    const ins = await tx.row<{ id: number }>(
      'INSERT INTO congviec(code, name, nhom, donvi, don_gia, gio_cong, mo_ta, active) VALUES($1,$2,$3,$4,$5,$6,$7,1) RETURNING id',
      code,
      name,
      rec.nhom || '',
      rec.donvi || '',
      gia,
      gioCong,
      rec.mo_ta || ''
    );
    await tx.audit('congviec/tao', 'congviec', String(ins ? ins.id : ''), meId(api), 'Tạo công việc ' + name);
    return { ok: true, id: ins ? ins.id : 0 };
  });
}

export async function congViecDel(api: ScApi, id: number): Promise<{ ok: boolean; error?: string }> {
  await checkLock(api, 'sc', 'sua');
  const row = await api.db.row<CongViecRow>("SELECT * FROM congviec WHERE id=$1 AND deleted_at=''", Number(id));
  if (!row) return { ok: false, error: 'Không thấy công việc.' };
  await api.db.softDelete('congviec', 'id', Number(id), meId(api));
  return { ok: true };
}

export default {
  TT_LABEL,
  CV_TT,
  ACTIVE_STATUS,
  LOAI_XU_LY,
  vnd,
  scCreate,
  scList,
  scGet,
  scApprove,
  scTongDuyet,
  snapshotSC,
  scStart,
  scSetDeadline,
  scWorkSet,
  scWorkAdd,
  scWorkDel,
  scVtAdd,
  scVtUpd,
  scVtDel,
  scFinish,
  scNghiem,
  ktSave,
  khSave,
  khApplyToSC,
  scListCached,
  congViecList,
  congViecSave,
  congViecDel,
};