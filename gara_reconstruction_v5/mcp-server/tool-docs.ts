/**
 * mcp-server/tool-docs.ts — Aggregate tool descriptions from part files
 *
 * This file is the SINGLE source of truth for MCP tool docs.
 * Missing any fn → index.ts throws at startup (docs-completeness gate).
 *
 * Part files (part1..part7) contain the actual descriptions.
 * This file merges them into TOOL_DOCS.
 */

import { PART1 } from './tool-docs.part1';
import { PART2 } from './tool-docs.part2';
import { PART3 } from './tool-docs.part3';
import { PART4 } from './tool-docs.part4';
import { PART5 } from './tool-docs.part5';
import { PART6 } from './tool-docs.part6';
import { PART7 } from './tool-docs.part7';

export interface ToolDoc {
  title: string;
  descVi: string;
  descEn: string;
  mode: 'READ' | 'WRITE';
  /** Example args — chỉ khai báo nếu fn cần tham số bắt buộc */
  example?: Record<string, unknown>;
}

export type ToolDocs = Record<string, ToolDoc>;

/**
 * W5-reg — bossDashboard/bossAlerts (lib/core/boss.ts). Khai báo trực tiếp ở
 * đây (đợt reg cuối, không mở part8): docs-completeness gate ở server-core
 * chỉ cần TOOL_DOCS[fn] tồn tại; pattern part1-7 giữ nguyên cho các fn trước.
 * Cả hai READ thuần — MCP mode mặc định MCP_WRITE_TOOLS='' gọi được; quyền
 * thật do RPC dispatch META ['sc','xem'] + lõi fail-closed từng nguồn.
 */
const BOSS_DOCS: ToolDocs = {
  bossDashboard: {
    title: 'Tổng quan BOSS (KPI xưởng + kho thiếu + DM chờ duyệt + SC quá hạn)',
    descVi:
      'READ (["sc","xem"] — mọi vai; lib/core/boss.ts): MỘT gọi lắp 4 nhánh đọc SONG SONG — {kpi: KPI xưởng ngày (null nếu vai bị core chặn dashboardAll, vd ketoan), ton_thieu: vật tư dưới ngưỡng ton_min (từ tonKho low_only), dm_cho_duyet: đơn mua chờ duyệt (dmList cho_duyet), sc_tre_han: phiếu quá hạn hẹn trả xe kèm số ngày trễ, JOIN biển số, cap 200, han gần nhất trước}. Không tham số. Mỗi nhánh bọc Promise.allSettled RIÊNG: một nguồn lỗi chỉ làm nhánh đó rỗng + logWarn — không sập cả trang; chưa đăng nhập → shape rỗng (fail-closed). KHÔNG ghi, KHÔNG đụng tiền. Dùng khi sếp cần bức tranh vận hành một màn hình thay vì gọi 4 fn lẻ.',
    descEn:
      'READ (["sc","xem"], every role; lib/core/boss.ts): one call assembles four parallel read branches — {kpi: daily workshop KPIs (null when core blocks dashboardAll for the role, e.g. ketoan), ton_thieu: materials below reorder level, dm_cho_duyet: pending purchase requests, sc_tre_han: repair orders past their return deadline with days-late, plate JOIN, capped at 200}. No arguments. Each branch is wrapped in Promise.allSettled: one failing source yields an empty branch + warn log, never a broken page; unauthenticated → empty shape (fail-closed). Pure read. Use as the boss one-glance overview instead of four separate calls.',
    mode: 'READ',
  },
  bossAlerts: {
    title: 'Chuông cảnh báo BOSS (kho thiếu + SC quá hạn trả xe)',
    descVi:
      'READ (["sc","xem"] — mọi vai; lib/core/boss.ts): KHÔNG tham số, trả MẢNG CHUỖI tiếng Việt người-đọc-được cho badge đỏ trên header — thứ tự: "Kho thiếu: <tên> — còn X/Y <đv>" trước, rồi "Quá hạn trả xe: SC-00000N (xe 51C-12345) — hẹn YYYY-MM-DD, trễ N ngày [trạng thái]". Cố ý KHÔNG gọi dashboardAll (kanban nặng — không cần cho vài dòng chuông); dữ liệu hạn lấy từ cột han_tra_xe (W3.3A, soft-not-null). Nhánh lỗi chỉ bị BỎ QUA (logWarn/logError), không throw; chưa đăng nhập → [] (fail-closed). Mảnh hơn bossDashboard: chỉ 2 query, phù hợp gọi polling/header.',
    descEn:
      'READ (["sc","xem"], every role; lib/core/boss.ts): no arguments; returns an array of human-readable Vietnamese alert strings for a red header badge — low-stock lines first, then overdue-return repair orders (deadline + days late + status). Deliberately skips the heavy dashboardAll query (only 2 sources); failing branches are skipped with a log, never thrown; unauthenticated → [] (fail-closed). Lighter than bossDashboard — suitable for frequent header polls.',
    mode: 'READ',
  },
};

const W6_DOCS: ToolDocs = {
  // ── W6-reg · KẾ TOÁN (lib/core/ketoan.ts / ledger.ts / khachhang.ts /
  // baoduong.ts). Quyền dispatch coarse ở META ke_toan/khach_hang/xe; phán
  // quyết tinh (vat/chi/baocao/ky/tao) enforce TRONG lõi — envelope hoặc
  // Error 'Không đủ quyền' theo behaviors port v4, không đổi ở tầng reg.
  tinhGiaVon: {
    title: 'Tính giá vốn lô vật tư (COGS bình quân/FIFO)',
    descVi:
      'READ thuần (["ke_toan","xem"] — core ketoan.ts:tinhGiaVon, KHÔNG trừ tồn tại): nhập {vattu_id, so_luong} → trả {ok:true,result: số tiền} theo phương pháp cogs_method trong ke_toan_setting (binh_quan = gia vattu × SL; fifo = quét ton_lot con_lai theo ngay ASC, phần thiếu bù giá hiện hành — rounding 2 chữ số). Hàm TÍNH nháp phục vụ ước chi phí trước khi xuất kho; bút toán 154/621 thật do luồng xuatKho/scQuyetToan ghi qua ledger.postInner. Không tham số ẩn, không ghi DB.',
    descEn:
      'Pure READ (["ke_toan","xem"]; core ketoan.ts): {vattu_id, so_luong} → {ok, result: cost} using the configured COGS method (weighted-average or FIFO lot scan with fallback price, 2-decimal rounding). Estimation only — never mutates stock; real journal entries come from xuatKho/scQuyetToan via ledger.postInner.',
    mode: 'READ',
    example: { vattu_id: 'VT-000007', so_luong: 4 },
  },
  reconcileKho: {
    title: 'Đối chiếu Kế toán ↔ Kho / Công nợ (4 điểm kiểm)',
    descVi:
      'READ (["ke_toan","xem"] — lõi checkLock ke_toan.xem): KHÔNG tham số, kiểm 4 bất biến sổ cái: (1) số dư 152 ≡ Σ(tôn×giá) vattu trừ opening_inventory; (2) 331 Có ≡ Σ cong_no phai_tra trừ opening_payable; (3) SC đã quyết toán mà 154 chưa đóng → Liệt kê + ok=false; (4) đếm SC dở dang (note theo dõi). Trả {ok, items:[{check,expected,actual,diff,ok}], notes[]} — diff chấm hết ở |diff|<0.01. Dùng khi khóa sổ cuối kỳ hoặc nghi lệch số liệu kho-vs-sổ.',
    descEn:
      'READ (["ke_toan","xem"]): no args; verifies four ledger↔warehouse invariants (152 vs on-hand, 331 vs payables, closed 154 per settled repair orders, open-WIP count) and returns {ok, items, notes} with tolerance 0.01. Use for period-end reconciliation or suspected stock-vs-books drift.',
    mode: 'READ',
  },
  vatInvoiceSave: {
    title: 'Lưu hóa đơn VAT đầu vào + hạch toán Nợ 133 / Có 331',
    descVi:
      'WRITE (dispatch ["ke_toan","tao"], lõi checkLock ke_toan.vat): {so_hd, tien_thue>0, tien_hang?, ty_le?, ncc?, ngay?, ref_id?} — một transaction: INSERT vat_invoice (id VAT-00000N) + postInner chứng từ vat_in (Nợ 133 / Có 331) + nếu ref_id (phiếu nhập) thì TĂNG công nợ phai_tra cùng ref (update hoặc INSERT cong_no CN-00000N). Fail → rollback toàn bộ. sai so_hd trống/tien_thue≤0 → {ok:false,error} không ghi. Audit ke_toan_tao. Dùng khi kế toán nhận hóa đơn nhà cung cấp.',
    descEn:
      'WRITE (META ["ke_toan","tao"], core gate ke_toan.vat): saves a VAT input invoice, posts 133/331 and bumps the linked supplier payable in ONE transaction (rollback on any failure). Rejects blank invoice number or non-positive tax. Audited. Use when recording supplier invoices.',
    mode: 'WRITE',
    example: { so_hd: '0001234', tien_thue: 500000, tien_hang: 5000000, ncc: 'NCC A', ref_id: 'PN-000012' },
  },
  phieuChiCreate: {
    title: 'Phiếu chi thanh toán công nợ NCC (Nợ 331 / Có 112)',
    descVi:
      'WRITE (dispatch ["ke_toan","tao"], lõi checkLock ke_toan.chi): {cong_no_id, so_tien>0, ngay?, hinh_thuc?(ck/tm), nguoi_nhan?, note?, cp_ve_phuphi?} — tx: khóa dòng cong_no phai_tra, CHẶN nếu đã đóng / chi vượt số còn lại / QC206 Điều 2 (công nợ phiếu nhập chưa có hóa đơn VAT đầu vào → từ chối thanh toán); INSERT phieu_chi (PC-00000N) + trừ da_tt/con_no + postInner Nợ 331 Có 112. Mọi vi phạm → {ok:false,error} không ghi. Audit. Dùng khi kế toán chuyển tiền cho nhà cung cấp.',
    descEn:
      'WRITE (META ["ke_toan","tao"], core gate ke_toan.chi): pays down a supplier payable — guards closed/partial-overpay and QC206 rule 2 (no payment before VAT invoice exists), inserts phieu_chi, updates cong_no and posts 331/112 in one transaction. Every violation returns {ok:false,error}. Audited.',
    mode: 'WRITE',
    example: { cong_no_id: 'CN-000005', so_tien: 2000000, hinh_thuc: 'ck' },
  },
  congNoList: {
    title: 'Danh sách công nợ kèm tuổi nợ',
    descVi:
      'READ (["ke_toan","xem"] — lõi checkLock ke_toan.xem): {loai?(phai_tra|phai_thu, mặc định phai_tra), qua_han?(chỉ dòng con_no>0 quá han_tt), q?(tìm doi_tacUpperCase), limit?(clamp 5000)} — SELECT parameterized, ORDER BY han_tt ASC (nợ hạn gần nhất trước), mỗi dòng thêm tuoi_no = số ngày trễ so với hôm nay. Trả mảng thô cong_no + Tuổi nợ phù hợp — dùng làm bảng theo dõi công nợ NCC, không sửa trực tiếp mà qua phieuChiCreate/vatInvoiceSave.',
    descEn:
      'READ (["ke_toan","xem"]): lists payables/receivables with filters (type, overdue, partner search, capped limit), sorted by due date, each row annotated with days-late. Read side of AR/AP; settle via phieuChiCreate.',
    mode: 'READ',
    example: { loai: 'phai_tra', qua_han: true },
  },
  ledgerReport: {
    title: 'Báo cáo kế toán kỳ (CĐKT + chi phí + sổ 152/331/133 + quỹ)',
    descVi:
      'READ (["ke_toan","xem"], lõi checkLock ke_toan.baocao): {tu_ngay?, den_ngay?} (YYYY-MM-DD, mặc định toàn thời gian) → ReportResult: bảng cân đối phát sinh theo tài khoản ( cân đối Nợ/Công, so_du theo loai), tổng tài sản đối chiếu tổng nguồn vốn, tổ hợp chi phí 621/622/627/641/642, sổ chi tiết 152/331/133 và quỹ thu/thu — chi từ so_quy. Số liệu đã rounding 2 chữ số. Bản in A4 HTML nằm ở route /in/* (buildReportHtml) — KHÔNG sinh .docx theo quy định. Dùng khi lập báo cáo cuối tháng/quý.',
    descEn:
      'READ (["ke_toan","xem"], core gate ke_toan.baocao): date-ranged trial balance, expense summary, 152/331/133 detail ledgers and cash-book totals in one payload (2-decimal rounding). Print via /in/* HTML (no .docx per policy). Use for month/quarter-close reports.',
    mode: 'READ',
    example: { tu_ngay: '2026-08-01', den_ngay: '2026-08-31' },
  },
  kyClose: {
    title: 'Khóa kỳ kế toán (chặn ghi chứng từ trong kỳ)',
    descVi:
      'WRITE (["ke_toan","ky"] cả dispatch lẫn lõi): {ten_ky, tu_ngay, den_ngay} YYYY-MM-DD — INSERT ky_ke_toan da_dong=true; từ đó MỌI ledgerPost/postInner có ngày trong kỳ bị CHÍNH validateAndCollect từ chối ("Kỳ kế toán đã đóng") — kể cả bút toán từ luồng kho/SC. id KY-00000N, audit db.audit ke_toan/ky_ke_toan. Thiếu tên hoặc ngày sai format → {ok:false,error}. Dùng khi chốt sổ tháng/quý để chống ghi lùi.',
    descEn:
      'WRITE (["ke_toan","ky"]): locks a fiscal period; every later posting dated inside it is rejected by the ledger validator (all channels, including warehouse/SC integrations). Id KY-00000N, audited.',
    mode: 'WRITE',
    example: { ten_ky: 'Q3-2026', tu_ngay: '2026-07-01', den_ngay: '2026-09-30' },
  },
  kyOpen: {
    title: 'Mở lại kỳ đã khóa (gỡ ghi bổ sung có kiểm soát)',
    descVi:
      'WRITE (["ke_toan","ky"] dispatch + lõi): {id? (KY-…) hoặc ten_ky?} — tìm một kỳ khớp (id ưu tiên), UPDATE da_dong=false + audit "Mở lại kỳ". Cả hai trống hoặc không tìm thấy → {ok:false,error}. hành vi port v4 draft: mở lại TOÀN bộ kỳ, không giới hạn người dùng/phiên — quy trình vận hành yêu cầu khóa lại ngay sau khi bút toán bổ sung xong (nguyên tắc hai khóa).',
    descEn:
      'WRITE (["ke_toan","ky"]): reopens a closed period by id or name (audited). Mirrors draft v4 behavior — closes must be re-applied after adjustments; procedure documented per two-lock principle.',
    mode: 'WRITE',
    example: { id: 'KY-000002' },
  },
  ledgerPost: {
    title: 'Ghi bút toán sổ kép (Nợ = Có, chặn kỳ đóng)',
    descVi:
      'WRITE (dispatch ["ke_toan","xem"] theo khuôn coarse-gate dmDecide; quyền GHI THẬT ke_toan.tao lõi ledger.ts phán — {ok:false} khi thiếu): LedgerPostArg {so_ct, ngay, loai_ct, ref_type?, ref_id?, note?, entries:[{tai_khoan, du_no?|du_co?}×≥2]} — một transaction: validate mỗi dòng đúng MỘT bên >0, tài khoản tồn tại trong `tai_khoan`, TỔNG NỢ=CÓ (dung sai 0.005), ngày ngoài kỳ khóa; sinh CT-/LT- ids, INSERT chung_tu + từng dòng ledger, audit ke_toan_tao. Người ghi LẤY TỪ ACTOR (không phải input) — chống mạo danh. Dùng cho bút toán tay/điều chỉnh ngoài luồng tự động.',
    descEn:
      'WRITE (dispatch ["ke_toan","xem"]; real gate ke_toan.tao inside ledger.ts): double-entry journalizer — balances debits/credits, validates accounts against the chart, refuses closed periods, writes chung_tu + ledger rows + audit in one transaction. Poster is taken from the authenticated actor, never from args.',
    mode: 'WRITE',
    example: {
      so_ct: 'KT-0901',
      ngay: '2026-09-01',
      loai_ct: 'kc_dinh_khoan',
      entries: [
        { tai_khoan: '627', du_no: 100000 },
        { tai_khoan: '112', du_co: 100000 },
      ],
    },
  },
  ledgerList: {
    title: 'Tra cứu bút toán sổ cái',
    descVi:
      'READ (["ke_toan","xem"] cả dispatch lẫn lõi): {tai_khoan?, tu_ngay?, den_ngay?, loai_ct?, limit?(clamp 5000)} — JOIN ledger×chung_tu trả từng dòng Nợ/Có kèm so_ct/loai_ct/note, ORDER BY ngay DESC. Chưa đăng nhập/thiếu quyền → mảng rỗng (fail-closed kiểu v4, không 403 HTTP). Dùng khi đối soát một tài khoản (152, 331, 133...) hoặc truy vết một chứng từ.',
    descEn:
      'READ (["ke_toan","xem"] both layers): filters journal lines by account/date range/voucher type, joined with chung_tu, newest first; silently empty when unauthenticated or unauthorized (v4 fail-closed shape). Use for account audit trails.',
    mode: 'READ',
    example: { tai_khoan: '152', tu_ngay: '2026-08-01' },
  },
  // ── W6-reg · KHÁCH HÀNG / NCC ──────────────────────────────────────────
  khachHangList: {
    title: 'Danh sách khách hàng / nhà cung cấp (phân trang)',
    descVi:
      'READ (["khach_hang","xem"] — lõi chỉ require đăng nhập, quyền TRỌN ở dispatch, MATRIX hiện chỉ ketoan+admin): {q?(tên/SĐT/mã thuế, ILIKE upper), page?(≥1), limit?(1..200, mặc định 50)} → {result, total, page, limit, pages} — chỉ dòng đang sống (deleted_at rỗng). type rác q/page/limit → lõi ném "không hợp lệ" (chống type-confusion). Dùng khi cần id KH-… cho phiếu/báo giá hoặc tra NCC.',
    descEn:
      'READ (["khach_hang","xem"]; dispatch is the only gate, MATRIX grants ketoan/admin): paginated customer/supplier search by name/phone/tax code over live rows; rejects non-string types. Use to resolve KH-… ids.',
    mode: 'READ',
    example: { q: 'công ty', limit: 20 },
  },
  khachHangGet: {
    title: 'Chi tiết một khách hàng / NCC',
    descVi:
      'READ (["khach_hang","xem"]): {id} (KH-00000N) → toàn bộ cột khach_hang (ten, sdt, dia_chi, email, ma_so_thue, la_ncc, ghi_chu) hoặc null khi không tìm thấy/đã xóa mềm. Chưa đăng nhập → throw 401 (dispatch đã chặn trước). Dùng khi mở hồ sơ khách hàng hoặc xác minh la_ncc trước khi hạch toán công nợ.',
    descEn:
      'READ (["khach_hang","xem"]): fetch one live customer/supplier record by id, null when missing/soft-deleted; 401 when unauthenticated. Use before AR/AP postings to confirm counterparties.',
    mode: 'READ',
    example: { id: 'KH-000001' },
  },
  khachHangSave: {
    title: 'Tạo / cập nhật khách hàng hoặc NCC (whitelist 7 trường)',
    descVi:
      'WRITE (["khach_hang","tao"]): {ten bắt buộc, id? → UPDATE theo id, ngược lại INSERT id KH-00000N qua nextId; sdt/dia_chi/email/ma_so_thue/ghi_chu trim-derive; la_ncc boolean = đánh dấu nhà cung cấp}. CHỈ 7 khóa EDITABLE_FIELDS được đụng tới (field lạ không vào SQL — chống column-injection); type-rác → lỗi chuỗi rõ ràng. Mỗi lần ghi audit khach_hang_tao/sua vào activity_log. Trả {ok,id} / {ok:false,error}. Dùng khi thêm khách mới hoặc bổ sung NCC cho công nợ.',
    descEn:
      'WRITE (["khach_hang","tao"]): create (KH-00000N via nextId) or update a customer flagged la_ncc for suppliers — only the 7 whitelisted fields reach SQL; audited khach_hang_tao/sua.',
    mode: 'WRITE',
    example: { ten: 'Công ty TNHH Thắng Lợi', sdt: '0905123456', la_ncc: true },
  },
  khachHangDel: {
    title: 'Xóa mềm khách hàng / NCC',
    descVi:
      'WRITE (["khach_hang","tao"]): {id} → UPDATE deleted_at=\'x\' (KHÔNG xóa cứng — lịch sử công nợ/báo giá còn JOIN được) + audit khach_hang_xoa. Chưa đăng nhập → {ok:false,error}. Không kiểm tra ràng buộc "đang có công nợ mở" theo semantics draft: nghiệp vụ nên đóng công nợ trước. Trả {ok:true}. Dùng khi ngừng giao dịch một đối tượng.',
    descEn:
      'WRITE (["khach_hang","tao"]): soft-delete (deleted_at=\'x\', never hard) + audit; drafts allow deletion with open payables — close debts first by procedure.',
    mode: 'WRITE',
    example: { id: 'KH-000003' },
  },
  // ── W6-reg · BẢO DƯỠNG ĐỊNH KỲ ─────────────────────────────────────────
  baoDuongTao: {
    title: 'Tạo lịch bảo dưỡng cho xe',
    descVi:
      'WRITE (["xe","tao"] dispatch ≡ gate lõi; MATRIX hiện chỉ admin): {xe_id phải tồn tại, hang_muc ≤200 ký tự, ngay_du_kien?/ngay_thuc_hien? YYYY-MM-DD (sai format → bỏ về rỗng theo semantics v4, KHÔNG chặn), trang_thai? whitelist cho|xong|bo (rác → "cho")} → INSERT bao_duong_lich id BD-00000N + audit baoduong_tao. Mọi vi phạm trả envelope {ok:false,error}, không throw. Dùng khi xưởng/kế hoạch ghi lịch bảo dưỡng định kỳ cho đầu kéo.',
    descEn:
      'WRITE (["xe","tao"] both layers; admin-only today): schedules a maintenance item for an existing vehicle (dates optional, status whitelisted cho/xong/bo, 200-char cap), id BD-00000N, audited; all rejections via {ok:false,error}.',
    mode: 'WRITE',
    example: { xe_id: 'XE-000012', hang_muc: 'Thay nhớt + lọc dầu', ngay_du_kien: '2026-10-05' },
  },
  baoDuongList: {
    title: 'Lịch bảo dưỡng của một xe',
    descVi:
      'READ (["xe","xem"] dispatch + lõi): {xe_id} → mảng dòng bao_duong_lich chưa xóa mềm, mới nhất trước (ORDER BY id DESC ≡ v4). Chưa đăng nhập / thiếu xe_id / không đủ quyền → MẢNG RỖNG (fail-closed im lặng theo draft, không lộ lỗi quyền). Dùng với trang nhắc hạn (app/(app)/nhac-han) để hiển thị lịch theo xe.',
    descEn:
      'READ (["xe","xem"]): maintenance history/schedule for one vehicle, newest first; silently [] when unauthenticated or unauthorized (draft parity). Feeds the reminder page.',
    mode: 'READ',
    example: { xe_id: 'XE-000012' },
  },
};

export const TOOL_DOCS: ToolDocs = { ...PART1, ...PART2, ...PART3, ...PART4, ...PART5, ...PART6, ...PART7, ...BOSS_DOCS, ...W6_DOCS };
