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
  'activityFeed',
  'dashboard',
  'report',
];

const OPEN: Set<string> = new Set(['login', 'logout', 'currentUser', 'appInfo']);

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
  activityFeed: ['activityFeed', 'xem'],
  dashboard: ['dashboard', 'xem'],
  report: ['report', 'xem'],
};

const HANDLERS: Record<string, (api: Api, args: any) => Promise<any>> = {
  // OPEN handlers (no auth required)
  login: async (api, args) => {
    // Login is handled by /api/auth route; RPC login returns guidance
    return { ok: true, result: { message: 'Use /api/auth with action=login' } };
  },
  logout: async (api, args) => {
    // Actual cookie clearing is done by /api/auth route; RPC logout returns ok
    return { ok: true, result: { loggedOut: true } };
  },
  currentUser: async (api, args) => {
    const actor = api.auth.current();
    return { ok: true, result: actor };
  },
  appInfo: async (api, args) => {
    return { ok: true, result: { name: 'cencomOS Gara v5', version: process.env.npm_package_version || '5.0.0', roles: ROLES } };
  },
  // Authenticated handlers
  xeList: (api, a) => xe.xeList(api),
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
  vattuList: (api, a) => kho.vattuList(api),
  vattuGet: (api, a) => kho.vattuGet(api, a.id),
  vattuCreate: (api, a) => kho.vattuCreate(api, a),
  nhapKho: (api, a) => kho.nhapKho(api, a),
  xuatKho: (api, a) => kho.xuatKho(api, a),
  dmCreate: (api, a) => kho.dmCreate(api, a),
  dmNhap: (api, a) => kho.dmNhap(api, a),
  baogiaList: (api, a) => bg.baogiaList(api),
  baogiaGet: (api, a) => bg.baogiaGet(api, a.id),
  baogiaSave: (api, a) => bg.baogiaSave(api, a),
  hoSoGet: (api, a) => hs.hoSoGet(api, a.sc_id),
  hoSoSave: (api, a) => hs.hoSoSave(api, a),
  hoSoList: (api, a) => hs.hoSoList(api, a),
  activityFeed: (api, a) => act.activityFeed(api, a),
  dashboard: (api, a) => Promise.resolve({ ok: true }),
  report: (api, a) => Promise.resolve({ ok: true }),
};

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
