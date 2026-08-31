# MCP UAT Demo — 5 Cau Hoi Tieng Viet

> Thoi gian: 2026-08-31T14:48:32.634Z
> MCP Server: mcp-server/index.ts (stdio)
> sc_id thuc: SC-000001

## Ket noi MCP ✅

> So luong tools: 32

---
## Cau 1: Xe biển 51C-12345 hiện có trong hệ thống không?

**Q:** Xe biển 51C-12345 hiện có trong hệ thống không?

**Tool:** `xeList({})`

**A:** Khong tim thay 51C-12345. Tong 42 xe trong he thong. Mau: VEH-000006 / 37C-00621, VEH-000040 / 37C-01130, VEH-000007 / 37C-10360

---
## Cau 2: SC-000001 — thieu buoc nao trong 8 buoc QC206?

**Q:** SC-000001 — thieu buoc nao trong 8 buoc QC206?

**Tool:** `hoSoCheck({"sc_id":"SC-000001"})`

**A:** SC SC-000001: Kế hoạch sửa chữa (mẫu 01); Bản kiểm tu; Báo giá NCC (đã xác nhận); Phiếu nhập kho vật tư mới; Phiếu xuất kho cho SC; Biên bản nghiệm thu; Bảng kê chi tiết (tổng > 0)

---
## Cau 3: Liệt kê 10 lệnh sửa chữa đang mở

**Q:** Liệt kê 10 lệnh sửa chữa đang mở

**Tool:** `scList({})`

**A:** SC-000001 | xe: VEH-000006 | trang_thai: de_xuat | ngay: undefined
SC-000002 | xe: VEH-000006 | trang_thai: de_xuat | ngay: undefined

---
## Cau 4: Tình hình vật tư trong kho?

**Q:** Tình hình vật tư trong kho?

**Tool:** `vattuList({})`

**A:** Buggi phanh | ton: 20.00 bộ
Bộ lọc dầu | ton: 50.00 cái
Security Test VT | ton: 0.00 cái

---
## Cau 5: Hoạt động gần đây của người dùng?

**Q:** Hoạt động gần đây của người dùng?

**Tool:** `activityFeed({"limit":5})`

**A:** [2026-08-31T14:48:33.824Z] U-ADMIN: mcp_call -> mcp_tool vattuList
[2026-08-31T14:48:33.819Z] U-ADMIN: mcp_call -> mcp_tool scList
[2026-08-31T14:48:33.816Z] U-ADMIN: mcp_call -> mcp_tool hoSoCheck
[2026-08-31T14:48:33.803Z] U-ADMIN: mcp_call -> mcp_tool xeList
[2026-08-31T14:47:12.535Z] U-ADMIN: mcp_call -> mcp_tool activityFeed
