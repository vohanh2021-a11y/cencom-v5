import type { Api } from './types';
import * as sc from './core/sc';
import * as kho from './core/kho';
import * as bg from './core/baogia';
import * as hs from './core/ho_so';
import * as act from './core/activity';
import * as xe from './core/xe';
import * as asset from './core/asset';
import * as xuong from './core/xuong';
import * as boss from './core/boss';
// W4-reg (đợt gộp): quản trị tài khoản + ngưỡng duyệt (core/admin.ts — gateAdmin
// TRỰC TIẾP trong lõi, theo pattern admin.ts header), tìm kiếm toàn cục
// (core/search.ts) và đổi mật khẩu tự thân (lib/auth.ts — port handlers.js:551).
import * as admin from './core/admin';
import * as search from './core/search';
import { changePassword as authChangePassword } from './auth';
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
  'phieuList',
  'phieuGet',
  // W1.6f: quyết toán tài sản — khấu hao + chi phí tích luỹ + GTTV (read-only)
  'assetXe',
  'assetReport',
  // W1b-reg: tồn kho (kèm cảnh báo thiếu + giá trị tồn) + lịch sử giá — read-only
  'tonKho',
  'giaLichSuList',
  // W1c-reg: bảng kê vật tư thanh lý — read-only.
  // autoGenCuHong/autoXuatSC (core/kho.ts) KHÔNG đăng ký ở đây: hàm nội bộ,
  // chạy trong transaction của ngữ cảnh khác — hook W3 scHoanThanh.
  'thanhLyList',
  // W2a (trục MUA SẮM): DM đề nghị mua — 3 fn đọc + dmDelete soft-delete.
  'dmList',
  'dmDetail',
  'dmListBySc',
  'dmDelete',
  // W2b: chuỗi duyệt DM — port v3.6 kho.js dmDecide (ngưỡng duyet_mua_nguong)
  // / dmFromSC (tạo DM từ sc_vattu can_mua) / dmAutoBu (bù tồn ton_min).
  'dmDecide',
  'dmFromSC',
  'dmAutoBu',
  // W3.1-reg: bảng điều khiển XƯỞNG (kanban 5 cột + KPI trong ngày) — read-only,
  // không tham số; 401/403 chặn theo v3.6 enforce TRONG core (envelope, không throw).
  'dashboardAll',
  // W3.3A (trục XƯỞNG — dòng công việc/vật tư + deadline + gán thợ):
  // scWorkSet/scWorkDel/scVtUpd/scVtDel port v3.6 sc.js (gate de_xuat + recalc CUỐI);
  // scSetDeadline port sc.js:274 (han_tra_xe, chặn de_xuat|tu_choi|da_quyet);
  // thoList port handlers.js:65 — READ danh sách thợ ('tho' v3.6 → 'xuong' v5).
  'scWorkSet',
  'scWorkDel',
  'scVtUpd',
  'scVtDel',
  'scSetDeadline',
  'thoList',
  // W3.5 (trục XƯỞNG — DUYỆT QC206): scApprove (duyệt theo ngưỡng tiền
  // duyet_sc_nguong, de_xuat→da_duyet) + scTongDuyet (tổng duyệt = chốt snapshot
  // bất biến sc_phien_ban). Port v3.6 sc.js:190–256 + perm.js:109–117.
  'scApprove',
  'scTongDuyet',
  // W4-reg (đợt gộp — fn đã có core từ W4.1/W4.2): QUẢN TRỊ TÀI KHOẢN + NGƯỠNG.
  // 4 fn user + 2 fn thresholds port v3.6 handlers.js:127–186/604–618
  // (lib/core/admin.ts). v3.6 KHÔNG đặt chúng trong rpcMeta — chặn bằng
  // adminOnly list (handlers.js:652–654; userList tọt rpcMeta ['report','xem']
  // nhưng core v5 gate admin NGAY TRONG LÕI — siết có chủ đích, xem header
  // admin.ts). Ở v5 META ['user','admin']/['config','admin'] chỉ là DÒNG AN
  // TOÀN: MATRIX (lib/perm.ts) không cấp module 'user'/'config' cho role nào
  // ngoài admin (bypass can() dòng 33) → non-admin fail-closed 403 ngay tại
  // dispatch, core là lớp chắn thứ hai.KHÔNG đổi hành vi core — reg gọi y chang.
  'userList',
  'userAdd',
  'userSetPassword',
  'userSetActive',
  'thresholdsGet',
  'thresholdsSet',
  // W4-reg · globalSearch: tìm toàn cục 4 bảng sc/xe/dm/vattu (v4
  // packages/core/src/search.ts — v3.6 không có fn này). META ['sc','xem']
  // đúng dự kiến search.ts header dòng 27–29 ("search.xem mọi role").
  'globalSearch',
  // W4-reg · changePassword: user TỰ đổi mật khẩu của chính mình (v3.6
  // publicFns handlers.js:668–674 + whitelist must_change index.js:155
  // — port vào route.ts MUST_CHANGE_WHITELIST W4.1). KHÔNG phải OPEN: handler
  // đọc api.auth.current() (nhân actor) → phải đăng nhập. Phán quyết ở CORE
  // (verify mk cũ + chống brute-force + cấm về default), không phải role —
  // MỌI vai đã đăng nhập đều được đổi mk của mình, kể cả đang bị must_change
  // khóa. META ['security','doi_mk']: MATRIX cấp security.doi_mk cho CẢ 5 vai
  // (tự service ≠ quyền dữ liệu).
  'changePassword',
  // W5-reg · bossDashboard/bossAlerts: bảng tổng quan + chuông cảnh báo cho
  // BOSS (lib/core/boss.ts — READ thuần, lắp ráp từ dashboardAll/tonKho/dmList
  // + 1 query SC quá hạn; không tham số, envelope ở lõi, fail-closed khi chưa
  // đăng nhập). META ['sc','xem']: MATRIX cấp sc.xem cho CẢ 5 vai + admin
  // bypass → dispatch mở mọi vai, nhưng các NHÁN nhạy cảm (kpi/ngưỡng duyệt)
  // tự rỗng với vai không được core cho (ketoan chặn dashboardAll; dm/ton
  // theo kho.xem) — quyền tinh nằm TRONG core, đúng pattern dashboardAll.
  'bossDashboard',
  'bossAlerts',
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
  //W1a: phiếu 2 tầng — READ trên module kho (mọi role có kho.xem)
  phieuList: ['kho', 'xem'],
  phieuGet: ['kho', 'xem'],
  // W1.6f: asset — module 'asset' CHƯA tồn tại trong MATRIX (lib/perm.ts);
  // META ['asset','xem'] sẽ fail-closed 403 mọi role trừ admin (dispatch dòng
  // can() tra rm['asset'] = undefined). Quyền bản chất là ĐỌC hồ sơ xe → ['xe','xem']
  // (MATRIX: giamdoc/xuong/ketoan/kho đều có xe.xem; admin bypass all).
  assetXe: ['xe', 'xem'],
  assetReport: ['xe', 'xem'],
  // W1b-reg: tồn kho + lịch sử giá — READ module kho (mọi role có kho.xem).
  // KHÔNG có fn ghi ở đây: ghiGiaLichSu là hàm nội bộ chạy trong transaction
  // của nhapKho/dmNhap/xuatKho (core/kho.ts), không phải RPC endpoint.
  tonKho: ['kho', 'xem'],
  giaLichSuList: ['kho', 'xem'],
  // W1c-reg: bảng kê thanh lý — READ module kho (mọi role có kho.xem).
  // autoGenCuHong/autoXuatSC không có entry: nội bộ, hook W3 scHoanThanh
  // (không phải RPC endpoint — xem comment FN_LIST).
  thanhLyList: ['kho', 'xem'],
  // W2a: bản chất READ phiếu DM → module kho (v3.6 dùng module 'mua' — v5 gộp
  // kho/mua một mối, theo precedent dmCreate/dmNhap ['kho','tao']). dmDelete =
  // GHI → ['kho','sua'] (MATRIX: role kho có 'sua'; giamdoc/xuong/ketoan KHÔNG
  // có → fail-closed 403, đúng ý "chỉ người tạo luồng kho được xóa nháp").
  dmList: ['kho', 'xem'],
  dmDetail: ['kho', 'xem'],
  dmListBySc: ['kho', 'xem'],
  dmDelete: ['kho', 'sua'],
  // W2b — dmDecide: v3.6 gate = checkLock('mua','duy') + quyền giá trị
  // canApproveMua (admin/giamdoc vô hạn; ketoan ≤ ngưỡng `duyet_mua_nguong`;
  // vai khác KHÔNG bao giờ duyệt). v5 đặt TOÀN BỘ phán quyết đó trong core
  // (lib/core/kho.ts dmDecide — fail-closed, cùng tập người duyệt với v3.6);
  // gate RPC dừng ở ['kho','xem'] (mọi role đọc được kho đều có thể *thử*
  // decide và nhận business error 'cần Giám đốc duyệt' khi thiếu quyền —
  // thiết kế chốt theo hợp đồng W2b, chặt hơn đúng nghĩa: không role nào
  // ngoài tập v3.6 ever thành công). QUYỀN TRÊN NGƯỠNG = MATRIX mua.duy
  // ['giamdoc'(+admin bypass)] — lib/perm.ts.
  dmDecide: ['kho', 'xem'],
  // W2b — dmFromSC/dmAutoBu: chất là TẠO DM (ghi dm + dm_chitiet) → ['kho','tao']
  // theo precedent dmCreate/dmNhap (v3.6 checkLock('mua','tao'); v5 gộp kho/mua).
  dmFromSC: ['kho', 'tao'],
  dmAutoBu: ['kho', 'tao'],
  // W3.1-reg — dashboardAll: v5 CHƯA có module 'xuong' trong MATRIX (lib/perm.ts),
  // nên gate RPC dừng ở ['sc','xem'] (bản chất dashboard đọc sc/xe/kho). Core đã
  // hard-chặn role 'ketoan' theo v3.6 (server/xuong.js dòng 122–124 whitelist
  // ['admin','giamdoc','quanly','xuong'] — port ở lib/core/xuong.ts, envelope
  // 403 không throw). LỆCH CHỦ ĐỊCH: role 'kho' có sc.xem nên xem được bảng này
  // (v3.6 không cho) — ghi nhận tại TODO(W3.1-reg) dòng 51–56 lib/core/xuong.ts:
  // siết về whitelist v3.6 cần thêm module 'xuong'/'dashboard' vào MATRIX,
  // quyết định thuộc coordinator — task reg chốt ['sc','xem'].
  dashboardAll: ['sc', 'xem'],
  // W3.3A — 5 fn GHI dòng phiếu: v3.6 handlers.js:681–683 khai báo TRÚNG ['sc','sua']
  // (scWorkSet/scWorkDel/scVtUpd/scVtDel + scSetDeadline dòng 681). Phán quyết NGHIỆP VỤ
  // (gate de_xuat, role hẹn trả xe, regex ngày) ở core lib/core/sc.ts.
  // LỆCH CÓ CHỦ ĐÍCH: MATRIX v5 'sc','sua' = xuong (+admin bypass) — Giamdoc v3.6 đặt được
  // hẹn trả xe (sc.js:276) thì v5 bị dispatch 403. Chốt theo spec W3.3A ['sc','sua'].
  scWorkSet: ['sc', 'sua'],
  scWorkDel: ['sc', 'sua'],
  scVtUpd: ['sc', 'sua'],
  scVtDel: ['sc', 'sua'],
  scSetDeadline: ['sc', 'sua'],
  // W3.3A — thoList: v3.6 ['tk','sua'] (handlers.js:711) nhưng v5 KHÔNG có module 'tk';
  // bản chất là READ dropdown thợ phục vụ gán việc SC → chốt ['sc','xem'] (mọi role xem
  // được phiếu chọn được thợ; dữ liệu trả về chỉ id+name, không nhạy cảm).
  thoList: ['sc', 'xem'],
  // W3.5 — 2 fn DUYỆT: META ['sc','duy'] đúng khai báo v3.6 handlers.js:680/726
  // ('scApprove'/'scTongDuyet': ['sc','duy']). MATRIX v5 (lib/perm.ts W3.5
  // comment): giamdoc (vô hạn) + xuong (nhánh NGƯỠNG ≤ duyet_sc_nguong — thay
  // vai 'quanly' v3.6 đã gộp) + admin bypass; ketoan/kho fail-closed 403 ngay
  // tại dispatch (nhất quán v3.6: không 'duy' trong sc MATRIX). Phán quyết
  // NGƯỠNG + TRẠNG THÁI nằm TRONG core lib/core/sc.ts (envelope business error
  // chứa 'Giám đốc' — cùng khuôn W2b dmDecide, tập người-duyệt-được ≡ v3.6).
  scApprove: ['sc', 'duy'],
  scTongDuyet: ['sc', 'duy'],
  // ── W4-reg (đợt gộp) — quản trị tài khoản / ngưỡng / search / đổi mk ────
  // 4 fn user + 2 fn thresholds: admin gate ĐÃ nằm TRONG core (gateAdmin,
  // lib/core/admin.ts:79–84 — envelope 401/403, pattern "core gate TRƯỚC
  // dispatch"). META dòng đơn ['user','admin']/['config','admin'] là LƯỚI
  // fail-closed lớp 1: MATRIX không cấp 2 module này cho vai nào ngoài
  // admin (bypass can()) → non-admin 403 ngay tại dispatch, không chạm DB.
  // v3.6 tham chiếu: adminOnly list handlers.js:652–654 (userAdd/
  // userSetPassword/userSetActive/thresholdsSet ['admin']); userList v3.6
  // lỏng hơn (rpcMeta ['report','xem'] :720) — core v5 SiẾT về admin theo
  // task W4.1 (admin.ts — mục "QUYỀN" header + doc thresholdsGet: "siết về
  // admin có chủ đích"). LỆCH CÓ CHỦ ĐÍCH, đã chốt ở lõi — reg không nới.
  userList: ['user', 'admin'],
  userAdd: ['user', 'admin'],
  userSetPassword: ['user', 'admin'],
  userSetActive: ['user', 'admin'],
  thresholdsGet: ['config', 'admin'],
  thresholdsSet: ['config', 'admin'],
  // globalSearch: bản chất READ 4 nhóm điều hướng (id/biển số/tên — không lộ
  // giá trị nhạy cảm ngoài nghiệp vụ). ['sc','xem'] = dự kiến search.ts:28;
  // mọi role trong MATRIX đều có sc.xem → ≡ "search.xem mọi role" của v4:3.
  // Lọc is_test/soft-delete đã ở core (search.ts:81–90).
  globalSearch: ['sc', 'xem'],
  // changePassword: TỰ SERVICE trên chính tài khoản actor — không phải quyền
  // module dữ liệu. v3.6 xếp publicFns (mọi vai đăng nhập). ['security',
  // 'doi_mk'] với MATRIX cấp cho CẢ 5 vai (lib/perm.ts W4-reg comment) →
  // dispatch mở cho mọi role; phán quyết thật (verify mk cũ, brute-force,
  // cấm default, clear cờ must_change) ở lib/auth.ts changePassword:209–249.
  changePassword: ['security', 'doi_mk'],
  // W5-reg: boss fn — bản chất READ tổng hợp (sc/xe/kho/config read). Core
  // (lib/core/boss.ts) đã bọc Promise.allSettled từng nguồn + fail-closed khi
  // chưa đăng nhập; gate dispatch ['sc','xem'] = mọi vai đều thử được, nhánh
  // nhạy cảm tự rỗng theo quyền CORE của từng nguồn (không lộ chéo).
  bossDashboard: ['sc', 'xem'],
  bossAlerts: ['sc', 'xem'],
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
  phieuList: (api, a) => kho.phieuList(api, a),
  phieuGet: (api, a) => kho.phieuGet(api, a),
  // W1.6f: core/asset.ts exports assetXe(api, {id}) / assetReport(api, args?) —
  // handler tự trả envelope {ok,result}/{ok,error:'404'|'500'}, KHÔNG throw.
  assetXe: (api, a) => asset.assetXe(api, a),
  assetReport: (api, a) => asset.assetReport(api, a),
  // W1b-reg: core/kho.ts exports tonKho(api, {low_only?,page?,limit?}) /
  // giaLichSuList(api, {vattu_id, limit?}) — cả hai tự trả envelope
  // {ok,result}/{ok,error}, không throw (khác contract cũ nhapKho/xuatKho).
  // Dispatch truyền args||{} → tonKho nhận {} mặc định an toàn.
  tonKho: (api, a) => kho.tonKho(api, a),
  giaLichSuList: (api, a) => kho.giaLichSuList(api, a),
  // W1c-reg: core/kho.ts exports thanhLyList(api, {from?,to?,sc_id?,limit?,offset?})
  // — tự trả envelope {ok,result,total}/{ok,error}, không throw (cùng pattern
  // tonKho). Dispatch truyền args||{} → thanhLyList nhận {} mặc định an toàn.
  thanhLyList: (api, a) => kho.thanhLyList(api, a),
  // W2a: core/kho.ts exports dmList(api,{trang_thai?,from?,to?,page?,limit?}) /
  // dmDetail(api,{id}) / dmListBySc(api,{sc_id}) / dmDelete(api,{id}) — tất cả
  // tự trả envelope {ok,...}/{ok,error}, không throw (cùng quy ước hàm mới W1b+;
  // dispatch args||{} → mặc định {} an toàn).
  dmList: (api, a) => kho.dmList(api, a),
  dmDetail: (api, a) => kho.dmDetail(api, a),
  dmListBySc: (api, a) => kho.dmListBySc(api, a),
  dmDelete: (api, a) => kho.dmDelete(api, a),
  // W2b: core/kho.ts exports dmDecide(api,{id,quyet,ly_do?}) /
  // dmFromSC(api,{sc_id}) / dmAutoBu(api) — cùng quy ước envelope {ok,...},
  // không throw; quyền duyệt thật (ngưỡng + role) enforce TRONG core.
  dmDecide: (api, a) => kho.dmDecide(api, a),
  dmFromSC: (api, a) => kho.dmFromSC(api, a),
  dmAutoBu: (api, a) => kho.dmAutoBu(api, a),
  // W3.1-reg: core/xuong.ts exports dashboardAll(api, _a?) — không tham số,
  // tự trả envelope {ok,result}/{ok,error} theo quy ước W1b+ (401/403-koetoan
  // chặn CỨNG TRONG core theo v3.6 dòng 122–124, không throw). Dispatch args||{}.
  // W3.2-wire: chuyển sang dashboardAllCached — bọc cache in-memory TTL 60s,
  // key `dash:<role>:<ngày>` (role-keyed nên không lộ chéo vai trò). Mọi luồng
  // GHI làm đổi số liệu dashboard (sc.ts/kho.ts) gọi invalidateDashCache() để
  // lạnh ngay; không có invalidate thì tự hết hạn sau 60s (hành vi v3.6).
  dashboardAll: (api, a) => xuong.dashboardAllCached(api, a), // W3.2 cache 60s role-keyed
  // W3.3A: core/sc.ts — 4 fn dòng + deadline theo args {id,...} (sc_id SUY RA TỪ DÒNG
  // trong core, không nhận từ client → không thể recalc/nhánh xóa nhầm phiếu khác);
  // thoList không tham số. Cùng quy ước throw Error của họ sc.ts (HTTP 400/401/403).
  scWorkSet: (api, a) => sc.scWorkSet(api, a),
  scWorkDel: (api, a) => sc.scWorkDel(api, a),
  scVtUpd: (api, a) => sc.scVtUpd(api, a),
  scVtDel: (api, a) => sc.scVtDel(api, a),
  scSetDeadline: (api, a) => sc.scSetDeadline(api, a),
  thoList: (api, _a) => sc.thoList(api),
  // W3.5: core lib/core/sc.ts — scApprove/scTongDuyet tự trả ENVELOPE
  // {ok:false,error} cho mọi chặn nghiệp vụ (200 + result.ok=false — quy ước
  // hàm mới W1b+, không throw 400; quyền trị giá ở core, quyền ma trận ở META).
  scApprove: (api, a) => sc.scApprove(api, a),
  scTongDuyet: (api, a) => sc.scTongDuyet(api, a),
  // W4-reg: core/admin.ts + core/search.ts + lib/auth.ts — TẤT CẢ tự trả
  // ENVELOPE {ok,result}/{ok,error}, không throw cho lỗi nghiệp vụ (quy ước
  // hàm mới W1b+; route bọc thêm 1 tầng {ok:true,result:<envelope>}).
  // 4 fn user + 2 fn thresholds: gateAdmin TRONG lõi (401/403 envelope) là
  // lớp chắn thứ hai sau dispatch META; args đã qua zod ở tầng client/MCP
  // (lib/contracts.ts) + lõi tự validate lại trần 2 tầng (str()/whitelist).
  userList: (api, a) => admin.userList(api, a),
  userAdd: (api, a) => admin.userAdd(api, a),
  userSetPassword: (api, a) => admin.userSetPassword(api, a),
  userSetActive: (api, a) => admin.userSetActive(api, a),
  thresholdsGet: (api, a) => admin.thresholdsGet(api, a),
  thresholdsSet: (api, a) => admin.thresholdsSet(api, a),
  // globalSearch(api, {q, limit?}) — search.ts:69 `globalSearch(_api,{q})`
  // giữ NGUYÊN signature khi reg (tên fn + khuôn args ≡ v4); q min 2, limit
  // clamp 1..30 ở lõi.
  globalSearch: (api, a) => search.globalSearch(api, a),
  // changePassword(api, {old_password,new_password}) — lib/auth.ts:209.
  // Không vào OPEN (cần actor); không cần Mata quyền dữ liệu — self-service.
  changePassword: (api, a) => authChangePassword(api, a),
  // W5-reg: core/boss.ts exports bossDashboard(api) / bossAlerts(api) — KHÔNG
  // tham số, tự trả dữ liệu thô (BossDashboard / string[]), mỗi nguồn bọc
  // allSettled riêng + fail-closed rỗng khi chưa đăng nhập (không throw; route
  // bọc {ok:true,result}). Dispatch args||{} → bỏ qua args, an toàn.
  bossDashboard: (api, _a) => boss.bossDashboard(api),
  bossAlerts: (api, _a) => boss.bossAlerts(api),
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
