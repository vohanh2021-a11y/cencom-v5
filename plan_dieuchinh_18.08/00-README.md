# PLAN ĐIỀU CHỈNH 18.08 — CHUẨN HÓA THEO QUY CHẾ 206/QC.CT

> **Mục tiêu:** Đưa hệ thống APP Gara v4 (CencomOS) vào tuân thủ Quy chế công ty 206/QC.CT
> (phối hợp Tổ PTTB NMBT ↔ Xưởng sửa chữa), bao gồm 4 công tác: **Sửa chữa – Mua hàng – Quản lý kho – Thanh toán**.

## Phạm vi kế hoạch này (CHỈ LẬP KẾ HOẠCH & PHÂN TÍCH)
- ✅ Tạo bộ tài liệu chuẩn hoá (văn bản gốc + bản AI hiểu).
- ✅ Copy & chuẩn hóa QC206 vào `docs/` v4 + ma trận traceability.
- ✅ Rà soát 8 mẫu hồ sơ vs UI v4 (audit).
- ✅ Compliance nguyên tắc 2 & 3 (phân tích + kế hoạch logic + RBAC matrix).
- ✅ Vẽ flowchart chuẩn hoá.
- ✅ Lên chương trình áp dụng APP (quy trình → thao tác).
- ⛔ **CHƯA build/sửa code app** — chỉ sau khi user duyệt ACTION-PLAN mới triển khai (xem `07-ACTION-PLAN.md`).

## Cấu trúc thư mục
| File | Nội dung |
|---|---|
| `docs/QC206_quy_che.md` | Văn bản gốc Quy chế 206 (copy từ nguồn v3.6, đã chuẩn UTF-8) |
| `00-README.md` | Tổng quan này |
| `01-QC206-AI.md` | Bản quy định "dịch" sang cấu trúc AI dễ hiểu (machine-readable) |
| `02-traceability.md` | Ma trận đối chiếu QC206 ↔ luồng hệ thống v4 hiện tại |
| `03-audit-8-mau.md` | Audit 8 mẫu hồ sơ vs UI v4 (thiếu mẫu 6 & 8?) |
| `04-compliance-p2-p3.md` | Compliance nguyên tắc 2 & 3 + kế hoạch logic + RBAC matrix |
| `05-flowchart.md` | Flowchart chuẩn hoá (Mermaid) |
| `06-app-program.md` | Chương trình áp dụng APP (quy trình → thao tác) |
| `07-ACTION-PLAN.md` | Plan hành động step-by-step có giám sát |

## Phát hiện nhanh (tóm tắt audit sơ bộ)
1. **RBAC:** Đổi tên role `khoa` → `khovattu` (thủ kho vật tư) cho dễ hiểu. Thiếu role thực `laixe` (chỉ có ở preview) và `Tổ PTTB` (chưa có role riêng; quyền mua đang nằm ở `ketoan/quanly/giamdoc`).
2. **Nguyên tắc 2 (không TT thiếu chứng từ):** `phieuChiCreate` (ketoan.ts) chưa kiểm tra HĐĐT `vat_invoice` → chưa enforced.
3. **Thu hồi VT cũ:** `autoGenCuHong` chỉ là RPC thủ công, KHÔNG tự gọi khi SC xong → chưa bắt buộc.
4. **8 mẫu hồ sơ:** Mẫu 6 (nhập VT cũ hỏng) thiếu UI nhập thủ công; Mẫu 8 (bảng kê thay thế) thiếu báo cáo in chuyên biệt.

> ⚠️ **Lưu ý hệ thống sản xuất (Production Check):**
> - **Còn thiếu gì?** Role Tổ PTTB & laixe; enforce P2/P3; UI mẫu 6 & 8; traceability chưa ghi vào repo.
> - **Rủi ro ở đâu?** Nếu không enforce P2 → thanh toán sai quy chế (rủi ro kiểm toán nội bộ); nếu không thu hồi VT cũ → mất vật tư, sai tồn kho/thuế.
> - **Đã chạy kiểm thử chưa?** Chưa — đây là plan/phân tích, chưa sửa code.
> - **Đề xuất tiếp?** User duyệt `07-ACTION-PLAN.md` → mới build (GĐ4 trở đi).
