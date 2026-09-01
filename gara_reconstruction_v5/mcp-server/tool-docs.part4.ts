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

  // ─── W2a: DM đề nghị mua (trục MUA SẮM) — 3 READ perm ['kho','xem'] +
  // 1 WRITE ['kho','sua'] (soft-delete; MCP deny mặc định khi MCP_WRITE_TOOLS='') ───
  dmList: {
    title: 'Danh sách đề nghị mua (phân trang)',
    descVi:
      'READ-only: danh sách phiếu đề nghị mua — mỗi dòng kèm mã DM, trạng thái (cho_duyet|da_nhap|tu_choi), tổng giá trị, ngày tạo, số dòng vật tư, SC gắn kết (dm.sc_id). Lọc theo trạng thái và khoảng ngày from/to (YYYY-MM-DD); phân trang page/limit≤200 + total. Loại dữ liệu is_test của admin. Dùng khi mở tab mua sắm soát đề nghị chờ duyệt / đã nhập / bị từ chối theo kỳ.',
    descEn:
      'READ-only: purchase-request (DM) list — each row carries DM code, status (cho_duyet|da_nhap|tu_choi), total value, created date, line count and linked repair order (dm.sc_id). Filter by status and from/to date range (YYYY-MM-DD); paginated page/limit<=200 with total. Admin test data hidden. Use to review pending/approved/rejected purchase requests per period.',
    mode: 'READ',
    example: { trang_thai: 'cho_duyet', from: '2026-09-01', to: '2026-09-30', page: 1, limit: 50 },
  },
  dmDetail: {
    title: 'Chi tiết một đề nghị mua',
    descVi:
      'READ-only: header đề nghị mua (id, trạng thái, tổng tiền, người tạo, SC gắn kết) + toàn bộ items JOIN vattu (ten, don_vi, so_luong, don_gia) theo dm_chitiet. Trả {ok:false,"Không thấy đề nghị."} khi id sai/đã xóa mềm. Dùng khi mở phiếu DM để duyệt hàng loạt hoặc đối chiếu từng dòng vật tư trước khi nhập kho.',
    descEn:
      'READ-only: purchase-request header (id, status, total, creator, linked SC) plus all items joined with materials (name, unit, quantity, unit price) from dm_chitiet. Returns {ok:false,"Không thấy đề nghị."} for unknown/soft-deleted ids. Use when opening a DM for approval review or reconciling material lines before stock-in.',
    mode: 'READ',
    example: { id: 'DM-000001' },
  },
  dmListBySc: {
    title: 'Đề nghị mua liên quan một phiếu sửa chữa',
    descVi:
      'READ-only: mọi đề nghị mua gắn với MỘT SC qua header dm.sc_id (v5 link reside ở header — dmNhap luôn copy sc_id xuống phiếu nhập nên bao cả nhánh "đã nhập theo SC" mà v3.6 phải union qua ref_dm). Trả cùng shape dòng với dmList (kèm so_dong, tong). Dùng khi từ phiếu SC muốn biết đã lập/nhập những đề nghị mua nào cho xe này.',
    descEn:
      'READ-only: all purchase requests linked to ONE repair order via dm.sc_id (v5 keeps the link on the header; dmNhap copies sc_id onto receipt lines, covering the "receipted for SC" branch that v3.6 UNIONed via ref_dm). Same row shape as dmList (line count, total). Use to trace which buy requests were raised or received for a given repair order.',
    mode: 'READ',
    example: { sc_id: 'SC-000001' },
  },
  dmDelete: {
    title: 'Xóa mềm đề nghị mua chờ duyệt',
    descVi:
      'WRITE (soft-delete, quyền ["kho","sua"]): chỉ xóa được đề nghị ở trạng thái cho_duyet VÀ chưa có phiếu nhập tham chiếu (v5 không có cột ref_dm — nhận diện qua dấu vết ly_do "Nhập DM <id>" do dmNhap ghi buộc). Vi phạm một trong hai điều kiện → {ok:false,error} tương ứng; thành công đặt deleted_at (không DELETE cứng, dm_chitiet giữ nguyên để truy vết/khôi phục). Dùng khi người tạo thu hồi nháp đề nghị mua sai.',
    descEn:
      'WRITE (soft-delete, perm ["kho","sua"]): only a cho_duyet request WITHOUT any referencing stock receipt can be removed (v5 has no ref_dm column — the link is the enforced ly_do marker "Nhập DM <id>" written by dmNhap). Either condition violated → {ok:false,error}; success stamps deleted_at (no hard delete; detail rows retained for audit/restore). Use when a creator withdraws a wrong draft purchase request.',
    mode: 'WRITE',
    example: { id: 'DM-000001' },
  },

  // ─── W2b: DM chuỗi duyệt (decide/từ SC/bù tồn) — 3 WRITE, quyền trong core ───
  dmDecide: {
    title: 'Duyệt / từ chối đề nghị mua',
    descVi:
      'WRITE (gateway kho.xem — phán quyết quyền ở core): quyết định một DM đang "cho_duyet" với quyet="duyet"|"tu_choi". Giao dịch + FOR UPDATE: chỉ đổi trạng thái khi còn chờ duyệt (ngược lại trả "chỉ duyệt khi chờ duyệt"). Duyệt → "da_duyet" + người/ngày duyệt; từ chối BẮT BUỘC ly_do, ghi lý do. Quyền theo ngưỡng config "duyet_mua_nguong" (mặc định 5.000.000 — v3.6): admin/giamdoc duyệt vô hạn, ketoan chỉ trong ngưỡng, vai khác nhận lỗi "cần Giám đốc duyệt". Không trừ/cộng tồn (nhập kho là dmNhap). Audit dm_duyet cùng transaction.',
    descEn:
      'WRITE: approve or reject a pending purchase request (quyet=duyet|tu_choi) inside one transaction with FOR UPDATE. Only a cho_duyet DM can be decided; approve stamps da_duyet + approver/date, reject requires a non-empty reason. Authority mirrors v3.6: admin/giamdoc unlimited, ketoan only up to config duyet_mua_nguong (default 5,000,000 VND), everyone else gets the "Giám đốc" guidance error. Touches no stock; audits dm_duyet in the same tx.',
    mode: 'WRITE',
    example: { id: 'DM-000004', quyet: 'duyet' },
  },
  dmFromSC: {
    title: 'Tạo đề nghị mua từ nhu cầu SC',
    descVi:
      'WRITE (quyền ["kho","tao"]): gom toàn bộ dòng sc_vattu tt="can_mua" của một phiếu sửa chữa theo vật tư (SUM số lượng, đơn giá = gd_dk dòng đầu hoặc giá vật tư nếu 0) và lập MỘT DM chờ duyệt gắn sc_id, lý do "Vật tư cho phiếu sửa chữa <SC>". Chặn "đang mở" nếu SC đã có DM cho_duyet (idempotent: 2 lệnh song song trên cùng SC tuần tự nhờ lock dòng cầu). Trả {ok:false,"Không còn vật tư cần mua."} khi cầu đã đáp ứng hết. Audit dm_tao cùng transaction.',
    descEn:
      'WRITE (perm kho.tao): group all can_mua material lines of a repair order by material (sum quantity, unit price = first gd_dk else catalog price) and create ONE pending DM linked to the SC. Refuses with "đang mở" if an open DM already exists for the SC (race-safe via row locks, idempotent). Audits dm_tao in the same transaction.',
    mode: 'WRITE',
    example: { sc_id: 'SC-000001' },
  },
  dmAutoBu: {
    title: 'Tự động bù tồn tối thiểu',
    descVi:
      'WRITE (quyền ["kho","tao"], không tham số): quét vật tư đang thiếu (0 < ton_min, ton < ton_min), bỏ qua vật tư đã nằm trong DM chưa khép (cho_duyet/da_duyet — hàng đang trên đường về, port nguyên v3.6), và lập MỘT DM nhiều dòng (sl bù = ton_min − ton, đơn giá = giá vật tư, lý do "Tự động bổ sung tồn tối thiểu", không gắn SC). Không có gì thiếu → {ok:true,id:null,"Không cần bổ sung tồn."}. Audit dm_tao trong transaction.',
    descEn:
      'WRITE (perm kho.tao, no arguments): scans materials below ton_min, skips those already covered by open/approved DMs (v3.6 semantics), and creates ONE multi-line restock DM (quantity = ton_min − ton, catalog price, reason "Tự động bổ sung tồn tối thiểu", no SC link). Returns id:null when nothing is short. Audits dm_tao inside the transaction.',
    mode: 'WRITE',
  },
};
