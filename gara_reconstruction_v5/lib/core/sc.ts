import type { Api } from '../types';
import type { PoolClient } from 'pg';
import { row, run, nextId, withTransaction } from '../db';
import { logActivity } from './activity';
import { checkHoSo } from './ho_so';
import { createScopedLogger } from '../observability';
import { invalidateDashCache, vnd } from './xuong'; // W3.2-wire: ghi xong luồng SC → lạnh dashboard xưởng; vnd: port v3.6 sc.js:30

const log = createScopedLogger('sc');

// Enum trạng thái phiếu sửa chữa (db/schema.sql CHECK).
// W3.5: thêm 'da_duyet' theo thứ tự luồng v3.6 sc.js:3 (đề xuất → duyệt theo ngưỡng →
// đang sửa → …). 'tu_choi' nhánh phải (scTuChoi/scApprove từ chối giữ nguyên ở v5).
const TT = ['de_xuat', 'da_duyet', 'dang_sua', 'da_hoan', 'da_quyet', 'tu_choi'];
// Loại xử lý hợp lệ (db/schema.sql sc_congviec CHECK)
const LOAI_XU_LY = ['thay_moi', 'sua_chua', 'bao_duong', 'khac'];
// Chỉ admin/ketoan được quyết toán (v3.6 perm.canQuyetToan() — v5 đã siết khỏi giamdoc/xuong)
const _QUYET_TOAN_ROLES = ['ketoan', 'admin']; // eslint-disable-line no-unused-vars

function requireStr(v: any, label: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new Error('Thiếu ' + label);
  return v.trim();
}

/** Chuỗi khi có cung cấp (field optional) — chặn object/array/type-confusion injection */
function optionalStr(v: any, label: string): void {
  if (v !== undefined && v !== null && v !== '' && typeof v !== 'string') {
    throw new Error(label + ' không hợp lệ');
  }
}

/** Số dương hợp lệ (number hoặc numeric string) — chặn NaN/Infinity/âm/0/rỗng */
function requirePositiveNumber(v: any, label: string): number {
  const n = Number(v);
  if (!v || !Number.isFinite(n) || n <= 0) throw new Error('Thiếu ' + label);
  return n;
}

/** Số hợp lệ khi có cung cấp (field optional) — chặn NaN/Infinity */
function optionalNumber(v: any, label: string): void {
  if (v !== undefined && v !== null && v !== '' && !Number.isFinite(Number(v))) {
    throw new Error(label + ' không hợp lệ');
  }
}

/**
 * Giá/số lượng không âm khi có cung cấp — trả số đã kiểm tra (W3.3A).
 * v3.6 chỉ Number(patch.x) không chặn âm (sc.js:298–299) → tiền vào SUM có thể
 * âm, gian lận tong/hồ sơ bước 8. v5 siết: NaN/Infinity/âm → error (0 hợp lệ
 * — "chưa báo giá").Đây là input-validation, KHÔNG đổi công thức tính.
 */
function clampNonNegative(v: any, label: string): number {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(label + ' không hợp lệ');
  return n;
}

/** id VARCHAR(12) 'PREFIX-000001' — chặn xâu rác khi HTTP không qua zod (MCP mới có zod) */
function requireItemId(v: any, label: string): string {
  const s = requireStr(v, label);
  if (s.length > 12) throw new Error(label + ' không hợp lệ');
  return s;
}

async function getSc(api: Api, id: string): Promise<any> {
  const r = await row('SELECT * FROM sc WHERE id=$1 AND deleted_at=$2', [id, '']);
  if (!r) throw new Error('Không tìm thấy phiếu sửa chữa');
  return r;
}

/**
 * W0.2 — Tính lại tong_cong / tong_vt / tong của phiếu SC từ chính dòng chi tiết
 * (1 statement UPDATE atomic — aggregate recomputed, không cộng dồn incremental).
 *
 * Port NGUYÊN công thức v3.6 server/sc.js recalc(scId) (dòng 35–46):
 *  - tong_cong = SUM(so_luong * don_gia)                      FROM sc_congviec (soft-delete filter deleted_at='')
 *  - tong_vt   = SUM(so_luong * (CASE WHEN gd_tt>0 THEN gd_tt ELSE gd_dk END)) FROM sc_vattu (soft-delete filter)
 *      → schema v5 (db/schema.sql dòng 70–78) sc_vattu KHÔNG có cột don_gia;
 *        giá vt = gd_tt (giá thanh toán sau nghiệm thu) nếu >0, ngược lại gd_dk (giá đăng ký/báo giá).
 *        CASE WHEN gd_tt>0 tương đương COALESCE(NULLIF(gd_tt,0),gd_dk) với dữ liệu giá không âm,
 *        nhưng giữ đúng v3.6: gd_tt chỉ được ưu tiên khi chặt > 0 (NULL/0 → dùng gd_dk).
 *  - tong      = tong_cong + tong_vt (tính lại bằng subquery vì không được tham chiếu giá trị
 *                vừa gán trong cùng câu UPDATE).
 * Dòng có so_luong/don_gia NULL: tích NULL → SUM bỏ qua (đúng như v3.6); rỗng hoàn toàn → COALESCE về 0.
 */
async function recalcScTotals(scId: string): Promise<void> {
  await run(
    "UPDATE sc SET " +
      "tong_cong = COALESCE((SELECT SUM(so_luong * don_gia) FROM sc_congviec WHERE sc_id=$1 AND deleted_at=''),0), " +
      "tong_vt = COALESCE((SELECT SUM(so_luong * (CASE WHEN gd_tt>0 THEN gd_tt ELSE gd_dk END)) FROM sc_vattu WHERE sc_id=$1 AND deleted_at=''),0), " +
      "tong = COALESCE((SELECT SUM(so_luong * don_gia) FROM sc_congviec WHERE sc_id=$1 AND deleted_at=''),0) " +
      "       + COALESCE((SELECT SUM(so_luong * (CASE WHEN gd_tt>0 THEN gd_tt ELSE gd_dk END)) FROM sc_vattu WHERE sc_id=$1 AND deleted_at=''),0) " +
      "WHERE id=$1 AND deleted_at=''",
    [scId]
  );
}

export async function scList(api: Api, filter?: { trang_thai?: string }): Promise<any[]> {
  const u = api.auth.current();
  const role = u?.role;
  if (filter?.trang_thai !== undefined && filter.trang_thai !== '' && !TT.includes(filter.trang_thai)) {
    throw new Error('Trạng thái không hợp lệ');
  }
  let sql = 'SELECT * FROM sc WHERE deleted_at=$1';
  const params: any[] = [''];
  if (filter?.trang_thai) {
    sql += ' AND trang_thai=$2';
    params.push(filter.trang_thai);
  }
  if (role !== 'giamdoc' && role !== 'admin') {
    sql += ' AND is_test=0';
  }
  sql += ' ORDER BY ngay_tao DESC';
  const r = await api.db.query(sql, params);
  return r.rows;
}

export async function scGet(api: Api, id: string): Promise<any> {
  const u = api.auth.current();
  const role = u?.role;
  if (role) {
    // v3.6 sc.js scGet(): chỉ checkLock('sc','xem') — mọi role có quyền xem đều xem được mọi SC,
    // không phân biệt sở hữu (người tạo). Giữ NGUYÊN quy tắc này.
    if (!(await api.perm.can(api.db, role, 'sc', 'xem'))) throw new Error('403');
  }
  const r = await row('SELECT * FROM sc WHERE id=$1 AND deleted_at=$2', [id, '']);
  if (!r) throw new Error('Không tìm thấy phiếu sửa chữa');
  return r;
}

export async function scCreate(
  api: Api,
  p: { xe_id: string; ngay: string; ghi_chu_tham_kham?: string }
): Promise<{ id: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'tao'))) throw new Error('403');
  const xeId = requireStr(p?.xe_id, 'xe_id');
  const ngay = requireStr(p?.ngay, 'ngay');
  // GĐ6 ghi_chu_tham_kham (optional): optionalStr chặn object/array (type-confusion);
  // trần 2000 ký khớp zod (lib/contracts.ts) + cột TEXT — cắt cứng phía server để
  // không tin client (khác đường MCP/HTTP thẳng không qua zod). '' khi không có.
  optionalStr(p?.ghi_chu_tham_kham, 'ghi_chu_tham_kham');
  const ghiChu = String(p?.ghi_chu_tham_kham ?? '').slice(0, 2000);
  const xe = await row('SELECT id FROM xe WHERE id=$1 AND deleted_at=$2', [xeId, '']);
  if (!xe) throw new Error('Không tìm thấy xe');
  const isTest = role === 'admin' ? 1 : 0;
  const id = await nextId('SC');
  await run(
    'INSERT INTO sc (id, xe_id, ngay_tao, nguoi_tao, trang_thai, is_test, ghi_chu_tham_kham, deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, xeId, ngay, u?.id, 'de_xuat', isTest, ghiChu, '']
  );
  // W0.2: khởi tạo tong_* = 0 từ dòng (đảm bảo 3 cột luôn là số, không NULL, cùng trạng thái với dòng con)
  await recalcScTotals(id);
  try {
    await logActivity(api.db, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'sc_tao',
      doi_tuong: 'sc',
      doi_tuong_id: id,
      sc_id: id,
      mo_ta: 'Tạo phiếu sửa chữa',
    });
  } catch (e: any) {
    log.logError('scCreate: logActivity failed', e, { id, sc_id: id });
  }
  invalidateDashCache(); // W3.2-wire: phiếu mới (de_xuat) vào cột kanban → lạnh dash
  return { id };
}

export async function scAddCongViec(
  api: Api,
  p: { sc_id: string; mo_ta: string; nguyen_nhan?: string; loai_xu_ly?: string; so_luong?: number; don_gia?: number }
): Promise<{ id: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'sua'))) throw new Error('403');
  const scId = requireStr(p?.sc_id, 'sc_id');
  const moTa = requireStr(p?.mo_ta, 'mo_ta');
  if (p?.loai_xu_ly !== undefined && p.loai_xu_ly !== null && p.loai_xu_ly !== '' && !LOAI_XU_LY.includes(p.loai_xu_ly)) {
    throw new Error('Loại xử lý không hợp lệ');
  }
  optionalStr(p?.nguyen_nhan, 'nguyen_nhan');
  optionalNumber(p?.so_luong, 'so_luong');
  optionalNumber(p?.don_gia, 'don_gia');
  await getSc(api, scId);
  await assertKhongChot(scId); // W3.5: phiếu đã chốt → hồ sơ bất biến, không thêm dòng
  const id = await nextId('CV');
  const r = await row<{ c: number }>('SELECT COUNT(*)::int AS c FROM sc_congviec WHERE sc_id=$1', [scId]);
  const stt = (r?.c ?? 0) + 1;
  await run(
    'INSERT INTO sc_congviec (id, sc_id, stt, mo_ta, nguyen_nhan, loai_xu_ly, so_luong, don_gia) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, scId, stt, moTa, p.nguyen_nhan ?? null, p.loai_xu_ly ?? null, p.so_luong ?? null, p.don_gia ?? null]
  );
  // W0.2: cập nhật tổng tiền SC từ dòng sau khi INSERT công việc
  await recalcScTotals(scId);
  try {
    await logActivity(api.db, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'sc_them_cv',
      doi_tuong: 'sc',
      doi_tuong_id: scId,
      sc_id: scId,
      mo_ta: 'Thêm công việc',
    });
  } catch (e: any) {
    log.logError('scAddCongViec: logActivity failed', e, { id: scId, sc_id: scId });
  }
  invalidateDashCache(); // W3.2-wire: tong/recalc đổi (cv thêm)
  return { id };
}

export async function scAddVatTu(
  api: Api,
  p: { sc_id: string; vattu_id: string; so_luong: number; don_gia?: number; gd_dk?: number }
): Promise<{ id: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'sua'))) throw new Error('403');
  const scId = requireStr(p?.sc_id, 'sc_id');
  const vattuId = requireStr(p?.vattu_id, 'vattu_id');
  const soLuong = requirePositiveNumber(p?.so_luong, 'so_luong');
  await getSc(api, scId);
  await assertKhongChot(scId); // W3.5: phiếu đã chốt → hồ sơ bất biến, không thêm dòng
  // W3.3A ĐÓNG WIRESH_PRICE: nhận giá đăng ký ngay khi thêm dòng.
  //  - UI app/(app)/sc/page.tsx (W2.5, dòng 390–395) gửi key `don_gia` (alias của
  //    `gd_dk` — tên cột v5). Core chấp nhận CẢ HAI: gd_dk = p.gd_dk ?? p.don_gia ?? 0.
  //  - KHÁC v3.6 scVtAdd (sc.js:349 `Number(rec.gd_dk) || (cat ? cat.gia : 0)`):
  //    v5 KHÔNG fallback giá danh mục vattu.gia — hành vi mặc định 0 đã được chốt
  //    ở fixture W0.2 (sc_totals.test.ts dòng 11–14) và fallback sẽ làm sai lệch
  //    các test đó. Giá = 0 ⟺ chưa báo giá, đúng thông điệp "dòng chưa giá".
  const gdDk = clampNonNegative(p?.gd_dk ?? p?.don_gia, 'gd_dk');
  const id = await nextId('VT');
  await run(
    'INSERT INTO sc_vattu (id, sc_id, vattu_id, so_luong, gd_dk) VALUES ($1,$2,$3,$4,$5)',
    [id, scId, vattuId, soLuong, gdDk]
  );
  // W0.2: cập nhật tổng tiền SC từ dòng sau khi INSERT vật tư
  await recalcScTotals(scId);
  try {
    await logActivity(api.db, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'sc_them_vt',
      doi_tuong: 'sc',
      doi_tuong_id: scId,
      sc_id: scId,
      mo_ta: 'Thêm vật tư',
    });
  } catch (e: any) {
    log.logError('scAddVatTu: logActivity failed', e, { id: scId, sc_id: scId });
  }
  invalidateDashCache(); // W3.2-wire: tong/recalc đổi (vt thêm)
  return { id };
}

/**
 * scBatDauSua — bắt đầu sửa chữa. W3.5 DUAL-TRACK:
 *  - 'de_xuat'  : GIỮ đường vào trực tiếp của v5 (hành vi W0.2→W3.3A, ~572 test
 *    + UI cũ phụ thuộc — business.test/rpc.test/qc206/sc_workline). v3.6 scStart
 *    (sc.js:261) CHỈ mở từ da_duyet/da_tong_duyet; v5 giữ de_xuat làm đường
 *    tương thích CHO TỚI KHI approve UI phủ hết màn hình → TODO(W3.6): siết
 *    (bỏ nhánh de_xuat) khi worker-e xong nút duyệt — coordinator quyết.
 *  - 'da_duyet' : path v3.6 NGUYÊN — vào scStart là LƯU PHIÊN BẢN kế hoạch đã
 *    duyệt nếu chưa có (sc.js:264–266 `if (!exist) snapshotSC(id, meId())` =
 *    auto-chot). Sau auto-chot, snapshot bất biến (mọi cổng dòng kiểm chốt).
 *  - BỎ CÓ CHỦ ĐÍCH: v3.6 khApplyToSC(id) (GĐ3.7 kế-hoach-tiến-độ → dòng việc) —
 *    v5 ke_hoach_sc CHỈ có mo_ta (bước 1 hồ sơ 8 bước, không phải kế hoạch tiến
 *    độ) → không có gì áp dụng. Ghi chú truy vết theo chốt W3.1-port-map.
 * TX + FOR UPDATE: approve/tong-duyet/start trên CÙNG phiếu tuần tự hóa —
 * đối thủ đến sau thấy trang_thai mới (không nhảy 2 trạng thái trong 1 lượt).
 */
export async function scBatDauSua(api: Api, p: { sc_id: string }): Promise<{ ok: true; chot?: boolean }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'sua'))) throw new Error('403');
  const scId = requireStr(p?.sc_id, 'sc_id');
  return await withTransaction(async (client) => {
    const sc = (await client.query(
      "SELECT id, trang_thai, is_test FROM sc WHERE id=$1 AND deleted_at='' FOR UPDATE",
      [scId]
    )).rows[0];
    if (!sc) throw new Error('Không tìm thấy phiếu sửa chữa');
    if (sc.trang_thai !== 'de_xuat' && sc.trang_thai !== 'da_duyet') {
      throw new Error('Không thể bắt đầu sửa khi phiếu đang ' + sc.trang_thai);
    }
    let chotNow = false;
    if (sc.trang_thai === 'da_duyet') {
      // v3.6 scStart:264–266 — "khi chạy luôn lưu phiên bản kế hoạch đã duyệt".
      const exist = await client.query(
        "SELECT id FROM sc_phien_ban WHERE sc_id=$1 AND deleted_at=''",
        [scId]
      );
      if (!exist.rows.length) {
        await snapshotSC(client, scId, u?.id ?? '', '');
        chotNow = true;
      }
    }
    await client.query(
      "UPDATE sc SET trang_thai='dang_sua' WHERE id=$1 AND deleted_at=''",
      [scId]
    );
    // audit TRONG tx (pattern kho.auditTx — pool thứ 2 trong tx = deadlock risk).
    await auditInTx(client, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'sc_bat_dau_sua',
      doi_tuong: 'sc',
      doi_tuong_id: scId,
      sc_id: scId,
      mo_ta: chotNow ? 'Bắt đầu sửa (tự chốt phiên bản kế hoạch đã duyệt)' : 'Bắt đầu sửa', // v3.6:269 'Bắt đầu sửa chữa'
      is_test: Number(sc.is_test ?? 0),
    });
    invalidateDashCache(); // end-of-tx (pattern dmDecide): de_xuat/da_duyet→dang_sua đổi cột kanban
    return chotNow ? { ok: true as const, chot: true } : { ok: true as const };
  });
}

export async function scHoanThanh(api: Api, p: { sc_id: string }): Promise<{ ok: true }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'sua'))) throw new Error('403');
  const scId = requireStr(p?.sc_id, 'sc_id');
  const sc = await getSc(api, scId);
  if (sc.trang_thai !== 'dang_sua') {
    throw new Error('Chưa bắt đầu sửa — không thể hoàn thành');
  }
  await run('UPDATE sc SET trang_thai=$1 WHERE id=$2 AND deleted_at=$3', ['da_hoan', scId, '']);
  try {
    await logActivity(api.db, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'sc_hoan_thanh',
      doi_tuong: 'sc',
      doi_tuong_id: scId,
      sc_id: scId,
      mo_ta: 'Hoàn thành sửa chữa',
    });
  } catch (e: any) {
    log.logError('scHoanThanh: logActivity failed', e, { sc_id: scId });
  }
  invalidateDashCache(); // W3.2-wire: trang_thai→da_hoan (KPI/kanban đổi)
  return { ok: true };
}

export async function scTuChoi(api: Api, p: { sc_id: string; ly_do: string }): Promise<{ ok: true }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'sua'))) throw new Error('403');
  const scId = requireStr(p?.sc_id, 'sc_id');
  const sc = await getSc(api, scId);
  // v3.6 sc.js scApprove('tu_choi'): chỉ từ chối khi phiếu đang 'de_xuat'
  if (sc.trang_thai !== 'de_xuat') {
    throw new Error('Không thể từ chối khi phiếu đang ' + sc.trang_thai);
  }
  optionalStr(p?.ly_do, 'ly_do');
  await run('UPDATE sc SET trang_thai=$1 WHERE id=$2 AND deleted_at=$3', ['tu_choi', scId, '']);
  try {
    await logActivity(api.db, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'sc_tu_choi',
      doi_tuong: 'sc',
      doi_tuong_id: scId,
      sc_id: scId,
      mo_ta: 'Từ chối: ' + (p.ly_do ?? ''),
    });
  } catch (e: any) {
    log.logError('scTuChoi: logActivity failed', e, { sc_id: scId });
  }
  invalidateDashCache(); // W3.2-wire: trang_thai→tu_choi
  return { ok: true };
}

export async function scQuyetToan(api: Api, p: { sc_id: string }): Promise<{ ok: true }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'kehoach'))) {
    log.logWarn('scQuyetToan: permission denied (rbac)', { actor: u?.id, role });
    throw new Error('403');
  }
  // v3.6 perm.canQuyetToan(): admin/ketoan (+giamdoc/quanly) — v5 MATRIX đã siết còn ketoan (admin bypass),
  // security.test.ts yêu cầu giamdoc DENY → chỉ cho ketoan/admin.
  if (role !== 'ketoan' && role !== 'admin') {
    log.logWarn('scQuyetToan: role not allowed', { actor: u?.id, role });
    throw new Error('403');
  }
  const scId = requireStr(p?.sc_id, 'sc_id');
  const sc = await getSc(api, scId);
  // Gate hồ sơ 8 bước: chặn quyết toán khi thiếu bất kỳ bước bắt buộc nào
  const hs = await checkHoSo(api, scId);
  if (!hs.ok) {
    log.logWarn('scQuyetToan: incomplete ho so', { sc_id: scId, miss: hs.miss, actor: u?.id });
    throw new Error('Không thể quyết toán — thiếu hồ sơ: ' + hs.miss.join(', '));
  }
  if (sc.trang_thai !== 'da_hoan') {
    log.logWarn('scQuyetToan: invalid trang_thai', { sc_id: scId, trang_thai: sc.trang_thai, actor: u?.id });
    throw new Error('Chỉ quyết toán khi phiếu đã hoàn thành');
  }
  await run('UPDATE sc SET trang_thai=$1 WHERE id=$2 AND deleted_at=$3', ['da_quyet', scId, '']);
  try {
    await logActivity(api.db, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'sc_quyet_toan',
      doi_tuong: 'sc',
      doi_tuong_id: scId,
      sc_id: scId,
      mo_ta: 'Quyết toán',
    });
  } catch (e: any) {
    log.logError('scQuyetToan: logActivity failed', e, { sc_id: scId });
  }
  log.logInfo('scQuyetToan: success', { sc_id: scId, actor: u?.id });
  invalidateDashCache(); // W3.2-wire: trang_thai→da_quyet
  return { ok: true };
}

/* ═══════════════════ W3.3A — DÒNG CÔNG VIỆC / VẬT TƯ + DEADLINE + THỢ ═══════════════════
 * Port v3.6 server/sc.js scWorkSet/scWorkDel/scVtUpd/scVtDel/scSetDeadline +
 * handlers.js thoList. LỆCH CÓ CHỦ ĐÍCH (chốt theo spec W3.3A, ghi nhận để review):
 *  1) GATE: v3.6 ACTIVE_STATUS = ['de_xuat','da_duyet','dang_sua'] (sc.js:20) và
 *     scVtUpd/scWorkDel/scVtDel THẬM CHÍ không gate trạng thái phiếu. v5 siết hết
 *     4 fn dòng về 'de_xuat' ("chỉ sửa khi đề xuất") — vì tiến độ khi dang_sua đi
 *     qua đường khác (dashboardAll/kanban), không mở ngoặc sửa kế hoạch đang chạy.
 *     Điều kiện lồng v3.6 "don_gia chỉ đổi khi de_xuat" (sc.js:299) thành hệ quả
 *     hiển nhiên của gate mới — giữ nguyên chú thích tại chỗ.
 *  2) TÊN CỘT theo schema v5: v3.6 `ten`→mo_ta, không có cột `thanh` (thành tiền
 *     tính tay trong SUM của recalcScTotals — UPDATE thanh=… của v3.6 không còn),
 *     không có `gio_cong`/`ghi_chu` ở sc_congviec, không có `tho_id` ở sc_vattu →
 *     các field đó KHÔNG được nhận (khác v3.6 — lean schema đã chốt trước đó).
 *  3) ENUM tt dòng công việc: v3.6 'todo|dang|hoan' → v5 CHECK là
 *     'cho|dang|hoan' (db/schema.sql dòng 50). Nhận 'todo' như alias tương thích
 *     lùi của 'cho' khi patch (doc + client cũ v3.6), giá trị ghi xuống là 'cho'.
 *  4) recalc ScUỐI mọi hàm sửa dòng (W0.2 recalcScTotals — 1 UPDATE atomic),
 *     sc_id SUY RA TỪ DÒNG (args chỉ có id dòng) → không thể recalc nhầm phiếu.
 */

/** Trạng thái dòng công việc hợp lệ theo CHECK v5 (sc_congviec.tt). 'todo' chỉ là alias nạp đầu vào. */
const TT_DONG_CV = ['cho', 'dang', 'hoan'];

/** Đọc dòng CV + phiếu cha; gate 'chỉ sửa khi de_xuat'. Trả {err} dạng envelope nội bộ.
 * W3.5: cổng KIỂM CHỐT đặt ĐẦU (trước gate de_xuat) — phiếu đã scTongDuyet/auto-chot
 * là HỒ SƠ BẤT BIẾN, mọi sửa dòng bị chặn bất kể trạng thái (v3.6 chặn qua
 * ACTIVE_STATUS∌da_tong_duyet; v5 chốt bằng dòng sc_phien_ban — schema comment). */
async function loadWorkLine(scItemId: string): Promise<{ cv: any; sc: any }> {
  const cv = await row('SELECT * FROM sc_congviec WHERE id=$1 AND deleted_at=$2', [scItemId, '']);
  if (!cv) throw new Error('Không thấy hạng mục công việc.'); // v3.6 sc.js:296
  const sc = await row(
    "SELECT s.*, EXISTS(SELECT 1 FROM sc_phien_ban pb WHERE pb.sc_id = s.id AND pb.deleted_at = '') AS da_chot " +
    'FROM sc s WHERE s.id=$1 AND s.deleted_at=$2',
    [cv.sc_id, '']
  );
  if (!sc) throw new Error('Không tìm thấy phiếu sửa chữa');
  if (sc.da_chot) {
    throw new Error('Phiếu đã chốt (tổng duyệt) — hồ sơ bất biến, không sửa dòng.'); // v5 chot (W3.5)
  }
  if (sc.trang_thai !== 'de_xuat') {
    throw new Error('Chỉ sửa khi đề xuất.'); // gate v5 (v3.6: ACTIVE_STATUS — xem comment block)
  }
  return { cv, sc };
}

/** Đọc dòng VT + phiếu cha; gate như loadWorkLine (kèm kiểm CHỐT đầu cổng W3.5). */
async function loadVatTuLine(vtItemId: string): Promise<{ vt: any; sc: any }> {
  const vt = await row('SELECT * FROM sc_vattu WHERE id=$1 AND deleted_at=$2', [vtItemId, '']);
  if (!vt) throw new Error('Không thấy vật tư.'); // v3.6 sc.js:359
  const sc = await row(
    "SELECT s.*, EXISTS(SELECT 1 FROM sc_phien_ban pb WHERE pb.sc_id = s.id AND pb.deleted_at = '') AS da_chot " +
    'FROM sc s WHERE s.id=$1 AND s.deleted_at=$2',
    [vt.sc_id, '']
  );
  if (!sc) throw new Error('Không tìm thấy phiếu sửa chữa');
  if (sc.da_chot) {
    throw new Error('Phiếu đã chốt (tổng duyệt) — hồ sơ bất biến, không sửa dòng.');
  }
  if (sc.trang_thai !== 'de_xuat') {
    throw new Error('Chỉ sửa khi đề xuất.');
  }
  return { vt, sc };
}

/**
 * assertKhongChot — cổng CHỐT cho đường THÊM dòng (scAddCongViec/scAddVatTu).
 * v3.6 scWorkAdd/scVtAdd gate ACTIVE_STATUS (sc.js:321/344) ⟹ sau tổng-duyệt
 * (da_tong_duyet ∌ ACTIVE) KHÔNG thêm dòng được nữa. v5 không có trạng thái đó —
 * chốt = dòng sc_phien_ban → chặn thẳng ở đây (bất kỳ recalc nào sau chốt cũng
 * không xé được snapshot bất biến). Phiếu chưa chốt: hành vi y hệt hiện tại (0 break).
 */
async function assertKhongChot(scId: string): Promise<void> {
  const r = await row(
    "SELECT 1 AS x FROM sc_phien_ban WHERE sc_id=$1 AND deleted_at=''",
    [scId]
  );
  if (r) throw new Error('Phiếu đã chốt (tổng duyệt) — hồ sơ bất biến, không thêm dòng.');
}

/**
 * scWorkSet — sửa MỘT dòng công việc trên phiếu đang de_xuat (v3.6 sc.js:291–316).
 * Field nhận theo cột v5: mo_ta (alias ten), so_luong, don_gia, tho_id, tt, stt,
 * nguyen_nhan, loai_xu_ly. don_gia: v3.6 chỉ đổi khi de_xuat (sc.js:299) — gate ở
 * đây đã bảo đảm điều đó. CUỐI: recalcScTotals (thay v3.6 UPDATE thanh + recalc —
 * v5 không có cột thanh).
 */
export async function scWorkSet(
  api: Api,
  p: {
    id: string;
    mo_ta?: string;
    ten?: string;
    so_luong?: number;
    don_gia?: number;
    tho_id?: string;
    tt?: string;
    stt?: number;
    nguyen_nhan?: string;
    loai_xu_ly?: string;
  }
): Promise<{ ok: true }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'sua'))) throw new Error('403');
  const itemId = requireItemId(p?.id, 'id');
  const { cv, sc } = await loadWorkLine(itemId);

  const sets: string[] = [];
  const params: any[] = [];
  const add = (col: string, val: any): void => {
    params.push(val);
    sets.push(col + '=$' + params.length);
  };

  const moTa = p.mo_ta ?? p.ten; // v3.6 'ten' → cột v5 'mo_ta'
  if (moTa !== undefined) {
    optionalStr(moTa, 'mo_ta');
    add('mo_ta', String(moTa));
  }
  if (p.so_luong !== undefined) add('so_luong', clampNonNegative(p.so_luong, 'so_luong'));
  // v3.6: don_gia CHỈ đổi khi de_xuat — gate phía trên đã chốt de_xuat, giữ nguyên ngữ nghĩa.
  if (p.don_gia !== undefined) add('don_gia', clampNonNegative(p.don_gia, 'don_gia'));
  if (p.tho_id !== undefined) {
    optionalStr(p.tho_id, 'tho_id');
    const thoId = String(p.tho_id ?? '');
    if (thoId.length > 12) throw new Error('tho_id không hợp lệ');
    add('tho_id', thoId);
  }
  if (p.tt !== undefined) {
    optionalStr(p.tt, 'tt');
    let tt = String(p.tt);
    if (tt === 'todo') tt = 'cho'; // alias tương thích lùi enum v3.6 → 'cho' (v5 CHECK)
    if (!TT_DONG_CV.includes(tt)) throw new Error('Trạng thái công việc sai.'); // v3.6 sc.js:302
    add('tt', tt);
  }
  if (p.stt !== undefined) {
    optionalNumber(p.stt, 'stt');
    add('stt', Math.trunc(Number(p.stt)) || 0); // v3.6 Number()||0 — stt nguyên
  }
  if (p.nguyen_nhan !== undefined) {
    optionalStr(p.nguyen_nhan, 'nguyen_nhan');
    add('nguyen_nhan', String(p.nguyen_nhan));
  }
  if (p.loai_xu_ly !== undefined) {
    optionalStr(p.loai_xu_ly, 'loai_xu_ly');
    const lxl = String(p.loai_xu_ly);
    if (lxl !== '' && !LOAI_XU_LY.includes(lxl)) {
      throw new Error('Loại xử lý sai (thay_moi/sua_chua/bao_duong/khac).'); // v3.6:266 message — enum v5
    }
    add('loai_xu_ly', lxl === '' ? null : lxl); // '' = xóa nhãn (cột nullable + CHECK → NULL)
  }

  if (sets.length) {
    params.push(cv.id, sc.id);
    await run(
      'UPDATE sc_congviec SET ' + sets.join(', ') + ' WHERE id=$' + (params.length - 1) + ' AND sc_id=$' + params.length + " AND deleted_at=''",
      params
    );
  }
  // CUỐI: tính lại tổng (đọc từ CHÍNH dòng suy ra sc_id, không tin args)
  await recalcScTotals(String(sc.id));
  try {
    await logActivity(api.db, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'sc_work_set', // v3.6 audit('work','sc_congviec',…,'Cập nhật công việc')
      doi_tuong: 'sc_congviec',
      doi_tuong_id: itemId,
      sc_id: String(sc.id),
      mo_ta: 'Cập nhật công việc',
    });
  } catch (e: any) {
    log.logError('scWorkSet: logActivity failed', e, { id: itemId, sc_id: sc.id });
  }
  invalidateDashCache(); // W3.2-wire: % hoàn thành dòng + recalc (tt/so_luong/don_gia) đổi
  return { ok: true };
}

/**
 * scWorkDel — xóa MỀM dòng công việc (v3.6 sc.js:333–338 db.softDelete).
 * v3.6 KHÔNG gate trạng thái; v5 siết 'chỉ sửa khi de_xuat' (đừng xóa dòng của
 * phiếu đang chạy — mất dấu vết nghiệm thu). deleted_at = timestamp ISO (schema
 * v5 TEXT — cùng quy ước kho.ts dmDelete:1258).
 */
export async function scWorkDel(api: Api, p: { id: string }): Promise<{ ok: true }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'sua'))) throw new Error('403');
  const itemId = requireItemId(p?.id, 'id');
  const { cv, sc } = await loadWorkLine(itemId);
  await run(
    `UPDATE sc_congviec SET deleted_at=$2 WHERE id=$1 AND sc_id=$3 AND deleted_at=''`,
    [itemId, new Date().toISOString(), sc.id]
  );
  void cv; // cv đã được check tồn tại + gate ở loadWorkLine
  await recalcScTotals(String(sc.id));
  try {
    await logActivity(api.db, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'sc_work_del',
      doi_tuong: 'sc_congviec',
      doi_tuong_id: itemId,
      sc_id: String(sc.id),
      mo_ta: 'Xóa dòng công việc',
    });
  } catch (e: any) {
    log.logError('scWorkDel: logActivity failed', e, { id: itemId, sc_id: sc.id });
  }
  invalidateDashCache(); // W3.2-wire: soft-delete dòng → recalc đổi
  return { ok: true };
}

/**
 * scVtUpd — sửa dòng vật tư (v3.6 sc.js:356–373). Field v5 theo cột thật:
 * so_luong, gd_dk (giá đăng ký/báo giá).
 *  - gd_tt (giá thực tế sau nghiệm thu): v3.6 cho sửa qua scVtUpd; v5 KHÔNG mở ở
 *    đây — gd_tt thuộc luồng nghiệm thu/kho (đang wire ở W3 hook khác), siết để
 *    de_xuat không tự đặt giá quyết toán (gatekeeper: chặn tự nâng tiền).
 *  - "gd_tt>0 cấm sửa gd_dk?": v3.6 KHÔNG cấm (sc.js:362 update tự do); công thức
 *    CASE WHEN gd_tt>0 THEN gd_tt ELSE gd_dk khiến gd_dk không ảnh hưởng tổng khi
 *    đã có giá thực. v5 giữ đúng hành vi đó (recalcScTotals đã CASE) → không them
 *    lệnh cấm.
 *  - stt/nguyen_nhan/loai_xu_ly/bao_gia_id/tho_id: v3.6 có (trừ tho_id) nhưng
 *    schema v5 sc_vattu KHÔNG có cột stt/nguyen_nhan/bao_gia_id/tho_id → không nhận.
 * CUỐI: recalc (v3.6 UPDATE thanh=… + recalc → v5 gộp vào recalc, không có cột thanh).
 */
export async function scVtUpd(
  api: Api,
  p: { id: string; so_luong?: number; gd_dk?: number }
): Promise<{ ok: true }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'sua'))) throw new Error('403');
  const itemId = requireItemId(p?.id, 'id');
  const { vt, sc } = await loadVatTuLine(itemId);

  const sets: string[] = [];
  const params: any[] = [];
  if (p.so_luong !== undefined) {
    params.push(clampNonNegative(p.so_luong, 'so_luong'));
    sets.push('so_luong=$' + params.length);
  }
  if (p.gd_dk !== undefined) {
    params.push(clampNonNegative(p.gd_dk, 'gd_dk'));
    sets.push('gd_dk=$' + params.length);
  }
  if (sets.length) {
    params.push(vt.id, sc.id);
    await run(
      'UPDATE sc_vattu SET ' + sets.join(', ') + ' WHERE id=$' + (params.length - 1) + ' AND sc_id=$' + params.length + " AND deleted_at=''",
      params
    );
  }
  await recalcScTotals(String(sc.id));
  try {
    await logActivity(api.db, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'sc_vt_set',
      doi_tuong: 'sc_vattu',
      doi_tuong_id: itemId,
      sc_id: String(sc.id),
      mo_ta: 'Cập nhật vật tư',
    });
  } catch (e: any) {
    log.logError('scVtUpd: logActivity failed', e, { id: itemId, sc_id: sc.id });
  }
  invalidateDashCache(); // W3.2-wire: recalc đổi (so_luong/gd_dk)
  return { ok: true };
}

/**
 * scVtDel — xóa MỀM dòng vật tư (v3.6 sc.js:375–380). v5 gate de_xuat như scWorkDel.
 */
export async function scVtDel(api: Api, p: { id: string }): Promise<{ ok: true }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'sua'))) throw new Error('403');
  const itemId = requireItemId(p?.id, 'id');
  const { vt, sc } = await loadVatTuLine(itemId);
  await run(
    `UPDATE sc_vattu SET deleted_at=$2 WHERE id=$1 AND sc_id=$3 AND deleted_at=''`,
    [String(vt.id), new Date().toISOString(), sc.id]
  );
  await recalcScTotals(String(sc.id));
  try {
    await logActivity(api.db, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'sc_vt_del',
      doi_tuong: 'sc_vattu',
      doi_tuong_id: itemId,
      sc_id: String(sc.id),
      mo_ta: 'Xóa dòng vật tư',
    });
  } catch (e: any) {
    log.logError('scVtDel: logActivity failed', e, { id: itemId, sc_id: sc.id });
  }
  invalidateDashCache(); // W3.2-wire: soft-delete dòng VT → recalc đổi
  return { ok: true };
}

/**
 * scSetDeadline — hẹn trả xe (v3.6 sc.js:274–289 scSetDeadline(id, ngay)).
 * v3.6 ghi phieu_sua.ngay_du_kien → v5 ghi sc.han_tra_xe (cột mới W3.3A).
 * Gate trung thành v3.6: role ['xuong','giamdoc','admin'] (sc.js:276) + chặn
 * trạng thái ['de_xuat','tu_choi','da_quyet'] (sc.js:281: chưa duyệt/sau chốt
 * thì không đặt hẹn) → chỉ dang_sua|da_hoan được hẹn.
 * han_tra_xe: '' hợp lệ (xóa hẹn — v3.6 String(ngay||'')), còn lại bắt buộc
 * YYYY-MM-DD (sc.js:285). KHÔNG recalc — không đụng tiền.
 */
const DEADLINE_ROLES = ['xuong', 'giamdoc', 'admin'];
const TT_LABEL_V5: Record<string, string> = {
  de_xuat: 'đề xuất',
  da_duyet: 'đã duyệt', // W3.5: da_duyet không bị chặn hẹn (≡ v3.6 sc.js:281), nhưng message cần nhãn
  dang_sua: 'đang sửa',
  da_hoan: 'đã hoàn thành',
  da_quyet: 'đã quyết toán',
  tu_choi: 'từ chối',
};
export async function scSetDeadline(
  api: Api,
  p: { id: string; han_tra_xe?: string }
): Promise<{ ok: true; han_tra_xe: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (!(await api.perm.can(api.db, role!, 'sc', 'sua'))) throw new Error('403');
  if (!role || !DEADLINE_ROLES.includes(role)) {
    throw new Error('Chỉ quản lý xưởng đặt ngày hẹn trả xe.'); // v3.6 sc.js:277
  }
  const scId = requireItemId(p?.id, 'id');
  const sc = await getSc(api, scId);
  if (['de_xuat', 'tu_choi', 'da_quyet'].includes(sc.trang_thai)) {
    throw new Error('Phiếu đang ' + (TT_LABEL_V5[sc.trang_thai] || sc.trang_thai) + ' — không đặt được ngày hẹn.');
  }
  optionalStr(p?.han_tra_xe, 'han_tra_xe');
  const d = String(p?.han_tra_xe ?? '').trim();
  if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('Ngày hẹn phải dạng YYYY-MM-DD.'); // v3.6 sc.js:285
  await run(`UPDATE sc SET han_tra_xe=$2 WHERE id=$1 AND deleted_at=''`, [scId, d]);
  try {
    await logActivity(api.db, {
      actor_id: u?.id,
      actor_role: role,
      hanh_dong: 'sc_deadline', // v3.6 audit('deadline','phieu_sua',…)
      doi_tuong: 'sc',
      doi_tuong_id: scId,
      sc_id: scId,
      mo_ta: 'Đặt ngày hẹn trả xe ' + (d || 'chưa rõ'),
    });
  } catch (e: any) {
    log.logError('scSetDeadline: logActivity failed', e, { sc_id: scId });
  }
  invalidateDashCache(); // W3.2-wire: ETA/kanban liên quan cột → làm mới
  return { ok: true, han_tra_xe: d };
}

/**
 * thoList — danh sách thợ để gán việc (v3.6 handlers.js:65–70).
 * v3.6: role='tho' AND active=1 — v5 KHÔNG có role 'tho' trong CHECK users.role
 * (nhóm xưởng gộp thành 'xuong') và không có cột active (soft-delete deleted_at)
 * → port tương đương ngữ nghĩa: role='xuong' AND deleted_at=''.
 * v3.6 gate ['tk','sua']; v5 chốt ['sc','xem'] (mọi role xem được SC đều cần
 * dropdown gán việc) — phân quyền ở dispatch + READ_TOOLS (MCP đọc tự do).
 * Trả [{id,name}] nguyên shape v3.6 (map lại đúng 2 cột).
 */
export async function thoList(api: Api): Promise<Array<{ id: string; name: string }>> {
  const u = api.auth.current();
  if (!u) return []; // v3.6 handlers.js:67 — chưa đăng nhập trả mảng rỗng (dispatch đã 401 trước)
  const r = await api.db.query(
    "SELECT id, name FROM users WHERE role='xuong' AND deleted_at='' ORDER BY name"
  );
  return r.rows.map((t: any) => ({ id: String(t.id), name: String(t.name) }));
}

/* ═══════════════ W3.5 (XƯỞNG) — DUYỆT THEO NGƯỠNG + TỔNG DUYỆT SNAPSHOT ═══════════════
 * Port NGUYÊN v3.6: sc.js scApprove (190–205), scTongDuyet (237–256), snapshotSC
 * (208–235), scStart auto-chot (259–271 — đã wire vào scBatDauSua ở khối trên);
 * perm.js scNguong/canApproveSC (109–117) + seed.js:259 default 5.000.000đ.
 *
 * CẤU TRÚC QUYỀN (đồng khuôn W2b dmDecide — lib/core/kho.ts:1340):
 *  - Dispatch META ['sc','duy'] (cửa ma trận: giamdoc/xuong/admin — lib/perm.ts,
 *    mapping v3.6 {quanly,giamdoc}→{xuong(=ql gộp),giamdoc}); NGƯỠNG giá trị
 *    phán quyết TRONG core dưới đây — role ngoài tập duyệt nhận business error
 *    chứa 'Giám đốc' (fail-closed, không im lặng).
 *  - LỆCH v3.6 CÓ CHỦ ĐÍCH (thiết kế dual-track đã chốt):
 *    1) KHÔNG có trạng thái 'da_tong_duyet': TỔNG DUYỆT = ghi 1 dòng sc_phien_ban
 *       (UNIQUE partial uq_spb_sc_live chống trùng/race); phiếu DỪNG ở 'da_duyet'
 *       với cờ chốt = sự tồn tại dòng snapshot. Cổng sửa dòng + thêm dòng kiểm
 *       chốt ĐẦU hàm (loadWorkLine/loadVatTuLine/assertKhongChot) ⟹ sau chốt,
 *       SNAPSHOT BẤT BIẾN thật sự (không đường nào recalc kịp chạm dữ liệu trong
 *       json đã đóng).
 *    2) scTongDuyet KHÔNG có nhánh 'từ chối tổng duyệt' (v3.6:253 lùi về da_duyet
 *       + ly_do_tu_choi) — contract W3.5 chốt {id}, không action; từ chối phiếu
 *       đã có đường riêng scTuChoi (de_xuat). Ghi nhận để coordinator cân nhắc
 *       mở 'từ chối tổng duyệt' ở W3.6 nếu UI cần.
 *    3) snapshot bao_gia_ncc: SELECT * nguyên hàng — schema v5 có sẵn cột
 *       ocr_xac_nhan/anh_bao_gia cho bước 3 hồ sơ (khác v3.6 OCR: chỉ dữ liệu
 *       NCC chuẩn, BỎ có chủ đúng mọi đường OCR theo AGENTS.md).
 * ══════════════════════════════════════════════════════════════════════════════ */

/** Key config ngưỡng duyệt SC (v3.6 perm.js:109 configGet('duyet_sc_nguong')). */
const SC_NGUONG_KEY = 'duyet_sc_nguong';
/** Default theo v3.6 seed.js:259 — 5.000.000 đ (v5 seed chưa có key → core tự đảm, pattern kho.MUA_NGUONG_DEFAULT). */
const SC_NGUONG_DEFAULT = '5000000';

/**
 * Đọc ngưỡng duyệt SC: INSERT-if-missing (ON CONFLICT DO NOTHING — idempotent,
 * tx-safe, không giẫm giá trị admin đã chỉnh) rồi SELECT. Hành vi như v3.6
 * scNguong(): Number(configGet(key, 0)) || 0 — giá trị rác/rỗng = 0 (xuong
 * không duyệt được phiếu nào khi ngưỡng 0, đúng v3.6). Nhận pool lẫn client.
 */
async function scNguong(
  // eslint-disable-next-line no-unused-vars -- base rule nhầm các tham số trong function TYPE (chữ ký tài liệu); kho.ts:1312 cùng khuôn
  q: { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> }
): Promise<number> {
  await q.query(
    'INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
    [SC_NGUONG_KEY, SC_NGUONG_DEFAULT]
  );
  const r = await q.query('SELECT value FROM config WHERE key = $1', [SC_NGUONG_KEY]);
  const n = Number(r.rows[0]?.value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * canApproveSC — port NGUYÊN thuật toán v3.6 perm.js:112–117, chiếu role v5:
 *   admin|giamdoc: VÔ HẠN (v3.6 hard-code, độc lập ma trận).
 *   xuong        : tong ≤ ngưỡng (vai v3.6 'quanly' duyệt trong ngưỡng — v5 gộp
 *                 trách nhiệm quản lý vào xuong, xem lib/perm.ts W3.5 comment).
 *   còn lại      : false (v3.6: tho/khoa/ketoan/laixe không bao giờ duyệt —
 *                  MATRIX sc.duy v3.6 cũng không mở; ketoan/kho v5 chết ở
 *                  dispatch 403, đây là防线 thứ 2 fail-closed).
 * KHÔNG hardcode tập vai ở dispatch — đây là TRỌNG TÀI CUỐI (chuẩn 2 AGENTS).
 */
async function canApproveSC(role: string, tong: any, nguong: number): Promise<boolean> {
  const r = String(role || '').toLowerCase();
  if (r === 'admin' || r === 'giamdoc') return true;
  if (r === 'xuong') return Number(tong ?? 0) <= nguong;
  return false;
}

/** Nhãn trạng thái cho message duyệt — port TT_LABEL v3.6 sc.js:13–18 (nguyên văn tiếng Việt). */
const APPROVE_LABEL: Record<string, string> = {
  de_xuat: 'Đề xuất',
  da_duyet: 'Đã duyệt',
  dang_sua: 'Đang sửa',
  da_hoan: 'Hoàn thành',
  da_quyet: 'Đã quyết toán',
  tu_choi: 'Từ chối',
};

/** Ngày hệ thống YYYY-MM-DD UTC — đồng nhất todayStr() kho.ts/xuong.ts (= db.today() v3.6). */
function todaySc(): string {
  return new Date().toISOString().split('T')[0];
}

/** Ghi activity_log bằng CLIENT tx đang mở (kho.auditTx — pool thứ hai trong tx = 2 lỗi: audit ma + deadlock). */
async function auditInTx(
  client: PoolClient,
  p: Parameters<typeof logActivity>[1]
): Promise<void> {
  await client.query(
    'INSERT INTO activity_log (actor_id,actor_role,hanh_dong,doi_tuong,doi_tuong_id,sc_id,mo_ta,is_test) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [p.actor_id ?? null, p.actor_role ?? null, p.hanh_dong, p.doi_tuong ?? null, p.doi_tuong_id ?? null, p.sc_id ?? null, p.mo_ta ?? null, p.is_test ?? 0]
  );
}

/**
 * snapshotSC — port v3.6 sc.js:208–235. Bộ hồ sơ chốt = { sc, cong, vat, baoGia,
 * chot:{nguoi,ngay,lyDo} } (ĐÚNG khóa JSON v3.6 — v3.6 tính `pn` rồi KHÔNG đưa
 * vào snap (sc.js:220–226), v5 bỏ luôn query chết đó).
 *  - v5 gộp 4 SELECT+stringify của v3.6 thành MỘT json_build_object::text phía
 *    PG (1 phát roundtrip — chuẩn 3b), thứ tự dòng giữ nguyên: cong stt,id /
 *    vat id (v5 sc_vattu KHÔNG có cột stt) / baoGia id (v3.6: ORDER BY stt,id,
 *    id, id).
 *  - Ghi: INSERT ... ON CONFLICT (sc_id) WHERE deleted_at='' DO UPDATE — tương
 *    đương nhánh tồn-tại của v3.6 (sc.js:229–230); thực tế KHÔNG BAO GIỜ chạm
 *    DO UPDATE vì mọi caller gates trước (scTongDuyet chặn khi đã chốt,
 *    scBatDauSua auto chỉ khi !exist) → BẤT BIẾN trên lối đi thật.
 * Trả JSON text đã serialize (gọi trong tx — nhận PoolClient của withTransaction).
 */
async function snapshotSC(
  client: PoolClient,
  scId: string,
  nguoiChot: string,
  lyDo: string
): Promise<string> {
  const snapRes = await client.query(
    "SELECT json_build_object(" +
    " 'sc', (SELECT to_jsonb(s) FROM sc s WHERE s.id=$1 AND s.deleted_at='')," +
    " 'cong', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.stt, t.id) FROM sc_congviec t WHERE t.sc_id=$1 AND t.deleted_at=''), '[]'::jsonb)," +
    " 'vat', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM sc_vattu t WHERE t.sc_id=$1 AND t.deleted_at=''), '[]'::jsonb)," +
    " 'baoGia', COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM bao_gia_ncc t WHERE t.sc_id=$1 AND t.deleted_at=''), '[]'::jsonb)," +
    " 'chot', json_build_object('nguoi', $2::text, 'ngay', $3::text, 'lyDo', $4::text)" +
    ")::text AS json",
    [scId, nguoiChot, todaySc(), lyDo]
  );
  const json = String(snapRes.rows[0]?.json ?? '{}');
  await client.query(
    'INSERT INTO sc_phien_ban (sc_id, nguoi_chot, ngay_chot, snapshot) VALUES ($1,$2,$3,$4) ' +
    "ON CONFLICT (sc_id) WHERE deleted_at='' DO UPDATE " +
    'SET snapshot = EXCLUDED.snapshot, nguoi_chot = EXCLUDED.nguoi_chot, ngay_chot = EXCLUDED.ngay_chot',
    [scId, nguoiChot, todaySc(), json]
  );
  return json;
}

/**
 * scApprove — duyệt phiếu theo NGƯỠNG TIỀN (port v3.6 sc.js:190–205, envelope
 * pattern kho.dmDecide — 200 + {ok:false,error}, không throw).
 *  - Gate: CHỈ 'de_xuat' (v3.6:194 message nguyên văn 'Đang <label> — không duyệt được.').
 *  - Ngưỡng: tong > duyet_sc_nguong ∧ role ∉ {admin,giamdoc} → lỗi v3.6:196
 *    'Chưa đủ quyền duyệt (~<vnd>) — cần Giám đốc.' (xuong ≤ ngưỡng OK).
 *  - Duyệt: trang_thai='da_duyet' + nguoi_duyet/ngay_duyet (v3.6:199; cột thêm
 *    W3.5 — schema). v3.6 còn xóa ly_do_tu_choi: không port — phiếu duyệt luôn
 *    từ de_xuat, chưa từng có lý do; v5 không có cột đó (comment schema #2).
 *  - tx + FOR UPDATE: chống 2 lệnh duyệt / duyệt-vs-start song song ghi đè.
 */
export async function scApprove(
  api: Api,
  p: { id?: any } = {}
): Promise<{ ok: boolean; id?: string; trang_thai?: string; error?: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (typeof p?.id !== 'string' || !p.id.trim() || p.id.length > 12) {
    return { ok: false, error: 'id phải là chuỗi 1..12 ký tự' };
  }
  const id = p.id.trim();
  return await withTransaction(async (client) => {
    const sc = (await client.query(
      "SELECT id, trang_thai, tong, is_test FROM sc WHERE id=$1 AND deleted_at='' FOR UPDATE",
      [id]
    )).rows[0];
    if (!sc) return { ok: false, error: 'Không tìm thấy phiếu.' }; // v3.6:193
    if (sc.trang_thai !== 'de_xuat') {
      return { ok: false, error: 'Đang ' + (APPROVE_LABEL[sc.trang_thai] || sc.trang_thai) + ' — không duyệt được.' }; // v3.6:194
    }
    const nguong = await scNguong(client);
    if (!(await canApproveSC(String(role), sc.tong, nguong))) {
      return { ok: false, error: 'Chưa đủ quyền duyệt (~' + vnd(sc.tong) + ') — cần Giám đốc.' }; // v3.6:196
    }
    await client.query(
      "UPDATE sc SET trang_thai='da_duyet', nguoi_duyet=$2, ngay_duyet=$3 WHERE id=$1 AND deleted_at=''",
      [id, u?.id ?? '', todaySc()]
    );
    await auditInTx(client, {
      actor_id: u?.id, actor_role: role, hanh_dong: 'sc_duyet', // v3.6 audit('approval','phieu_sua',…)
      doi_tuong: 'sc', doi_tuong_id: id, sc_id: id,
      mo_ta: 'Duyệt phiếu', // v3.6:203 nguyên văn
      is_test: Number(sc.is_test ?? 0),
    });
    invalidateDashCache(); // end-of-tx (pattern dmDecide): de_xuat→da_duyet đổi cột kanban + KPI sc_cho_duyet
    return { ok: true, id, trang_thai: 'da_duyet' }; // v3.6:204 {ok, trang_thai}
  });
}

/**
 * scTongDuyet — TỔNG DUYỆT kế hoạch sửa chữa = chốt snapshot bất biến (port
 * v3.6 sc.js:237–256 'ok' branch + snapshotSC; envelope như scApprove).
 *  - Gate 1: trạng thái phải 'da_duyet' (v3.6:241–243 message nguyên văn
 *    'Phiếu đang <label> — chỉ tổng duyệt khi Đã duyệt.').
 *  - Gate 2: NGƯỠNG cùng hàm duyệt (v3.6:244–246 'Chưa đủ quyền tổng duyệt
 *    (~vnd) — cần Giám đốc.').
 *  - Gate 3 (v5 thay trạng thái da_tong_duyet): ĐÃ chốt → chặn 'không tổng
 *    duyệt lại' — mỗi phiếu ĐÚNG MỘT snapshot sống; INSERT trúng UNIQUE race
 *    cũng fail tx (chống trùng 2 lớp).
 *  - Hiệu lực: ghi sc_phien_ban {sc,cong,vat,baoGia,chot}, chot = actor+ngày
 *    (sc.js:226); phiếu DỪNG 'da_duyet' + cờ chốt (= tồn tại dòng snapshot).
 *    Từ đây mọi cổng dòng (scWorkSet/Del/scVtUpd/Del/scAddCongViec/scAddVatTu)
 *    CHẶN — hồ sơ bất biến, đúng ngữ nghĩa chốt của v3.6.
 *  - tx + FOR UPDATE toàn bộ (đọc phiếu → chốt → audit là MỘT khối nguyên tử).
 */
export async function scTongDuyet(
  api: Api,
  p: { id?: any } = {}
): Promise<{ ok: boolean; id?: string; chot?: boolean; snapshot?: boolean; trang_thai?: string; error?: string }> {
  const u = api.auth.current();
  const role = u?.role;
  if (typeof p?.id !== 'string' || !p.id.trim() || p.id.length > 12) {
    return { ok: false, error: 'id phải là chuỗi 1..12 ký tự' };
  }
  const id = p.id.trim();
  return await withTransaction(async (client) => {
    const sc = (await client.query(
      "SELECT id, trang_thai, tong, is_test FROM sc WHERE id=$1 AND deleted_at='' FOR UPDATE",
      [id]
    )).rows[0];
    if (!sc) return { ok: false, error: 'Không tìm thấy phiếu.' }; // v3.6:240
    if (sc.trang_thai !== 'da_duyet') {
      return { ok: false, error: 'Phiếu đang ' + (APPROVE_LABEL[sc.trang_thai] || sc.trang_thai) + ' — chỉ tổng duyệt khi Đã duyệt.' }; // v3.6:242
    }
    const nguong = await scNguong(client);
    if (!(await canApproveSC(String(role), sc.tong, nguong))) {
      return { ok: false, error: 'Chưa đủ quyền tổng duyệt (~' + vnd(sc.tong) + ') — cần Giám đốc.' }; // v3.6:245
    }
    const exist = await client.query(
      "SELECT id FROM sc_phien_ban WHERE sc_id=$1 AND deleted_at=''",
      [id]
    );
    if (exist.rows.length) {
      // v3.6 phân biệt bằng trạng thái da_tong_duyet; v5 chốt = dòng snapshot tồn tại (lệch #1 block comment)
      return { ok: false, error: 'Phiếu đã chốt (tổng duyệt) — snapshot bất biến, không tổng duyệt lại.' };
    }
    await snapshotSC(client, id, u?.id ?? '', ''); // v3.6:248 snapshotSC(id, meId())
    await auditInTx(client, {
      actor_id: u?.id, actor_role: role, hanh_dong: 'sc_tong_duyet', // v3.6 audit('tong-duyet',…)
      doi_tuong: 'sc', doi_tuong_id: id, sc_id: id,
      mo_ta: 'Tổng duyệt kế hoạch sửa chữa (đã lưu phiên bản)', // v3.6:250 nguyên văn
      is_test: Number(sc.is_test ?? 0),
    });
    invalidateDashCache(); // end-of-tx (data trên board không đổi trạng thái NHƯNG cổng chốt + audit feed)
    return { ok: true, id, chot: true, snapshot: true, trang_thai: 'da_duyet' }; // v3.6:251 {ok,trang_thai:da_tong_duyet,snapshot:true}
  });
}