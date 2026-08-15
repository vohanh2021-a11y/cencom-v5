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
  previewStart: ['admin'],
  previewStop: ['admin'],
  previewState: ['admin'],
};

/** fn → [module, feature] — CBAC permission check */
const RPC_META: Record<string, [string, string]> = {
  // SC
  scCreate: ['sc', 'tao'], scList: ['sc', 'xem'], scGet: ['sc', 'xem'],
  scApprove: ['sc', 'duy'], scStart: ['sc', 'sua'],
  scSetDeadline: ['sc', 'sua'],
  scWorkSet: ['sc', 'sua'], scWorkAdd: ['sc', 'sua'], scWorkDel: ['sc', 'sua'],
  scVtAdd: ['sc', 'sua'], scVtUpd: ['sc', 'sua'], scVtDel: ['sc', 'sua'],
  scFinish: ['sc', 'sua'], scNghiem: ['sc', 'duy'],
  scTongDuyet: ['sc', 'duy'],
  // Kho
  vatTuList: ['kho', 'xem'], vatTuSave: ['kho', 'tao'], vatTuDel: ['kho', 'xoa'],
  tonKho: ['kho', 'xem'],
  phNhapList: ['kho', 'xem'], phNhapGet: ['kho', 'xem'], phNhapCreate: ['kho', 'tao'],
  phXuatList: ['kho', 'xem'], phXuatGet: ['kho', 'xem'], phXuatCreate: ['kho', 'xuat'],
  giaLichSuList: ['kho', 'xem'], thanhLyList: ['kho', 'xem'],
  autoGenCuHong: ['kho', 'tao'],
  // Mua (đề nghị mua)
  dmList: ['mua', 'xem'], dmDetail: ['mua', 'xem'],
  dmCreate: ['mua', 'tao'], dmFromSC: ['mua', 'tao'], dmFromBaoGia: ['mua', 'tao'],
  dmAutoBu: ['mua', 'tao'], dmDecide: ['mua', 'duy'], dmDelete: ['mua', 'xoa'],
  dmListBySc: ['mua', 'xem'],
  // Asset
  quyetToan: ['asset', 'quyet'], lichSuaList: ['asset', 'xem'],
  assetXe: ['asset', 'xem'], assetReport: ['asset', 'xem'],
  ncNgoaiReport: ['asset', 'xem'],
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
  // Xuong
  xuongDashboard: ['xuong', 'xem'], dashboardAll: ['xuong', 'xem'],
  // BaoGia
  baoGiaList: ['mua', 'xem'], baoGiaGet: ['mua', 'xem'],
  baoGiaCreate: ['mua', 'tao'], baoGiaConfirm: ['mua', 'tao'], baoGiaDel: ['mua', 'xoa'],
  baoGiaCompare: ['mua', 'xem'],
  // NhanKy
  nhanKyList: ['sc', 'xem'], nhanKySet: ['sc', 'sua'],
  // CheckHoSo
  checkHoSo: ['sc', 'xem'],
  // Welcome
  welcomeData: ['all', 'xem'],
  // Report
  userList: ['report', 'xem'],
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
  // Report
  'fleetReport', 'accountingReport',
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
];

/* ─── Types ─── */
export interface RpcResult {
  ok: boolean;
  result?: unknown;
  error?: string;
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

    // 2. Check rpcMeta (CBAC) — skip cho public functions
    const meta = RPC_META[fn];
    if (!meta && !PUBLIC_FNS.includes(fn) && !adminRoles) {
      // Default-deny: fn không khai báo → CHẶN
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

    // 6. Gọi handler
    const handler = (core as Record<string, unknown>)[fn];
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
    // Core modules pass their own API interfaces
    // This is a unified API object for the RPC dispatcher
  };
}
