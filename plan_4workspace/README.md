# plan_4workspace — Nâng cấp cencomOS Gara lên v4.3 (UI Workspace)

> Thư mục kế hoạch chi tiết cho đợt nâng cấp **v4.3.0**: tách giao diện thành 4 workspace độc lập
> (Xưởng / Kho & Mua / Kế toán / Quản trị) trên nền core phần mềm hiện có,
> clone phong cách UI từ CarDoctor GMS (kho/kế toán) và VC Garage (xưởng, mobile-first),
> bổ sung cơ chế **Giám đốc view-only (PA1)** và khối **Sổ chi thu nội bộ**.

## Mục lục

| File | Nội dung |
|---|---|
| `README.md` | Tài liệu này — mục lục & cách dùng |
| `OVERVIEW.md` | Tình huống hiện tại & lý do cần thay đổi (bài toán gốc) |
| `ROADMAP.md` | Kế hoạch thực hiện chi tiết từng bước P1–P6 |
| `TASKS.md` | Danh sách công việc dạng checklist (tracking) |
| `ai_config.yaml` | Cấu hình điều chỉnh cho AI thực hiện không sai sót |
| `TESTING.md` | Quy trình kiểm thử (nhắc lại skill dev-workflow / tdd-loop / systematic-debugging) |
| `UIUX_REVIEW.md` | Đối chiếu UIUX chuyên nghiệp, điểm yếu & đề xuất nâng cấp |
| `CHANGELOG.md` | Lịch sử thay đổi phiên bản (v4.3.0) |

## Cách dùng thư mục này

- Người đọc (human): bắt đầu từ `OVERVIEW.md` → `ROADMAP.md` → `TASKS.md`.
- AI thực thi: load `ai_config.yaml` làm ràng buộc cứng, tuân thủ `TESTING.md` trước mỗi bước.
- Mọi thay đổi code thực tế nằm ở `apps/web`, `packages/core`, `packages/db` (KHÔNG sửa file plan này khi đã duyệt).

## Quyết định đã chốt (từ phiên làm việc)

1. **Giám đốc view-only** → Phương án PA1 (mode toggle, mặc định không sửa, bật có xác nhận).
2. **Doanh thu / AR khách** → KHÔNG bổ sung; chỉ thêm **sổ quỹ + phiếu thu nội bộ** (không hóa đơn bán hàng).
3. **Thứ tự** → Làm UI workspace trước (P1–P3), rồi bổ sung backend gap (P4).
4. **Màu Xưởng** → Xanh blue dịu `#2563EB`, nền trắng; badge đỏ/vàng/xanh giữ nguyên.

## Trạng thái

- [x] Phân tích hiện trạng (backend + UI + đối thủ)
- [x] Chốt 4 quyết định thiết kế
- [x] Viết kế hoạch chi tiết (thư mục này)
- [ ] Thực thi P1 (Workspace infra)
- [ ] Thực thi P2 (Clone CarDoctor — Kho & Kế toán)
- [ ] Thực thi P3 (Clone VC Garage — Xưởng, mobile)
- [ ] Thực thi P4 (Backend gap + Sổ quỹ/Phiếu thu)
- [ ] Thực thi P5 (Giám đốc view-only)
- [ ] Thực thi P6 (Test & Docs)

> ⚠️ Lưu ý hệ thống sản xuất (Production Check):
> - **Còn thiếu gì?** Mới ở mức tài liệu kế hoạch; code thực thi P1–P6 chưa bắt đầu.
> - **Rủi ro ở đâu?** Lộ quyền (IDOR) khi filter workspace sai; ExcelTable treo data lớn; mobile chưa test.
> - **Đã chạy kiểm thử chưa?** Chưa (mới viết plan). Khi thực thi: `tsc --noEmit` + `npm run build` + E2E mobile.
> - **Đề xuất tiếp theo?** Bắt đầu P1 theo `ROADMAP.md` + `ai_config.yaml`.
