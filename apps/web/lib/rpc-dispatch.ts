/**
 * rpc-dispatch.ts — RPC router + adminOnly + rpcMeta + default-deny.
 *
 * Port từ v3.6 server/index.js lines 145-198, nhưng dùng Zod validation
 * từ @cencom/contract thay vì validate thô.
 *
 * Flow:
 * 1. Validate input với Zod schema (nếu có)
 * 2. Kiểm tra adminOnly (fn → roles[])
 * 3. Kiểm tra rpcMeta (fn → [module, feature])
 * 4. Default-deny: fn không khai báo → từ chối
 * 5. Gọi handler, wrap try/catch
 * 6. Invalidate cache nếu mutation
 */
import { RPC_SCHEMAS } from '@cencom/contract';
import * as core from '@cencom/core';
import { type Db } from '@cencom/core';
import { getUser, type AuthUser } from './auth-context';

/* ─── RPC Metadata ─── */

/** fn → allowed roles (admin-only functions) */
const ADMIN_ONLY: Record<string, string[]> = {
  userAdd: ['admin'],
  userSetPassword: ['admin'],
  userSetActive: ['admin'],
  permMatrix: ['admin'],
  permSave: ['admin'],
  thresholdsSet: ['admin'],
  auditList: ['admin'],
  previewStart: ['admin'],
  previewStop: ['admin'],
  previewState: ['admin'],
};

/** fn → danh sách role được phép (giới hạn chặt hơn rpcMeta).
 *  Dùng cho các chức năng nhạy cảm (xuất toàn bộ hồ sơ SC có chi phí). */
const ROLE_RESTRICT: Record<string, string[]> = {
  scHoSoXlsx: ['admin', 'giamdoc', 'ketoan'],
  hoSoSave: ['ketoan', 'admin'],
  hoSoGet: ['giamdoc', 'ketoan', 'xuong', 'kho', 'admin'],
  hoSoList: ['giamdoc', 'ketoan', 'xuong', 'kho', 'admin'],
  // v5.0 — feed "theo dõi toàn bộ" là độc quyền Giám đốc + admin ops.
  activityFeed: ['admin', 'giamdoc'],
};

/** fn → [module, feature] — CBAC permission check */
const RPC_META: Record<string, [string, string]> = {
  // SC
  scCreate: ['sc', 'tao'], scList: ['sc', 'xem'], scGet: ['sc', 'xem'],
  scApprove: ['sc', 'duy'], scStart: ['sc', 'sua'],
  scSetDeadline: ['sc', 'sua'],
  scWorkSet: ['sc', 'sua'], scWorkAdd: ['sc', 'sua'], scWorkDel: ['sc', 'sua'],
  scVtAdd: ['sc', 'sua'], scVtUpd: ['sc', 'sua'], scVtDel: ['sc', 'sua'],
  scFinish: ['sc', 'sua'],   scNghiem: ['sc', 'duy'],
  scTongDuyet: ['sc', 'duy'],
  // GĐ4: Mẫu 2/7/8 (in hồ sơ SC)
  scMau2: ['sc', 'xem'], scMau7: ['sc', 'xem'], scMau8: ['sc', 'xem'],
  // GĐ5: dashboard + tiến trình 8 bước
  scDashboard: ['sc', 'xem'], scTienTrinh: ['sc', 'xem'],
  // Kho
  vatTuList: ['kho', 'xem'], vatTuSave: ['kho', 'tao'], vatTuDel: ['kho', 'xoa'],
  tonKho: ['kho', 'xem'],
  phNhapList: ['kho', 'xem'], phNhapGet: ['kho', 'xem'], phNhapCreate: ['kho', 'tao'],
  phXuatList: ['kho', 'xem'], phXuatGet: ['kho', 'xem'], phXuatCreate: ['kho', 'xuat'],
  giaLichSuList: ['kho', 'xem'], thanhLyList: ['kho', 'xem'],
  autoGenCuHong: ['kho', 'tao'],
  // v4.3 Kho — báo cáo & chuyển kho
  tonKhoReport: ['kho', 'xem'], vatTuHistory: ['kho', 'xem'], phChuyenKhoCreate: ['kho', 'xuat'],
  // Mua (đề nghị mua)
  dmList: ['mua', 'xem'], dmDetail: ['mua', 'xem'],
  dmCreate: ['mua', 'tao'], dmFromSC: ['mua', 'tao'], dmFromBaoGia: ['mua', 'tao'],
  dmAutoBu: ['mua', 'tao'], dmDecide: ['mua', 'duy'], dmDelete: ['mua', 'xoa'],
  dmListBySc: ['mua', 'xem'],
  // Asset
  quyetToan: ['asset', 'quyet'], lichSuaList: ['asset', 'xem'],
  assetXe: ['asset', 'xem'], assetReport: ['asset', 'xem'],
  ncNgoaiReport: ['asset', 'xem'],
  // Ke toan (GĐ1 + GĐ3/GĐ4)
  ledgerPost: ['ke_toan', 'tao'], ledgerList: ['ke_toan', 'xem'],
  vatInvoiceSave: ['ke_toan', 'vat'], phieuChiCreate: ['ke_toan', 'chi'],
  congNoList: ['ke_toan', 'xem'], congNoChuaCoHoaDon: ['ke_toan', 'xem'], ledgerReport: ['ke_toan', 'baocao'], kyClose: ['ke_toan', 'ky'], kyOpen: ['ke_toan', 'ky'], ledgerReportPdf: ['ke_toan', 'baocao'],
  // v4.3 Ke toan — sổ quỹ / phiếu thu nội bộ
  phieuThuCreate: ['ke_toan', 'tao'],
  // v4.3 Báo cáo chi phí 3 bên & Đối soát (UAT TC-ST-04/TC-ST-05) —
  // chỉ vai có ke_toan.xem (ketoan, giamdoc) được gọi; role khác bị chặn qua CBAC.
  baoCaoChiPhi: ['ke_toan', 'xem'],
  doiSoat: ['ke_toan', 'xem'],
  // Chat
  chatPeers: ['chat', 'xem'], chatThreadOpen: ['chat', 'tao'],
  chatList: ['chat', 'xem'], chatMessages: ['chat', 'xem'],
  chatSend: ['chat', 'tao'], chatSendImg: ['chat', 'tao'],
  chatMarkRead: ['chat', 'xem'], chatUnreadCount: ['chat', 'xem'],
  chatDeleteMsg: ['chat', 'tao'],
  // DeXuat (thay thế TK)
  deXuatCreate: ['de_xuat', 'tao'], deXuatList: ['de_xuat', 'xem'],
  deXuatGet: ['de_xuat', 'xem'], deXuatApprove: ['de_xuat', 'duy'],
  deXuatToSC: ['de_xuat', 'sua'],
  // Search (GĐ-3)
  globalSearch: ['search', 'xem'],
  // Xe / Khách hàng (GĐ-4)
  xeList: ['xe', 'xem'], xeGet: ['xe', 'xem'], xeSave: ['xe', 'sua'], xeReminders: ['xe', 'xem'],
  khachHangList: ['xe', 'xem'], khachHangGet: ['xe', 'xem'], khachHangSave: ['xe', 'sua'], khachHangDel: ['xe', 'xoa'],
  // v4.3 Xe — đánh giá xe & lịch bảo dưỡng (Xưởng)
  xeScoreSave: ['xe', 'sua'], xeScoreGet: ['xe', 'xem'],
  baoDuongTao: ['xe', 'sua'], baoDuongList: ['xe', 'xem'],
  // Xuong
  xuongDashboard: ['xuong', 'xem'], dashboardAll: ['xuong', 'xem'],
  // BaoGia
  baoGiaList: ['mua', 'xem'], baoGiaGet: ['mua', 'xem'],
  baoGiaCreate: ['mua', 'tao'], baoGiaConfirm: ['mua', 'tao'], baoGiaDel: ['mua', 'xoa'],
  // NhanKy
  nhanKyList: ['sc', 'xem'], nhanKySet: ['sc', 'sua'],
  // v4.3 SC — phương án sửa chữa (Xưởng)
  scProposalSave: ['sc', 'sua'], scProposalList: ['sc', 'xem'],
  // v4.3 SC — ảnh hiện trường
  scAnhSave: ['sc', 'sua'],
  // CheckHoSo
  checkHoSo: ['sc', 'xem'],
  // Ho so ke toan (GĐ5) — chi ketoan duoc luu; cac role xem deu duoc
  hoSoSave: ['hoso', 'tao'], hoSoGet: ['hoso', 'xem'], hoSoList: ['hoso', 'xem'],
  // Welcome — welcomeData nằm trong PUBLIC_FNS (mọi user đăng nhập đều gọi được
  // để hiện badge/thông báo), không cần khai báo meta (tránh check perm module 'all').
  // Report
  userList: ['report', 'xem'],
  auditList: ['report', 'xem'],
  scHoSoXlsx: ['report', 'xem'],
};

/** Public functions — mọi role đã đăng nhập đều gọi được */
const PUBLIC_FNS = [
  'currentUser', 'changePassword', 'appInfo', 'myPerms',
  'roleOptions', 'welcomeData', 'thresholds',
  'vehiclesOptions', 'phongbanList', 'checklistGroups', 'formInitData',
  'previewState', 'previewStop', 'previewInfo', 'previewHome', 'previewSC',
  'previewKho', 'previewDM',
  // SC functions —大多数 role cần xem SC
  'scList', 'scGet', 'congViecList',
  // Kho —多数 role cần xem kho
  'vatTuList', 'tonKho', 'giaLichSuList',
  // Xuong dashboard
  'xuongDashboard', 'dashboardAll',
  // DeXuat
  'deXuatList', 'deXuatGet',
  // Asset
  'assetXe', 'assetReport', 'lichSuaList', 'ncNgoaiReport',
  // Chat
  'chatPeers', 'chatList', 'chatMessages', 'chatUnreadCount',
];

/* ─── Preview mode guard ─── */
const PREVIEW_MUTATION_BLOCK = [
  'scCreate', 'scApprove', 'scStart', 'scFinish', 'scNghiem',
  'scWorkSet', 'scWorkAdd', 'scWorkDel',
  'scVtAdd', 'scVtUpd', 'scVtDel',
  'dmCreate', 'dmDecide', 'dmDelete',
  'phNhapCreate', 'phXuatCreate',
  'chatSend', 'chatSendImg', 'chatDeleteMsg',
  'deXuatCreate', 'deXuatApprove', 'deXuatToSC',
  'baoGiaCreate', 'baoGiaDel', 'baoGiaConfirm',
  'nhanKySet', 'quyetToan',
  'vatTuSave', 'vatTuDel',
  'userAdd', 'userSetPassword', 'userSetActive',
  'permSave', 'thresholdsSet',
  // v4.3 mutations
  'phChuyenKhoCreate', 'phieuThuCreate',
  'scProposalSave', 'xeScoreSave', 'baoDuongTao', 'scAnhSave',
];

/* ─── Types ─── */
export interface RpcResult {
  ok: boolean;
  result?: unknown;
  error?: string;
}

/* ─── Resolve handler từ @cencom/core ───
 * @cencom/core export theo NAMESPACE (sc, kho, chat, de_xuat...),
 * còn RPC contract dùng TÊN FLAT (scList, phNhapList, chatPeers...).
 * Do đó lookup flat `core[fn]` luôn undefined cho các hàm namespace.
 * Hàm này thử flat trước, rồi quét mọi namespace để tìm handler đúng. */
function resolveHandler(fn: string): unknown {
  const flat = (core as Record<string, unknown>)[fn];
  if (typeof flat === 'function') return flat;
  for (const key of Object.keys(core)) {
    const ns = (core as Record<string, unknown>)[key];
    if (ns && typeof ns === 'object') {
      const h = (ns as Record<string, unknown>)[fn];
      if (typeof h === 'function') return h;
    }
  }
  return undefined;
}

/* ─── Core dispatch logic ─── */
export async function dispatchRpc(
  fn: string,
  args: unknown[],
  user: AuthUser,
  db: Db,
): Promise<RpcResult> {
  try {
    // 1. Check adminOnly
    const adminRoles = ADMIN_ONLY[fn];
    if (adminRoles && !adminRoles.includes(user.role)) {
      return { ok: false, error: 'Không có quyền truy cập chức năng này (admin only)' };
    }

    // 1b. Check role-restrict (chức năng nhạy cảm)
    const allow = ROLE_RESTRICT[fn];
    if (allow && !allow.includes(user.role)) {
      return { ok: false, error: 'Chức năng này giới hạn quyền truy cập (role restricted)' };
    }

    // 2. Check rpcMeta (CBAC) — skip cho public functions
    const meta = RPC_META[fn];
    if (!meta && !PUBLIC_FNS.includes(fn) && !adminRoles && !allow) {
      // Default-deny: fn không khai báo → CHẶN
      // (cho phép cả fn chỉ nằm trong ROLE_RESTRICT — đã check ở bước 1b).
      return { ok: false, error: `Chức năng '${fn}' không được phép truy cập` };
    }

    // 3. Permission check (nếu có rpcMeta)
    if (meta) {
      const [mod, feat] = meta;
      const allowed = await core.perm.can(db, user.role, mod, feat);
      if (!allowed) {
        return { ok: false, error: `Không có quyền ${feat} trên module ${mod}` };
      }
    }

    // 4. Validate input với Zod schema (nếu có)
    const schema = RPC_SCHEMAS[fn];
    let validatedArgs: unknown[] = args;
    if (schema && args.length > 0) {
      const result = schema.safeParse(args[0]);
      if (!result.success) {
        const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        return { ok: false, error: `Dữ liệu đầu vào sai: ${errors}` };
      }
      validatedArgs = [result.data];
    }

    // 5. Build API object cho core functions
    const api = buildApi(user, db);

    // 6. Gọi handler (lookup flat + namespace)
    const handler = resolveHandler(fn);
    if (typeof handler !== 'function') {
      return { ok: false, error: `Handler '${fn}' không tồn tại` };
    }

    let result: unknown;
    if (typeof handler === 'function') {
      // Most core functions take (api, ...args) as first params
      result = await (handler as Function)(api, ...validatedArgs);
    }

    // 7. Invalidate cache nếu mutation
    if (meta && meta[1] !== 'xem') {
      core.cache.clearAll();
    }

    return { ok: true, result };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[RPC] Error in ${fn}:`, msg);
    return { ok: false, error: msg };
  }
}

/* ─── Build API object for core modules ─── */
function buildApi(user: AuthUser, db: Db): Record<string, unknown> {
  return {
    db,
    auth: {
      currentName: () => user.name,
      current: () => user,
    },
    // BẮT BUỘC: core functions (checkLock, perm.can...) dùng api.perm.
    // Thiếu trường này sẽ throw "Cannot read properties of undefined (reading 'can')".
    perm: core.perm,
  };
}
