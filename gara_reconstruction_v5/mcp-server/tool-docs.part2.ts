/**
 * mcp-server/tool-docs.part2.ts — Song ngữ descriptions cho 11 RPC fn
 * (Phần 2/3: SC reply/settle + Kho + Báo giá)
 *
 * IMPORT từ tool-docs.ts — KHÔNG khai báo lại ToolDoc interface.
 * Sau khi có đủ part1 + part2 + part3 → merge vào TOOL_DOCS chính.
 *
 * Args example dựa trên core signature thực:
 *   sc.ts:   scTuChoi({sc_id, ly_do}), scQuyetToan({sc_id})
 *   kho.ts:  vattuGet({id}), vattuCreate({ten, don_vi?, gia?, ton_min?}),
 *            nhapKho({vattu_id, so_luong, don_gia?, ngay, ly_do?}),
 *            xuatKho({vattu_id, so_luong, sc_id?, ly_do?}),
 *            dmCreate({sc_id?, items, ngay}), dmNhap({dm_id})
 *   baogia.ts: baogiaGet({id})
 */

import type { ToolDoc } from './tool-docs';

// ─── Mode helper ──────────────────────────────────────────────
type Mode = 'READ' | 'WRITE';

interface ToolDocWithMode extends ToolDoc {
  mode: Mode;
}

// ─── PART2: 11 fn ─────────────────────────────────────────────
export const PART2: Record<string, ToolDocWithMode> = {
  // ═══════════════════════════════════════════════════════════
  // Sửa chữa — Phê duyệt / Từ chối / Quyết toán
  // ═══════════════════════════════════════════════════════════

  scTuChoi: {
    title: 'Từ chối phiếu sửa chữa',
    descVi:
      'Từ chối phiếu SC đang ở trạng thái "đề xuất" với lý do. Dùng khi phiếu không hợp lệ, thiếu thông tin, hoặc xe chưa đủ điều kiện sửa.',
    descEn:
      'Reject a service order in "proposed" status with a reason. Use when the order is invalid, incomplete, or the vehicle is not ready for repair.',
    mode: 'WRITE',
    example: { sc_id: 'SC-000003', ly_do: 'Thiếu linh kiện thay thế' },
  },

  scQuyetToan: {
    title: 'Quyết toán sửa chữa',
    descVi:
      'Chốt quyết toán công việc sữa chữa. Dùng khi công việc hoàn tất (trạng thái "đã hoàn"), hồ sơ 8 bước đã đủ, cần khóa báo giá/thanh toán. Chỉ ketoan/admin được phép.',
    descEn:
      'Finalize financial settlement of a service order. Use when repair is completed (status "da_hoan"), all 8-step profile docs are complete, and the order needs to be locked for payment. Only ketoan/admin roles allowed.',
    mode: 'WRITE',
    example: { sc_id: 'SC-000003' },
  },

  // ═══════════════════════════════════════════════════════════
  // Kho — Vật tư
  // ═══════════════════════════════════════════════════════════

  vattuList: {
    title: 'Danh sách vật tư',
    descVi:
      'Lấy danh sách tất cả vật tư, linh kiện trong kho (loại bỏ đã xóa mềm). Dùng khi cần tra cứu tồn kho, kiểm tra mã vật tư.',
    descEn:
      'List all materials and parts in inventory (excluding soft-deleted). Use when checking stock levels or looking up material codes.',
    mode: 'READ',
  },

  vattuGet: {
    title: 'Chi tiết vật tư',
    descVi:
      'Lấy thông tin chi tiết một vật tư theo ID (tên, đơn vị, giá, tồn kho). Dùng khi cần xem chi tiết trước khi xuất/nhập kho.',
    descEn:
      'Get detailed material info by ID (name, unit, price, stock). Use before issuing or receiving inventory.',
    mode: 'READ',
    example: { id: 'VT-000001' },
  },

  vattuCreate: {
    title: 'Tạo vật tư mới',
    descVi:
      'Thêm mới một vật tư, linh kiện vào hệ thống kho với tên bắt buộc, đơn vị/giá/tồn tối thiểu tuỳ chọn.',
    descEn:
      'Add a new material or part to inventory. Name is required; unit, price, and minimum stock are optional.',
    mode: 'WRITE',
    example: { ten: 'Lốp xe 11R22.5', don_vi: 'cái', gia: 3500000, ton_min: 5 },
  },

  // ═══════════════════════════════════════════════════════════
  // Kho — Nhập / Xuất
  // ═══════════════════════════════════════════════════════════

  nhapKho: {
    title: 'Nhập kho',
    descVi:
      'Ghi nhận nhập hàng vào kho — tăng tồn kho vật tư. Cần mã vật tư, số lượng, ngày nhập. Đơn giá và lý do tuỳ chọn.',
    descEn:
      'Record goods received into inventory — increase material stock. Requires material ID, quantity, and date. Unit price and reason are optional.',
    mode: 'WRITE',
    example: { vattu_id: 'VT-000001', so_luong: 10, don_gia: 3500000, ngay: '2026-08-31', ly_do: 'Nhập đợt 08/2026' },
  },

  xuatKho: {
    title: 'Xuất kho',
    descVi:
      'Ghi nhận xuất hàng từ kho — giảm tồn kho vật tư. Cần mã vật tư, số lượng. Có thể gắn với phiếu SC và ghi lý do xuất. Kiểm tra tồn kho trước khi xuất.',
    descEn:
      'Record goods issued from inventory — decrease material stock. Requires material ID and quantity. Optionally link to a service order and provide a reason. Stock is validated before issue.',
    mode: 'WRITE',
    example: { vattu_id: 'VT-000001', so_luong: 2, sc_id: 'SC-000003', ly_do: 'Sửa chữa lốp xe' },
  },

  // ═══════════════════════════════════════════════════════════
  // Kho — Đơn mua (DM)
  // ═══════════════════════════════════════════════════════════

  dmCreate: {
    title: 'Tạo đơn mua vật tư',
    descVi:
      'Tạo mới một đơn mua (DM) chứa nhiều mục vật tư, trạng thái mặc định "chờ duyệt". Cần danh sách items (mã vật tư + số lượng) và ngày tạo.',
    descEn:
      'Create a purchase order (DM) with multiple line items, default status "cho_duyet". Requires items list (material ID + quantity) and creation date.',
    mode: 'WRITE',
    example: {
      sc_id: 'SC-000003',
      items: [
        { vattu_id: 'VT-000001', so_luong: 4, don_gia: 3500000 },
        { vattu_id: 'VT-000002', so_luong: 2 },
      ],
      ngay: '2026-08-31',
    },
  },

  dmNhap: {
    title: 'Xác nhận nhập đơn mua',
    descVi:
      'Xác nhận đã nhận hàng theo đơn mua (DM) — tự động tăng tồn kho cho từng mục trong đơn và chuyển trạng thái DM sang "đã nhập".',
    descEn:
      'Confirm receipt of a purchase order (DM) — automatically increases stock for each item and transitions DM status to "da_nhap".',
    mode: 'WRITE',
    example: { dm_id: 'DM-000001' },
  },

  // ═══════════════════════════════════════════════════════════
  // Báo giá
  // ═══════════════════════════════════════════════════════════

  baogiaList: {
    title: 'Danh sách báo giá',
    descVi:
      'Lấy danh sách tất cả báo giá NCC (nhà cung cấp) trong hệ thống, sắp xếp theo ngày mới nhất. Dùng khi cần tra cứu, đối chiếu giá.',
    descEn:
      'List all supplier quotations in the system, sorted by newest date first. Use for price lookup and comparison.',
    mode: 'READ',
  },

  baogiaGet: {
    title: 'Chi tiết báo giá',
    descVi:
      'Lấy thông tin chi tiết một báo giá theo ID, kèm danh sách các mục (chi tiết báo giá). Dùng khi cần xem nội dung báo giá cụ thể.',
    descEn:
      'Get detailed quotation info by ID, including line items. Use to review specific quotation contents.',
    mode: 'READ',
    example: { id: 'BG-000001' },
  },
};
