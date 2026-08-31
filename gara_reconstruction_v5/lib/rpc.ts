import type { Api } from './types';
import * as sc from './core/sc';
import * as kho from './core/kho';
import * as bg from './core/baogia';
import * as hs from './core/ho_so';
import * as act from './core/activity';
import * as xe from './core/xe';
import { can, ROLES } from './perm';

export const FN_LIST: string[] = [
  'login',
  'logout',
  'currentUser',
  'appInfo',
  'xeList',
  'xeGet',
  'xeCreate',
  'scList',
  'scGet',
  'scCreate',
  'scAddCongViec',
  'scAddVatTu',
  'scBatDauSua',
  'scHoanThanh',
  'scTuChoi',
  'scQuyetToan',
  'vattuList',
  'vattuGet',
  'vattuCreate',
  'nhapKho',
  'xuatKho',
  'dmCreate',
  'dmNhap',
  'baogiaList',
  'baogiaGet',
  'baogiaSave',
  'hoSoGet',
  'hoSoSave',
  'hoSoList',
  'hoSoCheck',
  'keHoachSave',
  'kiemTuSave',
  'nghiemThuSave',
  'activityFeed',
  'dashboard',
  'report',
];

export const OPEN: Set<string> = new Set(['login', 'logout', 'currentUser', 'appInfo']);

const META: Record<string, [string, string]> = {
  xeList: ['xe', 'xem'],
  xeGet: ['xe', 'xem'],
  xeCreate: ['xe', 'tao'],
  scList: ['sc', 'xem'],
  scGet: ['sc', 'xem'],
  scCreate: ['sc', 'tao'],
  scAddCongViec: ['sc', 'sua'],
  scAddVatTu: ['sc', 'sua'],
  scBatDauSua: ['sc', 'sua'],
  scHoanThanh: ['sc', 'sua'],
  scTuChoi: ['sc', 'sua'],
  scQuyetToan: ['sc', 'kehoach'],
  vattuList: ['kho', 'xem'],
  vattuGet: ['kho', 'xem'],
  vattuCreate: ['kho', 'tao'],
  nhapKho: ['kho', 'tao'],
  xuatKho: ['kho', 'xuat'],
  dmCreate: ['kho', 'tao'],
  dmNhap: ['kho', 'tao'],
  baogiaList: ['baogia', 'xem'],
  baogiaGet: ['baogia', 'xem'],
  baogiaSave: ['baogia', 'tao'],
  hoSoGet: ['hoso', 'xem'],
  hoSoSave: ['hoso', 'tao'],
  hoSoList: ['hoso', 'xem'],
  hoSoCheck: ['hoso', 'xem'],
  keHoachSave: ['sc', 'sua'],
  kiemTuSave: ['sc', 'sua'],
  nghiemThuSave: ['sc', 'kehoach'],
  activityFeed: ['activityFeed', 'xem'],
  dashboard: ['dashboard', 'xem'],
  report: ['report', 'xem'],
};

/* eslint-disable no-unused-vars */
const HANDLERS: Record<string, (_api: Api, _args: any) => Promise<any>> = {
  // OPEN handlers (no auth required)
  login: async (_api, _args) => {
    // Login is handled by /api/auth route; RPC login returns guidance
    return { ok: true, result: { message: 'Use /api/auth with action=login' } };
  },
  logout: async (_api, _args) => {
    // Actual cookie clearing is done by /api/auth route; RPC logout returns ok
    return { ok: true, result: { loggedOut: true } };
  },
  currentUser: async (api, _args) => {
    const actor = api.auth.current();
    return { ok: true, result: actor };
  },
  appInfo: async (_api, _args) => {
    return { ok: true, result: { name: 'cencomOS Gara v5', version: process.env.npm_package_version || '5.0.0', roles: ROLES } };
  },
  // Authenticated handlers
  xeList: (api, _a) => xe.xeList(api),
  xeGet: (api, a) => xe.xeGet(api, a.id),
  xeCreate: (api, a) => xe.xeCreate(api, a),
  scList: (api, a) => sc.scList(api, a),
  scGet: (api, a) => sc.scGet(api, a.id),
  scCreate: (api, a) => sc.scCreate(api, a),
  scAddCongViec: (api, a) => sc.scAddCongViec(api, a),
  scAddVatTu: (api, a) => sc.scAddVatTu(api, a),
  scBatDauSua: (api, a) => sc.scBatDauSua(api, a),
  scHoanThanh: (api, a) => sc.scHoanThanh(api, a),
  scTuChoi: (api, a) => sc.scTuChoi(api, a),
  scQuyetToan: (api, a) => sc.scQuyetToan(api, a),
  vattuList: (api, _a) => kho.vattuList(api),
  vattuGet: (api, a) => kho.vattuGet(api, a.id),
  vattuCreate: (api, a) => kho.vattuCreate(api, a),
  nhapKho: (api, a) => kho.nhapKho(api, a),
  xuatKho: (api, a) => kho.xuatKho(api, a),
  dmCreate: (api, a) => kho.dmCreate(api, a),
  dmNhap: (api, a) => kho.dmNhap(api, a),
  baogiaList: (api, _a) => bg.baogiaList(api),
  baogiaGet: (api, a) => bg.baogiaGet(api, a.id),
  baogiaSave: (api, a) => bg.baogiaSave(api, a),
  hoSoGet: (api, a) => hs.hoSoGet(api, a.sc_id),
  hoSoSave: (api, a) => hs.hoSoSave(api, a),
  hoSoList: (api, a) => hs.hoSoList(api, a),
  hoSoCheck: (api, a) => hs.checkHoSo(api, a.sc_id),
  keHoachSave: (api, a) => hs.keHoachSave(api, a),
  kiemTuSave: (api, a) => hs.kiemTuSave(api, a),
  nghiemThuSave: (api, a) => hs.nghiemThuSave(api, a),
  activityFeed: (api, a) => act.activityFeed(api, a),
  dashboard: (_api, _a) => Promise.resolve({ ok: true }),
  report: (_api, _a) => Promise.resolve({ ok: true }),
};
/* eslint-enable no-unused-vars */

/**
 * Expose the full RPC registry for MCP server and testing.
 * Returns read-only references — callers must NOT mutate.
 */
export function getRegistry() {
  return { FN_LIST, META, HANDLERS, OPEN };
}

export async function dispatch(api: Api, fn: string, args: any): Promise<any> {
  if (!HANDLERS[fn]) throw new Error('Unknown fn: ' + fn);
  if (!OPEN.has(fn)) {
    const actor = api.auth.current();
    if (!actor) throw new Error('401');
    // Fail-closed: fn chưa khai báo META quyền → TỪ CHỐI (tránh quên khai báo khi thêm fn mới)
    const meta = META[fn];
    if (!meta) throw new Error('403');
    const [m, f] = meta;
    if (!(await can(api.db, actor.role, m, f))) throw new Error('403');
  }
  return await HANDLERS[fn](api, args || {});
}
