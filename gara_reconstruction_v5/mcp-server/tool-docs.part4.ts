/**
 * mcp-server/tool-docs.part4.ts — W1a: PHIẾU NHẬP/XUẤT 2 TẦNG (trục KHO)
 *
 * Style trung thành part1-3: title + descVi ([vi]) + descEn ([en]) + mode + example.
 * 2 fn MỚI: phieuList (READ), phieuGet (READ) — quyền META ['kho','xem'] trong lib/rpc.ts.
 */

interface ToolDoc {
  title: string;
  descVi: string;       // 1-2 câu tiếng Việt, tập trung KHI NÀO gọi
  descEn: string;
  mode: 'READ' | 'WRITE';
  example?: Record<string, unknown>;
}

export const PART4: Record<string, ToolDoc> = {
  phieuList: {
    title: 'Danh sách phiếu nhập/xuất kho',
    descVi:
      'Liệt kê phiếu nhập/xuất kho dạng 2 tầng — mỗi phiếu là một nhóm dòng nhap_xuat (kể cả DM nhiều dòng gộp 1 phiếu qua phieu_id). Lọc theo loại (nhap|xuat), SC, khoảng ngày; phân trang limit≤200. Dùng khi kho cần soát "phiếu nào, ngày nào, bao nhiêu dòng, tổng tiền".',
    descEn:
      'List two-level stock receipt/issue documents — each doc groups nhap_xuat lines (multi-line DM receipts share one phieu_id). Filter by type (nhap|xuat), SC, date range; paginated limit<=200. Use when reviewing which stock documents exist, their line count and totals.',
    mode: 'READ',
    example: { loai: 'nhap', from: '2026-09-01', to: '2026-09-30', limit: 50, offset: 0 },
  },
  phieuGet: {
    title: 'Chi tiết một phiếu nhập/xuất',
    descVi:
      'Lấy header (ngày, NCC, lý do, SC gắn kết) và toàn bộ dòng vật tư (ten/don_vi JOIN vattu, thành tiền) của một phiếu theo effective group id. Trả lỗi "404" khi không có nhóm nào. Dùng trước khi in phiếu hoặc đối chiếu từng dòng DM/nhập lẻ.',
    descEn:
      'Fetch the header (date, supplier, reason, linked SC) and all material lines (name/unit via vattu join, line amount) of one stock document by effective group id. Errors "404" when no group exists. Use before printing a document or reconciling DM/receipt lines.',
    mode: 'READ',
    example: { id: 'NX-000123' },
  },

  // ─── W1.6f: Quyết toán tài sản (asset) — READ-only, perm META ['xe','xem'] ───
  assetXe: {
    title: 'Lý lịch tài sản một xe (khấu hao + GTTV)',
    descVi:
      'READ-only: tính giá trị còn lại (GTTV) của MỘT xe theo id — khấu hao luỹ kế (nguyên giá / khau_hao_nam × số tuổi, cap tại số năm cấu hình) cộng chi phí tích luỹ từ các phiếu sửa chữa đã quyết toán (trang_thai da_quyet, chưa xoá mềm). Trả "404" khi id thiếu/xe không tồn tại. Dùng khi cần định giá còn lại từng xe cho sổ kế toán tài sản.',
    descEn:
      'READ-only: remaining book value (GTTV) of ONE vehicle by id — cumulative straight-line depreciation (original value / khau_hao_nam × age, capped) plus accumulated cost of settled repair orders. Errors "404" for missing id or unknown vehicle. Use when appraising a single asset for the fixed-asset ledger.',
    mode: 'READ',
    example: { id: 'XE-000001' },
  },
  assetReport: {
    title: 'Báo cáo quyết toán toàn dàn xe',
    descVi:
      'READ-only, không tham số: bảng kê GTTV mọi xe đang hoạt động (chưa xoá mềm VÀ is_test=0 — dữ liệu test không lẫn vào sổ sách), sắp theo GTTV giảm dần, kèm tổng hợp {tong_gttv, tong_nguyen_gia, tong_chi_phi, dem_xe}. Một vòng JOIN+GROUP BY duy nhất, không N+1. Dùng khi ketoan/giamdoc chốt sổ khấu hao kỳ hoặc kiểm kê tài sản toàn gara.',
    descEn:
       'READ-only, no arguments: GTTV (remaining value) table for all active vehicles (not soft-deleted, is_test=0), sorted by GTTV descending, with totals {tong_gttv, tong_nguyen_gia, tong_chi_phi, dem_xe}. Single JOIN+GROUP BY, no N+1. Use for periodic depreciation closing or whole-garage asset inventory.',
    mode: 'READ',
  },

  // ─── W1b-reg: Tồn kho + lịch sử giá (kho) — READ-only, perm META ['kho','xem'] ───
  tonKho: {
    title: 'Tồn kho vật tư + cảnh báo thiếu + giá trị tồn',
    descVi:
      'READ-only: sổ tồn kho từng vật tư đang dùng (bỏ soft-deleted và is_test) — ton, ton_min, thieu = ton − ton_min (âm là đang thiếu), cờ low, giá trị tồn từng dòng; kèm tổng hợp lowCount/total/giaTriTonKho tính bằng SQL trên TOÀN BỘ dòng active nên không đổi giữa trang. Lọc low_only=true chỉ lấy nhóm thiếu; phân trang page/limit≤200. Dùng khi kiểm tra tồn + thiếu ton_min + giá trị tồn (đọc nhanh đầu ca trực, lập kế hoạch đặt hàng, chốt giá trị kho).',
    descEn:
      'READ-only: per-material stock ledger (active rows only) — ton, ton_min, thieu=ton−ton_min (negative = shortage), low flag, line stock value; totals lowCount/total/giaTriTonKho computed in SQL over ALL active rows so they stay stable across pages. low_only=true filters to shortages; pagination page/limit<=200. Use to check stock levels, ton_min shortages and total inventory value.',
    mode: 'READ',
    example: { low_only: true, page: 1, limit: 50 },
  },
  giaLichSuList: {
    title: 'Lịch sử giá vật tư theo NCC',
    descVi:
      'READ-only: các mốc giá của MỘT vật tư (bảng vattu_gia_lich_su — ghi tự động mỗi lần nhập kho/DM với giá >0), mặc định 8 mốc mới nhất, tối đa 30, sắp theo ngay giảm dần; mỗi mốc kèm ncc/loai(nhap|dm)/phieu_id. Dùng khi xem lịch sử giá vật tư/NCC 8 mốc mới nhất — đàm phán giá với nhà cung cấp, phát hiện biến động giá, đối chiếu đơn giá trên phiếu nhập.',
    descEn:
      'READ-only: price history points for ONE material (auto-recorded on each receipt/DM with positive price), default 8 latest points, max 30, ordered by date desc; each point carries ncc/type(nhap|dm)/phieu_id. Use to review supplier price trends, detect price drift and reconcile unit prices on receipts.',
    mode: 'READ',
    example: { vattu_id: 'VT-000001', limit: 8 },
  },

  // ─── W1c-reg: Bảng kê thanh lý (kho) — READ-only, perm META ['kho','xem'] ───
  // autoGenCuHong/autoXuatSC (core/kho.ts) có sinh dòng thanh_ly nhưng là hàm
  // nội bộ — hook W3 scHoanThanh, không phải tool MCP.
  thanhLyList: {
    title: 'Bảng kê vật tư thanh lý',
    descVi:
      'READ-only: bảng kê từng dòng vật tư thanh lý (bảng thanh_ly — phát sinh khi xuất kho loại thanh lý hoặc tự động thu hồi VT cũ/hỏng từ SC thay thế), kèm tên/đơn vị vật tư (JOIN vattu), sc_id, số lượng, giá thanh lý, lý do, ngày; số hóa field numeric. Lọc from/to (YYYY-MM-DD) theo ngày, sc_id theo phiếu sửa chữa; phân trang limit≤200 + total. Dùng khi muốn xem bảng kê vật tư thanh lý — kiểm kê kho hỏng, đối chiếu giá thu hồi, soát SC nào đã sinh dòng thanh lý tự động.',
    descEn:
      'READ-only: itemized liquidation ledger (thanh_ly rows — created by liquidation issues or auto-recovery of old/damaged materials from replacement SCs), with material name/unit (vattu join), sc_id, quantity, liquidation price, reason, date; numeric fields coerced. Filter by from/to (YYYY-MM-DD) and sc_id; paginated limit<=200 with total. Use to review which materials were liquidated, their recovery price, and which repair orders generated auto-liquidation lines.',
    mode: 'READ',
    example: { from: '2026-09-01', to: '2026-09-30', limit: 50, offset: 0 },
  },
};
