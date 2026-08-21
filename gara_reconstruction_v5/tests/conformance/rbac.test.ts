import request from 'supertest';
import { getAdminToken, getGiamdocToken, getXuongToken, getKetoanToken, getKhoToken, getTokens } from './setup';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const rpc = (token: string, fn: string, args: any = {}) => request(BASE).post('/api/rpc').set('Cookie', [`sid=${token}`]).send({ fn, args });

// Expected permissions per role (from lib/perm.ts MATRIX)
// admin = bypass all (always ALLOW)
const PERMS = {
  admin: {},
  giamdoc: { xeList:true, xeGet:true, xeCreate:false, scList:true, scGet:true, scCreate:false, scAddCongViec:false, scAddVatTu:false, scBatDauSua:false, scHoanThanh:false, scTuChoi:false, scQuyetToan:false, vattuList:true, vattuGet:true, vattuCreate:false, nhapKho:false, xuatKho:false, dmCreate:false, dmNhap:false, baogiaList:true, baogiaGet:true, baogiaSave:false, hoSoGet:true, hoSoSave:false, hoSoList:true, activityFeed:true, dashboard:true, report:true },
  xuong: { xeList:true, xeGet:true, xeCreate:false, scList:true, scGet:true, scCreate:true, scAddCongViec:true, scAddVatTu:true, scBatDauSua:true, scHoanThanh:true, scTuChoi:true, scQuyetToan:false, vattuList:true, vattuGet:true, vattuCreate:false, nhapKho:false, xuatKho:false, dmCreate:false, dmNhap:false, baogiaList:true, baogiaGet:true, baogiaSave:false, hoSoGet:true, hoSoSave:false, hoSoList:true, activityFeed:true, dashboard:true, report:false },
  ketoan: { xeList:true, xeGet:true, xeCreate:false, scList:true, scGet:true, scCreate:false, scAddCongViec:false, scAddVatTu:false, scBatDauSua:false, scHoanThanh:false, scTuChoi:false, scQuyetToan:true, vattuList:true, vattuGet:true, vattuCreate:false, nhapKho:false, xuatKho:false, dmCreate:false, dmNhap:false, baogiaList:true, baogiaGet:true, baogiaSave:true, hoSoGet:true, hoSoSave:true, hoSoList:true, activityFeed:true, dashboard:true, report:true },
  kho: { xeList:true, xeGet:true, xeCreate:false, scList:true, scGet:true, scCreate:false, scAddCongViec:false, scAddVatTu:false, scBatDauSua:false, scHoanThanh:false, scTuChoi:false, scQuyetToan:false, vattuList:true, vattuGet:true, vattuCreate:true, nhapKho:true, xuatKho:true, dmCreate:true, dmNhap:true, baogiaList:true, baogiaGet:true, baogiaSave:false, hoSoGet:true, hoSoSave:false, hoSoList:true, activityFeed:true, dashboard:false, report:false },
};

// OPEN functions that don't require auth - not part of RBAC matrix
const OPEN_FNS = new Set(['login', 'logout', 'currentUser', 'appInfo']);

// All 32 functions from FN_LIST minus OPEN = 28 functions for RBAC testing
const RBAC_FNS = [
  'xeList','xeGet','xeCreate',
  'scList','scGet','scCreate','scAddCongViec','scAddVatTu','scBatDauSua','scHoanThanh','scTuChoi','scQuyetToan',
  'vattuList','vattuGet','vattuCreate',
  'nhapKho','xuatKho','dmCreate','dmNhap',
  'baogiaList','baogiaGet','baogiaSave',
  'hoSoGet','hoSoSave','hoSoList',
  'activityFeed','dashboard','report',
];

const ROLES = ['admin','giamdoc','xuong','ketoan','kho'] as const;

const FN_ARGS: Record<string, any> = {
  xeCreate: {bien_so:'TEST-001', chu_xe:'Test', nam_sx:2020, nguyen_gia:100000000},
  scCreate: {xe_id:'XE-000001', ngay: new Date().toISOString().split('T')[0]},
  scAddCongViec: {sc_id:'SC-000001', mo_ta:'Test', loai_xu_ly:'sua_chua', so_luong:1, don_gia:100000},
  scAddVatTu: {sc_id:'SC-000001', vattu_id:'VT-000001', so_luong:1},
  scBatDauSua: {sc_id:'SC-000001'},
  scHoanThanh: {sc_id:'SC-000001'},
  scTuChoi: {sc_id:'SC-000001', ly_do:'Test'},
  scQuyetToan: {sc_id:'SC-000001'},
  vattuCreate: {ten:'Test VT', don_vi:'cái', gia:50000, ton_min:10},
  nhapKho: {vattu_id:'VT-000001', so_luong:10, don_gia:50000, ngay: new Date().toISOString().split('T')[0], ly_do:'Test'},
  xuatKho: {vattu_id:'VT-000001', so_luong:5, ly_do:'Test'},
  dmCreate: {items: [{vattu_id:'VT-000001', so_luong:5, don_gia:50000}], ngay: new Date().toISOString().split('T')[0]},
  dmNhap: {dm_id:'DM-000001'},
  baogiaSave: {sc_id:'SC-000001', ncc:'NCC Test', ngay: new Date().toISOString().split('T')[0], items: [{ten:'Item 1', so_luong:1, don_gia:100000}]},
  hoSoSave: {sc_id:'SC-000001', so_chung_tu:'CT-001', ngay: new Date().toISOString().split('T')[0], ghi_chu:'Test'},
  activityFeed: {limit:10},
};

describe('RBAC Matrix (5 role × 28 fn)', () => {
  
  for (const role of ROLES) {
    for (const fn of RBAC_FNS) {
      const rolePerms = PERMS[role];
      // admin bypasses all permission checks (lib/perm.ts line 14)
      const shouldAllow = role === 'admin' ? true : (rolePerms[fn as keyof typeof rolePerms] ?? false);
      test(`${role} ${fn} ${shouldAllow ? 'ALLOW' : 'DENY'}`, async () => {
        const tokens = getTokens();
        const token = tokens[role];
        if (!token) throw new Error(`Token not set for role ${role}`);
        
        const res = await rpc(token, fn, FN_ARGS[fn] || {});
        
        if (shouldAllow) {
          // ALLOW: must return 200 with ok=true (or 400 if args invalid - that's not RBAC)
          expect([200, 400]).toContain(res.status);
          if (res.status === 200) expect(res.body.ok).toBe(true);
        } else {
          // DENY: must return 401 or 403
          expect([401, 403]).toContain(res.status);
        }
      });
    }
  }
});

// Separate test for OPEN functions - should work without auth or with any valid token
describe('OPEN functions (no RBAC)', () => {
  const tokens = getTokens();
  
  test('login works without token', async () => {
    const res = await request(BASE).post('/api/auth').send({action:'login', user:'admin', pass:'cencom@123'});
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
  
  for (const role of ROLES) {
    const token = tokens[role];
    if (!token) continue;
    
    test(`${role} can call logout`, async () => {
      const res = await rpc(token, 'logout');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
    
    test(`${role} can call currentUser`, async () => {
      const res = await rpc(token, 'currentUser');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
    
    test(`${role} can call appInfo`, async () => {
      const res = await rpc(token, 'appInfo');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
}
});