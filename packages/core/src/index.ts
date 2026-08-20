/**
 * index.ts — Export công khai của @cencom/core (GĐ2: domain logic port từ v3.6).
 * Thứ tự port theo PLAN GĐ2: db → auth → perm → scoring → sc → kho → chat → tk
 * → xuong → asset → baogia → nhanKy → welcome → report → preview.
 * Các module chưa port sẽ được bổ sung dần.
 */
export { createDb, makePgExecutor, makePgliteExecutor, onWrite } from './db.js';
export type { Db, SqlExecutor } from './db.js';
export * as auth from './auth.js';
export * as perm from './perm.js';
export * as scoring from './scoring.js';
export * as cache from './cache.js';
export * as sc from './sc.js';
export * as kho from './kho.js';
export * as chat from './chat.js';
export * as de_xuat from './de_xuat.js';
export * as xuong from './xuong.js';
export * as asset from './asset.js';
export * as baogia from './baogia.js';
export * as nhanKy from './nhanKy.js';
export * as welcome from './welcome.js';
export * as init from './init.js';
export * as search from './search.js';
export * as xe from './xe.js';
export * as khachhang from './khachhang.js';
export * as handlers from './handlers.js';
export * as report from './report.js';
export * as preview from './preview.js';
export * as ledger from './ledger.js';
export * as ketoan from './ketoan.js';
export * as baoduong from './baoduong.js';
export * as ho_so from './ho_so.js';
export * as activity from './activity.js';
export { logActivity, activityFeed } from './activity.js';
export type { UserRow, XeRow, PhieuSuaRow, ScCongViecRow, ScVattuRow, CongViecRow, VattuRow, DeNghiMuaRow, DmMuaCtRow, PhieuNhapRow, PhieuNhapCtRow, PhieuXuatRow, PhieuXuatCtRow, BaoGiaNccRow, DeXuatSuaChuaRow, VattuGiaLichSuRow, PhieuNhapThanhlyRow, AuditRow } from './types.js';