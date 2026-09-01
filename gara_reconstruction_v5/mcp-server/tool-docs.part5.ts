/**
 * mcp-server/tool-docs.part5.ts — W3.1-reg: BẢNG ĐIỀU KHIỂN XƯỞNG (dashboardAll)
 *
 * Style trung thành part1-4: title + descVi ([vi]) + descEn ([en]) + mode + example.
 * 1 fn MỚI: dashboardAll (READ) — quyền META ['sc','xem'] trong lib/rpc.ts.
 * Core lib/core/xuong.ts giữ toàn bộ phán quyết quyền: 401 khi chưa đăng nhập,
 * 403 CỨNG cho role ketoan (port v3.6 server/xuong.js dòng 122–124); trả
 * ENVELOPE {ok:false,error}, không throw — MCP forward nguyên envelope.
 */

interface ToolDoc {
  title: string;
  descVi: string;       // 1-2 câu tiếng Việt, tập trung KHI NÀO gọi
  descEn: string;
  mode: 'READ' | 'WRITE';
  example?: Record<string, unknown>;
}

export const PART5: Record<string, ToolDoc> = {
  dashboardAll: {
    title: 'Bảng điều khiển xưởng (kanban + KPI trong ngày)',
    descVi:
      'READ-only, không tham số: tổng trạng nhà xưởng HIỆN TẠI — bộ KPI ngày (số xe hoạt động, SC chờ duyệt / đang sửa / chờ nghiệm thu, số ca quyết toán + tiền quyết toán hôm nay theo cửa sổ ngày UTC, vật tư thiếu ton_min kèm top-10, đơn mua chờ duyệt, hoạt động 24h) cộng bảng Kanban 5 cột theo đúng enum sc.trang_thai v5 (de_xuat|dang_sua|da_hoan|da_quyet|tu_choi), gom 1 xe = 1 card (nhiều SC gộp, trạng thái ưu tiên cao nhất thắng, % hoàn thành theo sc_congviec tt=hoan/tổng). Loại dữ liệu is_test. Core chặn 403 cứng role ketoan (parity v3.6) và trả envelope {ok:false,error} khi chưa đăng nhập — không throw. Dùng khi sếp/xưởng hỏi "tổng trạng hôm nay": xe nào đang ở đâu, bottleneck chờ duyệt/chờ nghiệm thu cột nào, bao nhiêu SC quyết toán hôm nay với số tiền, vật tư nào đang thiếu.',
    descEn:
      'READ-only, no arguments: the live workshop command dashboard — day KPIs (active vehicles, repair orders pending/repairing/awaiting acceptance, settlements today + settled amount within a UTC day window, materials below ton_min with top-10 list, purchase requests awaiting approval, 24h activity count) plus a 5-column Kanban over real v5 sc.trang_thai enum (de_xuat|dang_sua|da_hoan|da_quyet|tu_choi), one card per vehicle (multiple SCs merged, highest-state priority wins, completion % from sc_congviec tt=hoan/total). Test data (is_test) excluded. The core hard-blocks the ketoan role with 403 (v3.6 parity) and returns an {ok:false,error} envelope when unauthenticated — it never throws. Use when the boss or the shop floor asks "what is the overall state today": where each vehicle sits, which column is the bottleneck, how many orders settled today, and which materials are short.',
    mode: 'READ',
  },

  // ─── W3.3A: DÒNG CÔNG VIỆC/VẬT TƯ + DEADLINE + DANH SÁCH THỢ (trục xưởng) ───
  // 4 fn sửa dòng + 1 hẹn trả xe = WRITE (META ['sc','sua'] — gate 'chỉ sửa khi đề
  // xuất' trong core; MCP mặc định deny khi MCP_WRITE_TOOLS=''); thoList = READ.
  scWorkSet: {
    title: 'Sửa một dòng công việc trên phiếu sửa chữa',
    descVi:
      'WRITE (quyền ["sc","sua"]): sửa đúng MỘT hạng mục công việc theo id dòng (mo_ta/ten, so_luong, don_gia, tho_id gán thợ, tt tiến độ cho|dang|hoan, stt thứ tự, nguyen_nhan, loai_xu_ly enum v5 thay_moi|sua_chua|bao_duong|khac) — vi phạm enum trả lỗi, không ghi. Chỉ áp dụng khi phiếu đang de_xuat; phiếu ở trạng thái khác nhận lỗi "Chỉ sửa khi đề xuất." (don_gia cũng chỉ đổi khi de_xuat như v3.6). CUỐI mỗi lần sửa hệ thống recompute tong_cong/tong_vt/tong (recalc tự động; so_luong/don_gia âm bị chặn). Dùng khi xưởng hoàn thiện kế hoạch sửa chữa trước khi bắt đầu sửa.',
    descEn:
      'WRITE (perm ["sc","sua"]): patch ONE work line by id (mo_ta/ten, quantity, unit price, assigned mechanic tho_id, progress tt cho|dang|hoan, ordering stt, root cause, loai_xu_ly v5 enum) — invalid enum rejected. Only effective while the order is de_xuat (draft); otherwise error "Chi sua khi de xuat." (unit price likewise draft-only per v3.6). Each success recomputes order totals; negative money/qty blocked. Use while the workshop refines a repair plan before starting work.',
    mode: 'WRITE',
    example: { id: 'CV-000001', don_gia: 150000, tt: 'dang', tho_id: 'U-XUONG' },
  },
  scWorkDel: {
    title: 'Xóa mềm một dòng công việc',
    descVi:
      'WRITE (quyền ["sc","sua"], soft-delete): đặt deleted_at = timestamp cho MỘT dòng công việc theo id — chỉ khi phiếu đang de_xuat; dòng của phiếu đã bắt đầu sửa/khóa bị chặn ("Chỉ sửa khi đề xuất."). Không DELETE cứng, giữ dấu vết truy vết/khôi phục; tổng phiếu được recalc ngay sau khi xóa. id dòng không tồn tại/đã xóa → "Không thấy hạng mục công việc.". Dùng khi xưởng gỡ một hạng mục khỏi kế hoạch đang soạn.',
    descEn:
      'WRITE (perm ["sc","sua"], soft-delete): stamps deleted_at on ONE work line by id — only while the order is draft (de_xuat); locked/started orders are rejected. No hard DELETE, row stays for audit; order totals are recalculated immediately. Unknown/already-deleted id errors "Không thấy hạng mục công việc.". Use to drop a line from a plan under drafting.',
    mode: 'WRITE',
    example: { id: 'CV-000001' },
  },
  scVtUpd: {
    title: 'Sửa một dòng vật tư trên phiếu sửa chữa',
    descVi:
      'WRITE (quyền ["sc","sua"]): sửa so_luong và/hoặc gd_dk (giá đăng ký/báo giá) của MỘT dòng vật tư theo id — chỉ khi phiếu de_xuat ("Chỉ sửa khi đề xuất."). gd_tt (giá nghiệm thu) KHÔNG mở ở đây: thuộc luồng kho/nghiệm thu. Khi gd_tt>0, recalc tự ưu tiên gd_tt nên sửa gd_dk không làm đổi tổng (đúng công thức CASE v3.6 — không thêm lệnh cấm nào). Sau update tong_vt được recompute. Dùng khi xưởng chỉnh số lượng/giá dự toán vật tư trước khi duyệt.',
    descEn:
      'WRITE (perm ["sc","sua"]): patch quantity and/or registered price (gd_dk) of ONE material line by id — draft orders only. Acceptance price gd_tt is not handled here (warehouse flow); while gd_tt>0 the recalc CASE prefers it, matching v3.6 exactly. Totals recomputed after update. Use to tune material estimates of a draft repair plan.',
    mode: 'WRITE',
    example: { id: 'VT-000002', so_luong: 4, gd_dk: 350000 },
  },
  scVtDel: {
    title: 'Xóa mềm một dòng vật tư',
    descVi:
      'WRITE (quyền ["sc","sua"], soft-delete): đặt deleted_at cho MỘT dòng vật tư theo id — chỉ khi phiếu đang de_xuat (phiếu đã chạy bị chặn "Chỉ sửa khi đề xuất."). Không DELETE cứng; tong_vt/tong recalc ngay. id sai/đã xóa → "Không thấy vật tư.". Dùng khi xưởng loại một vật tư khỏi dự toán đang soạn.',
    descEn:
      'WRITE (soft-delete): stamp deleted_at on ONE material line by id — draft orders only; recomputes vt totals immediately. Hard delete never happens. Unknown id errors "Không thấy vật tư.". Use to remove a material from a plan being drafted.',
    mode: 'WRITE',
    example: { id: 'VT-000002' },
  },
  scSetDeadline: {
    title: 'Đặt hẹn trả xe cho phiếu sửa chữa',
    descVi:
      'WRITE (quyền ["sc","sua"], v3.6 thêm chốt role xuong/giamdoc/admin trong core): ghi cột sc.han_tra_xe (YYYY-MM-DD) cho một phiếu — CHẶN khi phiếu đang de_xuat/tu_choi/da_quyet (đặt hẹn khi chưa sửa hoặc sau quyết toán là vô nghĩa); cho phép dang_sua/da_hoan. Truyền rỗng/optional để XÓA hẹn (v3.6 String(ngay||"")). Sai định dạng ngày → "Ngày hẹn phải dạng YYYY-MM-DD.". Không đụng tiền (không recalc). Dùng khi quản lý xưởng chốt ngày giao xe với khách.',
    descEn:
      'WRITE (perm ["sc","sua"] + v3.6 in-core role gate xuong/giamdoc/admin): set sc.han_tra_xe (YYYY-MM-DD) on an order — blocked for de_xuat/tu_choi/da_quyet states, allowed while repairing or done; omit/empty date clears the deadline (v3.6 parity). Bad format errors with a YYYY-MM-DD hint. No money fields touched. Used by shop management to commit a delivery date.',
    mode: 'WRITE',
    example: { id: 'SC-000001', han_tra_xe: '2026-09-15' },
  },
  thoList: {
    title: 'Danh sách thợ trong xưởng',
    descVi:
      "READ-only, không tham số: id + name mọi tài khoản role 'xuong' đang hoạt động (users chưa xóa mềm deleted_at rỗng) — port v3.6 thoList (v3.6 lọc role 'tho' + active=1; v5 gộp thợ vào nhóm 'xuong', soft-delete thay cho cột active). Phân quyền META ['sc','xem'] — mọi role xem được phiếu đều lấy được danh sách để gán việc. Dùng khi gán thợ: điền giá trị tho_id cho scWorkSet.",
    descEn:
      'READ-only, no arguments: id+name of every active mechanic account (role xuong, not soft-deleted) — v3.6 thoList ported (v3.6 role "tho"/active folded into v5 "xuong" + deleted_at). Callable by any role that can read orders (META ["sc","xem"]). Use to populate the assigned-mechanic dropdown when patching work lines via scWorkSet.',
    mode: 'READ',
  },
};
