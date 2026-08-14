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
export * as tk from './tk.js';
export * as xuong from './xuong.js';
export * as asset from './asset.js';
export * as baogia from './baogia.js';
export * as nhanKy from './nhanKy.js';
export * as welcome from './welcome.js';
export * as handlers from './handlers.js';
export * as report from './report.js';
export * as preview from './preview.js';
export type { UserRow, XeRow, PhieuSuaRow, ScCongViecRow, ScVattuRow, CongViecRow, VattuRow, DeNghiMuaRow, DmMuaCtRow, PhieuNhapRow, PhieuNhapCtRow, PhieuXuatRow, PhieuXuatCtRow, BaoGiaNccRow, YeuCauThamKhamRow, VattuGiaLichSuRow, PhieuNhapThanhlyRow, AuditRow } from './types.js';