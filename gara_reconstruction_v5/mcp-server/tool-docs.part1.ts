/**
 * mcp-server/tool-docs.part1.ts — Song ngữ descriptions cho 10 RPC fn
 * (Phần 1/3: Xe CRUD + Sửa chữa CRUD + Luồng trạng thái SC)
 *
 * Args example dựa trên core signature thực:
 *   xe.ts:  xeList()            — không args
 *           xeGet(id)           — { id }
 *           xeCreate({bien_so, chu_xe?, nam_sx?, nguyen_gia?})
 *   sc.ts:  scList(filter?)     — { trang_thai? }
 *           scGet(id)           — { id }
 *           scCreate({xe_id, ngay})
 *           scAddCongViec({sc_id, mo_ta, nguyen_nhan?, loai_xu_ly?, so_luong?, don_gia?})
 *           scAddVatTu({sc_id, vattu_id, so_luong})
 *           scBatDauSua({sc_id})
 *           scHoanThanh({sc_id})
 *
 * IMPORT từ tool-docs.ts — KHÔNG khai báo lại ToolDoc interface chính.
 * Sau khi có đủ part1 + part2 + part3 → merge vào TOOL_DOCS chính.
 */

interface ToolDoc {
  title: string;
  descVi: string;       // 1-2 câu tiếng Việt, tập trung KHI NÀO gọi
  descEn: string;
  mode: 'READ' | 'WRITE';
  example?: Record<string, unknown>;
}

// ─── PART1: 10 fn ─────────────────────────────────────────────
export const PART1: Record<string, ToolDoc> = {
  // ═══════════════════════════════════════════════════════════
  // Xe — CRUD
  // ═══════════════════════════════════════════════════════════

  xeList: {
    title: 'Danh sách xe',
    descVi:
      'Lấy toàn bộ danh sách xe chưa xóa mềm, sắp xếp theo biển số. Dùng khi cần tra cứu, đếm, hoặc hiển thị danh sách xe trong hệ thống.',
    descEn:
      'List all soft-deleted-excluded vehicles sorted by license plate. Use when looking up, counting, or displaying the vehicle registry.',
    mode: 'READ',
  },

  xeGet: {
    title: 'Chi tiết xe',
    descVi:
      'Lấy thông tin chi tiết một xe theo mã id (biển số, chủ xe, năm sản xuất, nguyên giá). Dùng khi cần tra cứu thông tin cụ thể của một xe trước khi tạo phiếu sửa chữa.',
    descEn:
      'Get detailed vehicle info by id (license plate, owner, year, original value). Use to look up a specific vehicle before creating a service order.',
    mode: 'READ',
    example: { id: 'XE-000001' },
  },

  xeCreate: {
    title: 'Tạo xe mới',
    descVi:
      'Thêm một xe mới vào hệ thống. Bắt buộc phải có biển số (bien_so). Tuỳ chọn: chủ xe, năm sản xuất, nguyên giá. Dùng khi xe chưa tồn tại trong hệ thống và cần đăng ký để theo dõi sửa chữa.',
    descEn:
      'Register a new vehicle. License plate (bien_so) is required. Optional: owner name, manufacturing year, original value. Use when a vehicle is not yet in the system and needs to be tracked for repairs.',
    mode: 'WRITE',
    example: { bien_so: '51C-12345', chu_xe: 'Nguyễn Văn A', nam_sx: 2020, nguyen_gia: 1200000000 },
  },

  // ═══════════════════════════════════════════════════════════
  // Sửa chữa — CRUD + Luồng trạng thái
  // ═══════════════════════════════════════════════════════════

  scList: {
    title: 'Danh sách phiếu sửa chữa',
    descVi:
      'Lấy danh sách phiếu sửa chữa (SC), có thể lọc theo trạng thái (de_xuat / dang_sua / da_hoan / da_quyet / tu_choi). Sắp xếp mới nhất lên đầu. Dùng khi cần xem tổng quan các phiếu đang xử lý hoặc đã xong.',
    descEn:
      'List service orders (SC), optionally filtered by status (de_xuat / dang_sua / da_hoan / da_quyet / tu_choi). Sorted newest-first. Use to view an overview of active or completed repair orders.',
    mode: 'READ',
    example: { trang_thai: 'dang_sua' },
  },

  scGet: {
    title: 'Chi tiết phiếu sửa chữa',
    descVi:
      'Lấy thông tin chi tiết một phiếu sửa chữa theo mã id (xe_id, ngày tạo, người tạo, trạng thái). Dùng khi cần xem nội dung cụ thể của một SC trước khi thêm công việc hoặc vật tư.',
    descEn:
      'Get detailed service order info by id (xe_id, creation date, creator, status). Use to review a specific SC before adding tasks or materials.',
    mode: 'READ',
    example: { id: 'SC-000003' },
  },

  scCreate: {
    title: 'Tạo phiếu sửa chữa',
    descVi:
      'Tạo mới một phiếu sửa chữa cho xe đã có. Bắt buộc: mã xe (xe_id) và ngày (ngay, định dạng YYYY-MM-DD). Trạng thái mặc định: "de_xuat". Dùng khi cần mở hồ sơ sửa chữa cho một xe.',
    descEn:
      'Create a new service order for an existing vehicle. Required: vehicle id (xe_id) and date (ngay, YYYY-MM-DD format). Default status: "de_xuat". Use to open a repair file for a vehicle.',
    mode: 'WRITE',
    example: { xe_id: 'XE-000001', ngay: '2026-08-31' },
  },

  scAddCongViec: {
    title: 'Thêm công việc sửa chữa',
    descVi:
      'Thêm một công việc (mô tả + xử lý) vào phiếu SC. Bắt buộc: mã SC (sc_id) và mô tả (mo_ta). Tuỳ chọn: nguyên nhân, loại xử lý (thay_moi / sua_chua / bao_duong / khac), số lượng, đơn giá. Dùng khi kỹ thuật viên liệt kê các hạng mục cần sửa.',
    descEn:
      'Add a repair task to a service order. Required: SC id (sc_id) and description (mo_ta). Optional: root cause, processing type (thay_moi / sua_chua / bao_duong / khac), quantity, unit price. Use when listing repair items to be performed.',
    mode: 'WRITE',
    example: { sc_id: 'SC-000003', mo_ta: 'Thay lốp trước bên phải', nguyen_nhan: 'Mòn' },
  },

  scAddVatTu: {
    title: 'Gắn vật tư vào phiếu sửa chữa',
    descVi:
      'Gắn một vật tư (linh kiện/phụ tùng) vào phiếu SC với số lượng cụ thể. Bắt buộc: mã SC (sc_id), mã vật tư (vattu_id), số lượng (so_luong > 0). Dùng khi xác định vật tư cần dùng cho lần sửa này.',
    descEn:
      'Attach a material (part/consumable) to an SC with a specific quantity. Required: SC id (sc_id), material id (vattu_id), quantity (so_luong > 0). Use when specifying materials needed for this repair.',
    mode: 'WRITE',
    example: { sc_id: 'SC-000003', vattu_id: 'VT-000001', so_luong: 2 },
  },

  scBatDauSua: {
    title: 'Bắt đầu sửa chữa',
    descVi:
      'Chuyển phiếu SC từ "đề xuất" (de_xuat) sang "đang sửa" (dang_sua). Chỉ thực hiện được khi phiếu đang ở trạng thái de_xuat. Dùng khi xác nhận bắt tay vào sửa.',
    descEn:
      'Transition SC from "proposed" (de_xuat) to "in-progress" (dang_sua). Only valid when the order is in de_xuat status. Use to confirm repair has started.',
    mode: 'WRITE',
    example: { sc_id: 'SC-000003' },
  },

  scHoanThanh: {
    title: 'Hoàn thành sửa chữa',
    descVi:
      'Chuyển phiếu SC từ "đang sửa" (dang_sua) sang "đã hoàn" (da_hoan). Chỉ thực hiện được khi phiếu đang ở trạng thái dang_sua. Dùng khi sửa xong, trước khi quyết toán.',
    descEn:
      'Transition SC from "in-progress" (dang_sua) to "completed" (da_hoan). Only valid when the order is in dang_sua status. Use when repair is finished, before final settlement.',
    mode: 'WRITE',
    example: { sc_id: 'SC-000003' },
  },
};
