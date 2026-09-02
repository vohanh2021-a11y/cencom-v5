import request from 'supertest';
import { getAdminToken, getGiamdocToken, getXuongToken, getKetoanToken, getKhoToken, getTokens } from './setup';
// Registry import (read-only) — pattern đã dùng ở kho_phieu2tang/asset_gttv/mcp tests.
import { getRegistry } from '../../lib/rpc';
import { can } from '../../lib/perm';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const rpc = (token: string, fn: string, args: any = {}) => request(BASE).post('/api/rpc').set('Cookie', [`sid=${token}`]).send({ fn, args });

const { FN_LIST, META, OPEN } = getRegistry();

// Expected permissions per role (suy từ lib/perm.ts MATRIX × META trong lib/rpc.ts — không hardcode bừa).
// admin = bypass all (always ALLOW — lib/perm.ts dong 14), PERMS.admin de trong vi can() khong ap dung.
//
// W2.tech-debt — cac fn MO RONG va cach suy ky vong (fn → META [module, action] → MATRIX[role][module] chua action?):
//   phieuList, phieuGet                      → [kho, xem]      → ca 4 role deu co kho:['xem']              → ALLOW het
//   assetXe, assetReport                     → [xe, xem]       → ca 4 role deu co xe:['xem']               → ALLOW het
//   tonKho, giaLichSuList, thanhLyList       → [kho, xem]      → ca 4 role deu co kho:['xem']              → ALLOW het
//   hoSoCheck                                → [hoso, xem]     → ca 4 role deu co hoso:['xem']             → ALLOW het
//   keHoachSave, kiemTuSave                  → [sc, sua]       → chi xuong co sua trong sc                  → DENY giamdoc/ketoan/kho
//   nghiemThuSave                            → [sc, kehoach]   → xuong + ketoan co kehoach trong sc         → DENY giamdoc/kho
//   dmList, dmDetail, dmListBySc             → [kho, xem]      → ca 4 role deu co kho:['xem']              → ALLOW het
//   dmDelete (W2a, soft-delete)              → [kho, sua]      → chi role kho co 'sua' trong kho            → DENY giamdoc/xuong/ketoan
//   dmDecide (W2b, gate RỘNG — quyền duyệt thật enforce TRONG core theo
//     ngưỡng duyet_mua_nguong + MATRIX mua.duy, xem lib/rpc.ts comment)
//                                            → [kho, xem]      → ca 4 role deu co kho:['xem']              → ALLOW het (args {} → envelope validate 200)
//   dmFromSC, dmAutoBu (W2b, CREATE DM)      → [kho, tao]      → chi role kho co 'tao' trong kho            → DENY giamdoc/xuong/ketoan
//   scWorkSet, scWorkDel, scVtUpd,           → [sc, sua]       → chi xuong co 'sua' trong sc                → DENY giamdoc/ketoan/kho
//   scVtDel, scSetDeadline (W3.3A, core/sc.ts)                                                            (gate de_xuat INSIDE handler —
//     args {} → 'Thiếu id' 400, khong phai 403 handler-layer nen KHONG can HANDLER_LAYER_DENIES;
//     xuong ALLOW voi args {} → 400 ∈ [200,400] hop le, nghiep vu that da verify sc_workline.test.ts)
//   thoList (W3.3A, READ danh sach tho)      → [sc, xem]       → ca 4 role deu co sc:['xem']                → ALLOW het (khong tham so)
//   scApprove, scTongDuyet (W3.5, core/sc.ts) → [sc, duy]      → MATRIX sc.duy = {giamdoc, xuong}(+admin
//     bypass) — xuong mang 'duy' thay vai 'quanly' v3.6 (perm.js:25–26, lib/perm.ts W3.5 comment);
//     NGƯỠNG duyet_sc_nguong + trang thai + CHOT phan quyet TRONG core (envelope, khong throw).
//     → ALLOW giamdoc/xuong: args {} → envelope {ok:false,error:'id...'} → route wrap body.ok=true 200
//       (khong can FN_ARGS — khong co ghi that voi args rong); DENY ketoan/kho 403 tai dispatch.
//   dashboardAll (W3.1-reg, core/xuong.ts)   → [sc, xem]       → ca 4 role deu co sc:['xem']                → ALLOW het 4 o TANG HTTP:
//     core ham moi (W1b+) KHONG throw — ketoan bi chan cung '403' theo v3.6 nam TRONG envelope long
//     {ok:true, result:{ok:false, error:'403'}} → route tra 200; rbac chi bat code HTTP →Allow. Chan that
//     o core da verified xuong_kanban.test.ts TC1 (khong can them HANDLER_LAYER_DENIES — guard can() cung
//     cho true, khong sinh mismatch; layout nay KHONG giong xuong.scQuyetToan o throw 403 that su HTTP).
//   W4-reg (dot gop registry) — 8 fn moi, cach suy KINH NGHIEM y het:
//     userList, userAdd, userSetPassword, userSetActive → [user, admin] — MATRIX KHÔNG cấp module 'user'
//       cho 4 role non-admin (chỉ admin entry tài liệu-hóa + bypass can()) → serverAllows=false → PERMS
//       false → HTTP 403 TANG DISPATCH (throw Error('403'),route đổi 403 that — khong phai envelope;
//       core gateAdmin là lớp 2 không kịp chạy). ADMIN: bypass → ALLOW, args {} → envelope {ok:false,
//       'Cần tên...'} của lõi → route wrapped 200 ∈ [200,400] — khong co ghi that (userAdd {} fail-fast
//       truoc INSERT; userList {} chi doc).
//     thresholdsGet, thresholdsSet → [config, admin] → tương tự: DENY 4- role, ADMIN ALLOW (thresholdsSet
//       args {} → envelope 'Key không hợp lệ' 200, khong ghi config).
//     globalSearch → [sc, xem] → ca 4 role deu co sc:['xem'] → ALLOW het; args {} (khong co entry FN_ARGS)
//       → envelope {'q tối thiểu 2 ký tự'} → 200 wrapped, khong query nan. (Nghiep vu that + escape:
//       search_core.test.ts — ca core lan HTTP reg.)
//     changePassword → [security, doi_mk] → MATRIX W4-reg cap security:['doi_mk'] cho CA 4 non-admin
//       (va admin bypass) → ALLOW het: day la TINH NHAT THIET KE — route must_change whitelist (W4.1) mo
//       cua cho moi user TU doi mk cua minh; chan o dispatch = deadlock tai khoan. Args {} → verify old
//       sai → envelope {'Mật khẩu cũ không đúng.'} 200, KHONG doi mk that + KHONG clear co (chi doi
//       khi old dung). cpFail dem +1/role/lan chay — duoi nguong 5/15', vo hai voi harness user.
// fn W2a/W2b da co THAT trong FN_LIST khi chay gate → da them vao bang tren (khong doan ten fn chua đăng ký;
// RBAC_FNS derive tu FN_LIST nen fn moi TU DONG duoc kiem tra — phai cap nhat PERMS cung luc dang ky META).
//
// LUU Y: KHONG cap id that cho dmDelete trong FN_ARGS — args {} → handler fail-fast validate (400),
// tranh soft-delete nham data nhap that tren DB chung cua swarm. ALLOW case chi can HTTP ∈ [200,400].
// W2b cung nguyen tac: dmDecide/dmFromSC KHONG co entry FN_ARGS (args {} → envelope {ok:false}
// van 200 hop le); dmAutoBu khong tham so → ALLOW case chay that nhung seed sach (ton>=ton_min)
// → no-op 'Không cần bổ sung tồn.'
const PERMS: Record<string, Record<string, boolean>> = {
  admin: {},
  giamdoc: { xeList:true, xeGet:true, xeCreate:false, scList:true, scGet:true, scCreate:false, scAddCongViec:false, scAddVatTu:false, scBatDauSua:false, scHoanThanh:false, scTuChoi:false, scQuyetToan:false, vattuList:true, vattuGet:true, vattuCreate:false, nhapKho:false, xuatKho:false, dmCreate:false, dmNhap:false, baogiaList:true, baogiaGet:true, baogiaSave:false, hoSoGet:true, hoSoSave:false, hoSoList:true, activityFeed:true, dashboard:true, dashboardAll:true, report:true, phieuList:true, phieuGet:true, assetXe:true, assetReport:true, tonKho:true, giaLichSuList:true, thanhLyList:true, hoSoCheck:true, keHoachSave:false, kiemTuSave:false, nghiemThuSave:false, dmList:true, dmDetail:true, dmListBySc:true, dmDelete:false, dmDecide:true, scWorkSet:false, scWorkDel:false, scVtUpd:false, scVtDel:false, scSetDeadline:false, thoList:true, scApprove:true, scTongDuyet:true, globalSearch:true, changePassword:true, bossDashboard:true, bossAlerts:true, userList:false, userAdd:false, userSetPassword:false, userSetActive:false, thresholdsGet:false, thresholdsSet:false },
  xuong: { xeList:true, xeGet:true, xeCreate:false, scList:true, scGet:true, scCreate:true, scAddCongViec:true, scAddVatTu:true, scBatDauSua:true, scHoanThanh:true, scTuChoi:true, scQuyetToan:false, vattuList:true, vattuGet:true, vattuCreate:false, nhapKho:false, xuatKho:false, dmCreate:false, dmNhap:false, baogiaList:true, baogiaGet:true, baogiaSave:false, hoSoGet:true, hoSoSave:false, hoSoList:true, activityFeed:true, dashboard:true, dashboardAll:true, report:false, phieuList:true, phieuGet:true, assetXe:true, assetReport:true, tonKho:true, giaLichSuList:true, thanhLyList:true, hoSoCheck:true, keHoachSave:true, kiemTuSave:true, nghiemThuSave:true, dmList:true, dmDetail:true, dmListBySc:true, dmDelete:false, dmDecide:true, scWorkSet:true, scWorkDel:true, scVtUpd:true, scVtDel:true, scSetDeadline:true, thoList:true, scApprove:true, scTongDuyet:true, globalSearch:true, changePassword:true, bossDashboard:true, bossAlerts:true, userList:false, userAdd:false, userSetPassword:false, userSetActive:false, thresholdsGet:false, thresholdsSet:false },
  ketoan: { xeList:true, xeGet:true, xeCreate:false, scList:true, scGet:true, scCreate:false, scAddCongViec:false, scAddVatTu:false, scBatDauSua:false, scHoanThanh:false, scTuChoi:false, scQuyetToan:true, vattuList:true, vattuGet:true, vattuCreate:false, nhapKho:false, xuatKho:false, dmCreate:false, dmNhap:false, baogiaList:true, baogiaGet:true, baogiaSave:true, hoSoGet:true, hoSoSave:true, hoSoList:true, activityFeed:true, dashboard:true, dashboardAll:true /* core-parity-block trong envelope (route.ts:33 wrap ok:true; result={ok:false,error:'403'}) — HTTP van 200, rbac chi bat code; chan that verified xuong_kanban TC1 */, report:true, phieuList:true, phieuGet:true, assetXe:true, assetReport:true, tonKho:true, giaLichSuList:true, thanhLyList:true, hoSoCheck:true, keHoachSave:false, kiemTuSave:false, nghiemThuSave:true, dmList:true, dmDetail:true, dmListBySc:true, dmDelete:false, dmDecide:true, scWorkSet:false, scWorkDel:false, scVtUpd:false, scVtDel:false, scSetDeadline:false, thoList:true, scApprove:false, scTongDuyet:false, globalSearch:true, changePassword:true, bossDashboard:true, bossAlerts:true, userList:false, userAdd:false, userSetPassword:false, userSetActive:false, thresholdsGet:false, thresholdsSet:false },
  kho: { xeList:true, xeGet:true, xeCreate:false, scList:true, scGet:true, scCreate:false, scAddCongViec:false, scAddVatTu:false, scBatDauSua:false, scHoanThanh:false, scTuChoi:false, scQuyetToan:false, vattuList:true, vattuGet:true, vattuCreate:true, nhapKho:true, xuatKho:true, dmCreate:true, dmNhap:true, baogiaList:true, baogiaGet:true, baogiaSave:false, hoSoGet:true, hoSoSave:false, hoSoList:true, activityFeed:true, dashboard:false, dashboardAll:true, report:false, phieuList:true, phieuGet:true, assetXe:true, assetReport:true, tonKho:true, giaLichSuList:true, thanhLyList:true, hoSoCheck:true, keHoachSave:false, kiemTuSave:false, nghiemThuSave:false, dmList:true, dmDetail:true, dmListBySc:true, dmDelete:true, dmDecide:true, dmFromSC:true, dmAutoBu:true, scWorkSet:false, scWorkDel:false, scVtUpd:false, scVtDel:false, scSetDeadline:false, thoList:true, scApprove:false, scTongDuyet:false, globalSearch:true, changePassword:true, bossDashboard:true, bossAlerts:true, userList:false, userAdd:false, userSetPassword:false, userSetActive:false, thresholdsGet:false, thresholdsSet:false },
};

// OPEN functions that don't require auth - not part of RBAC matrix.
// Đây là "human spec" độc lập; test guard bên dưới đối chiếu với registry OPEN thật (lib/rpc.ts)
// để nếu server thêm/bớt OPEN fn mà quên cập nhật test → đỏ ngay.
const OPEN_FNS = new Set(['login', 'logout', 'currentUser', 'appInfo']);

// RBAC_FNS DERIVE trực tiếp từ FN_LIST trừ OPEN → không bao giờ bỏ sót fn mới đăng ký
// (fn mới chưa có trong PERMS → mặc định false → test đòi DENY; server fail-closed 403 khi
// chưa khai META — lib/rpc.ts dispatch — nên kỳ vọng vẫn đúng cho đến khi worker khai quyền).
const RBAC_FNS: string[] = FN_LIST.filter((f) => !OPEN_FNS.has(f));

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
  // --- W2.tech-debt: args cho fn mới. READ fn ({}, mặc định an toàn) không cần entry.
  // ALLOW case chỉ cần HTTP nằm trong [200,400] — id test để an toàn (404/500 mới là lỗi thật).
  phieuGet: {id: 'PX-000001'},
  assetXe: {id: 'XE-000001'},
  giaLichSuList: {vattu_id: 'VT-000001', limit: 5},
  hoSoCheck: {sc_id: 'SC-000001'},
  keHoachSave: {sc_id: 'SC-000001', mo_ta: 'Test RBAC'},
  kiemTuSave: {sc_id: 'SC-000001', mo_ta: 'Test RBAC'},
  nghiemThuSave: {sc_id: 'SC-000001', ngay_nghiem: new Date().toISOString().split('T')[0]},
};

// Vai trò bị chặn ở tầng HANDLER (lớp RBAC thứ 2 SAU dispatch can()) — dẫn chứng trong source:
// 'xuong.scQuyetToan': lib/core/sc.ts scQuyetToan() chỉ cho ketoan/admin (ghi rõ theo v3.6
// perm.canQuyetToan + security.test.ts đòi giamdoc DENY). Xưởng qua dispatch (MATRIX
// xuong.sc có 'kehoach') nhưng handler ném 403 → runtime là DENY → bảng PERMS để false
// là ĐÚNG hành vi quan sát; guard static dùng can() không thấy lớp handler → ngoại lệ có chủ đích.
const HANDLER_LAYER_DENIES = new Set(['xuong.scQuyetToan']);

// Guards bất biến: registry (lib/rpc.ts) ↔ bảng PERMS ↔ MATRIX (lib/perm.ts) phải khớp nhau.
describe('RBAC guards (registry ↔ PERMS table ↔ perm.ts MATRIX)', () => {
  test('OPEN literal (human spec) matches registry OPEN set', () => {
    const registryOpen = FN_LIST.filter((f) => OPEN.has(f)).sort();
    expect(registryOpen).toEqual([...OPEN_FNS].sort());
  });

  test(`RBAC_FNS derives full coverage (FN_LIST ${FN_LIST.length} − OPEN ${OPEN_FNS.size} = ${RBAC_FNS.length})`, () => {
    expect(RBAC_FNS.length).toBe(FN_LIST.length - OPEN_FNS.size);
    for (const f of RBAC_FNS) {
      expect(OPEN.has(f)).toBe(false);
      expect(OPEN_FNS.has(f)).toBe(false);
    }
  });

  test('PERMS table agrees with server META×MATRIX (can() in lib/perm.ts)', async () => {
    const mismatches: string[] = [];
    for (const role of ROLES) {
      if (role === 'admin') continue; // admin bypass — bảng PERMS.admin rỗng có chủ đích
      for (const fn of RBAC_FNS) {
        const meta = META[fn];
        // Fail-closed: fn chưa khai META → server từ chối mọi role (trừ admin).
        const serverAllows = meta ? await can(null as never, role, meta[0], meta[1]) : false;
        // Trừ các vai bị chặn ở tầng handler (lớp 2 — xem HANDLER_LAYER_DENIES ở trên).
        const effectiveAllows = serverAllows && !HANDLER_LAYER_DENIES.has(`${role}.${fn}`);
        const tableAllows = PERMS[role][fn] ?? false;
        if (effectiveAllows !== tableAllows) {
          mismatches.push(`${role}.${fn}: table=${tableAllows} server=${effectiveAllows} meta=${meta ? meta.join('.') : 'NONE'}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe(`RBAC Matrix (${ROLES.length} role × ${RBAC_FNS.length} fn)`, () => {

  for (const role of ROLES) {
    for (const fn of RBAC_FNS) {
      // admin bypasses all permission checks (lib/perm.ts dong 14)
      const shouldAllow = role === 'admin' ? true : (PERMS[role][fn] ?? false);
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
