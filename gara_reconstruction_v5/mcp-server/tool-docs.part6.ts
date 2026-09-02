/**
 * mcp-server/tool-docs.part6.ts — W3.5: DUYỆT SC THEO NGƯỠNG + TỔNG DUYỆT CHỐT SNAPSHOT
 *
 * Style trung thành part1-5: title + descVi ([vi]) + descEn ([en]) + mode + example.
 * 2 fn MỚI (WRITE): scApprove / scTongDuyet — META ['sc','duy'] trong lib/rpc.ts.
 * Nguồn port v3.6 server/sc.js: scApprove 190–205 (ngưỡng perm.js:112–117,
 * default duyet_sc_nguong=5.000.000đ seed.js:259), scTongDuyet+snapshotSC
 * 237–256/208–235 (hồ sơ chốt {sc,cong,vat,baoGia,chot} vào bảng sc_phien_ban).
 * Core LUÔN trả envelope {ok:false,error} khi chặn (200, không throw) — MCP
 * forward nguyên envelope; MCP_WRITE_TOOLS='' mặc định deny cả 2.
 */

interface ToolDoc {
  title: string;
  descVi: string;       // 1-2 câu tiếng Việt, tập trung KHI NÀO gọi
  descEn: string;
  mode: 'READ' | 'WRITE';
  example?: Record<string, unknown>;
}

export const PART6: Record<string, ToolDoc> = {
  scApprove: {
    title: 'Duyệt phiếu sửa chữa (theo ngưỡng tiền)',
    descVi:
      'WRITE (quyền ["sc","duy"]): bước DUYỆT đầu tiên của luồng QC206 — chuyển phiếu de_xuat → da_duyet, ghi người/ngày duyệt. Phán quyết NGƯỠNG ở core: giamdoc/admin duyệt MỌI giá trị; xuong chỉ khi tong ≤ config "duyet_sc_nguong" (default 5.000.000đ — ngưỡng quản lý, v3.6 perm.canApproveSC); vượt ngưỡng nhận business error chứa "cần Giám đốc"; phiếu không ở de_xuat bị chặn "Đang <trạng thái> — không duyệt được.". Envelope {ok,trang_thai}(luôn 200, không throw) + audit sc_duyet + dashboard xưởng lạnh ngay. Sau duyệt: TỔNG DUYỆT (scTongDuyet) để chốt hồ sơ, hoặc từ chối bằng scTuChoi khi còn de_xuat. Dùng khi duyệt bản đề xuất sửa chữa đã đủ hồ sơ báo giá.',
    descEn:
      'WRITE (perm ["sc","duy"]): first approval step of the QC206 repair flow — moves an order de_xuat → da_duyet, stamping approver/date. Money threshold enforced in core: giamdoc/admin approve ANY amount; xuong only up to config "duyet_sc_nguong" (default 5,000,000 VND, v3.6 perm.canApproveSC); above threshold returns a business error mentioning "cần Giám đốc"; non-draft orders rejected with "Đang <state> — không duyệt được.". Always an {ok,trang_thai} envelope (HTTP 200, never throws) + sc_duyet audit + workshop dashboard invalidation. Use to approve a drafted repair plan; then total-approve (scTongDuyet) to lock the file.',
    mode: 'WRITE',
    example: { id: 'SC-000001' },
  },
  scTongDuyet: {
    title: 'Tổng duyệt — chốt snapshot hồ sơ sửa chữa (bất biến)',
    descVi:
      'WRITE (quyền ["sc","duy"]): bước TỔNG DUYỆT sau khi phiếu đã da_duyet — CHỐT hồ sơ kế hoạch sửa chữa đúng MỘT lần: dựng JSON {sc, cong, vat, baoGia, chot:{nguoi,ngay,lyDo}} (SELECT JSON một phát, serialize kiểu v3.6) rồi INSERT bảng sc_phien_ban (UNIQUE chống trùng; tổng duyệt lại nhận lỗi "đã chốt — snapshot bất biến"). Từ lúc chốt, MỌI cổng sửa/thêm dòng (scWorkSet/scWorkDel/scVtUpd/scVtDel/scAddCongViec/scAddVatTu) chặn cứng — muốn sửa kế hoạch là phải làm phiếu mới. Phiếu giữ trạng thái da_duyet + cờ chốt; scBatDauSua từ da_duyet sẽ TỰ chốt snapshot nếu chưa ai tổng duyệt (hành vi scStart v3.6). Dùng KHI NÀO: trước khi xưởng bắt đầu sửa — đóng dấu bộ hồ sơ (dòng việc + vật tư + báo giá NCC) làm mốc quyết toán/in ấn về sau.',
    descEn:
      'WRITE (perm ["sc","duy"]): total-approval step for an already da_duyet order — locks the repair plan EXACTLY ONCE: builds a JSON snapshot {sc, cong, vat, baoGia, chot:{who,when,reason}} in a single SELECT and inserts it into sc_phien_ban (unique; re-locking errors "đã chốt"). After locking, every line-edit and add-line endpoint is hard-blocked — plan changes require a new order. The order stays da_duyet with a locked flag; scBatDauSua from da_duyet auto-locks a snapshot if none exists yet (v3.6 scStart parity). Use BEFORE the workshop starts repairing: stamp the bundle of work lines, materials and supplier quotes as the immutable settlement/print baseline.',
    mode: 'WRITE',
    example: { id: 'SC-000001' },
  },
};
