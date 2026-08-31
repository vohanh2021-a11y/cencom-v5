interface ToolDoc {
  title: string;
  descVi: string;       // 1-2 câu tiếng Việt, tập trung KHI NÀO gọi
  descEn: string;
  mode: 'READ' | 'WRITE';
  example?: Record<string, unknown>;
}

export const PART3: Record<string, ToolDoc> = {
  baogiaSave: {
    title: 'Lưu báo giá NCC / Save NCC quotation',
    descVi: 'Tạo mới một báo giá nhà cung cấp cho phiếu sửa chữa (SC). Gọi khi cần lưu báo giá vật tư/hàng hóa từ NCC để làm bước 3 của hồ sơ 8 bước.',
    descEn: 'Create a new NCC quotation for a repair order (SC). Call when saving vendor quotations for parts/materials as step 3 of the 8-step dossier.',
    mode: 'WRITE',
    example: { sc_id: 'SC-000001', ncc: 'Công ty TNHH ABC', ngay: '2025-08-15', items: [{ ten: 'Lọc dầu', so_luong: 2, don_gia: 120000 }] },
  },
  hoSoGet: {
    title: 'Lấy hồ sơ kế toán / Get accounting dossier',
    descVi: 'Lấy hồ sơ kế toán mới nhất của một phiếu sửa chữa (SC). Gọi khi cần xem thông tin sổ chung từ, ngày, ghi chú của hồ sơ đã lưu.',
    descEn: 'Get the latest accounting dossier for a repair order (SC). Call when viewing saved dossier details like voucher number, date, and notes.',
    mode: 'READ',
    example: { sc_id: 'SC-000001' },
  },
  hoSoSave: {
    title: 'Lưu hồ sơ kế toán / Save accounting dossier',
    descVi: 'Tạo mới một hồ sơ kế toán cho phiếu sửa chữa. Gọi khi kế toán nhập sổ chứng từ, ngày hạch toán, ghi chú để hoàn thiện hồ sơ tài chính.',
    descEn: 'Create a new accounting dossier for a repair order. Call when accounting enters voucher number, posting date, and notes to complete financial records.',
    mode: 'WRITE',
    example: { sc_id: 'SC-000001', so_chung_tu: 'CT-2025-001', ngay: '2025-08-20', ghi_chu: 'Thanh toán hoàn tất' },
  },
  hoSoList: {
    title: 'Danh sách hồ sơ kế toán / List accounting dossiers',
    descVi: 'Liệt kê hồ sơ kế toán, có thể lọc theo SC. Gọi khi cần xem tổng quan tất cả hồ sơ hoặc hồ sơ của một phiếu sửa chữa cụ thể.',
    descEn: 'List accounting dossiers, optionally filtered by SC. Call when needing an overview of all dossiers or dossiers for a specific repair order.',
    mode: 'READ',
    example: { sc_id: 'SC-000001' },
  },
  hoSoCheck: {
    title: 'Kiểm tra 8 bước hồ sơ / Check 8-step dossier',
    descVi: 'Kiểm tra hồ sơ sửa chữa SC đã đủ 8 bước QC206 chưa (kế hoạch, kiểm tử, báo giá NCC, nhập kho, xuất kho, VT cũ, nghiệm thu, bảng kê). Dùng để hỏi "SC-000003 thiếu bước gì?" trước khi quyết toán.',
    descEn: 'Check if a repair order SC has all 8 QC206 dossier steps (plan, inspection, NCC quotation, receipt, issue, old parts, acceptance, summary). Use to ask "What steps is SC-000003 missing?" before final settlement.',
    mode: 'READ',
    example: { sc_id: 'SC-000001' },
  },
  keHoachSave: {
    title: 'Lưu kế hoạch sửa chữa / Save repair plan',
    descVi: 'Lưu kế hoạch sửa chữa (Mẫu 01) cho phiếu SC — bước 1 của 8 bước hồ sơ. Gọi khi kỹ thuật viên lập kế hoạch công việc, vật tư dự kiến trước khi sửa.',
    descEn: 'Save the repair plan (Form 01) for an SC — step 1 of the 8-step dossier. Call when technician creates work plan and estimated materials before repair.',
    mode: 'WRITE',
    example: { sc_id: 'SC-000001', mo_ta: 'Thay lọc dầu, kiểm tra phanh, thay bugi' },
  },
  kiemTuSave: {
    title: 'Lưu phiếu kiểm tử / Save inspection report',
    descVi: 'Lưu bản kiểm tử vật tư cho phiếu SC — bước 2 của 8 bước hồ sơ. Gọi khi kiểm soát chất lượng ghi nhận kết quả kiểm tra vật tư đầu vào.',
    descEn: 'Save the material inspection report for an SC — step 2 of the 8-step dossier. Call when QC records incoming material inspection results.',
    mode: 'WRITE',
    example: { sc_id: 'SC-000001', mo_ta: 'Vật tư đạt chuẩn, không hư hỏng' },
  },
  nghiemThuSave: {
    title: 'Lưu biên bản nghiệm thu / Save acceptance report',
    descVi: 'Lưu biên bản nghiệm thu cho phiếu SC — bước 7 của 8 bước hồ sơ. Gọi khi hoàn tất sửa chữa, ghi nhận ngày nghiệm thu, tổng vật tư, tổng nhân công.',
    descEn: 'Save the acceptance report for an SC — step 7 of the 8-step dossier. Call when repair is complete, recording acceptance date, total materials, and total labor.',
    mode: 'WRITE',
    example: { sc_id: 'SC-000001', ngay_nghiem: '2025-08-25', tong_vat_tu: 2500000, tong_nhan_cong: 800000 },
  },
  activityFeed: {
    title: 'Dòng hoạt động hệ thống / System activity feed',
    descVi: 'Lấy dòng hoạt động gần đây của hệ thống (đăng nhập, lưu báo giá, tạo phiếu, nghiệm thu...). Có lọc theo SC, khoảng ngày, phân trang. Dùng để hiển thị nhật ký hoạt động trên dashboard.',
    descEn: 'Get recent system activity feed (logins, quotation saves, document creation, acceptance...). Filterable by SC, date range, paginated. Used to display activity log on dashboard.',
    mode: 'READ',
    example: { limit: 50, offset: 0, sc_id: 'SC-000001', tu_ngay: '2025-08-01', den_ngay: '2025-08-31' },
  },
  dashboard: {
    title: 'Dashboard tổng quan / Overview dashboard',
    descVi: 'Lấy dữ liệu tóm tắt cho màn hình dashboard (số phiếu đang sửa, doanh thu, tồn kho, cảnh báo...). Gọi khi tải trang chủ/quản trị.',
    descEn: 'Get summary data for overview dashboard (active repair orders, revenue, inventory, alerts...). Call when loading home/admin page.',
    mode: 'READ',
    example: {},
  },
  report: {
    title: 'Báo cáo / Reports',
    descVi: 'Lấy dữ liệu báo cáo tổng hợp (doanh thu theo kỳ, hiệu suất kỹ thuật, vốn hàng tồn...). Gọi khi cần xuất báo cáo quản lý.',
    descEn: 'Get aggregated report data (revenue by period, technician efficiency, inventory value...). Call when generating management reports.',
    mode: 'READ',
    example: {},
  },
};