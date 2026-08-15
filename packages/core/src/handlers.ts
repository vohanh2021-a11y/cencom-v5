/**
 * handlers.ts — Các hàm báo cáo tổng hợp (port từ server/handlers.js v3.6).
 *
 * GĐ4 (theo plan_erase_1): Đã LOẠI BỎ các báo cáo sức khỏe xe GĐ2
 * (vehicleHealthLog / fleetReport / accountingReport) vì họ dùng bảng
 * kiem_tra / ket_qua / bieu_ma — thuộc module Thăm khám (TK) đã bỏ.
 * Các báo cáo còn lại (tồn kho, phiếu xuất, quyết toán, đề xuất) nằm ở report.ts.
 * File này giữ lại để tránh break import; có thể bổ sung báo cáo mới ở đây.
 */
export interface HandlerApi {
  db: import('./db.js').Db;
}
