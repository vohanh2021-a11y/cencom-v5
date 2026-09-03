# UAT/plan/STATUS.md — Tổng hợp 15 case UAT

| STT | Case | Tên | Vai | Ưu tiên | Trạng thái | Video | Ghi chú / Tính năng ẩn |
|---|---|---|---|---|---|---|---|
| 1 | TC-ST-02 | CHẶN thiếu HĐĐT | ketoan | 0 | ✅ Đạt | `UAT/videos/TC-ST-02.webm` | **Tính năng ẩn ĐÃ CÓ**: `phieuChiCreate` (ketoan.ts) chặn ref_type=phieu_nhap thiếu vat_invoice (QC206 Điều 2). UAT xác nhận Đạt tự động. |
| 2 | TC-RP-02 | Lập SC 8 bước | xuong | 1 | ✅ Đạt | `UAT/videos/TC-RP-02.webm` | Wizard 8 bước hoạt động, redirect /sc/SC- (tính năng đã có). |
| 3 | TC-RP-03 | Duyệt phiếu | xuong | 1 | ✅ Đạt | `UAT/videos/TC-RP-03.webm` | Phân quyền duyệt có sẵn (laixe bị chặn, giamdoc duyệt). |
| 4 | TC-RP-05 | Phân quyền xem | laixe | 1 | ✅ Đạt | `UAT/videos/TC-RP-05.webm` | Export endpoint enforce 403 đúng (sau sửa bug params). |
| 5 | TC-ST-01 | Quyết toán | ketoan | 1 | ✅ Đạt | `UAT/videos/TC-ST-01.webm` | Quyết toán toàn trình (SC da_hoan + đủ hồ sơ) hoạt động. |
| 6 | TC-ST-03 | Xuất hồ sơ 9 tab | ketoan | 1 | ✅ Đạt | `UAT/videos/TC-ST-03.webm` | Đã sửa bug route export (params Promise) → 403/200 đúng. |
| 7 | TC-ST-04 | Báo cáo chi phí | giamdoc | 2 | ✅ Đạt | `UAT/videos/TC-ST-04.webm` | **Phải implement**: `baoCaoChiPhi` (report.ts) — 3 bên (sửa chữa/mua/kho) tách riêng, lọc YYYY-MM-DD. |
| 8 | TC-ST-05 | Đối soát 3 bên | ketoan | 2 | ✅ Đạt | `UAT/videos/TC-ST-05.webm` | **Phải implement**: `doiSoat` (report.ts) wrap `reconcileKho` có sẵn; RPC_META `['ke_toan','xem']`. |
| 9 | TC-RP-04 | Nghiệm thu/đóng | xuong | 2 | ✅ Đạt | `UAT/videos/TC-RP-04.webm` | RPC scCreate→scApprove→scStart→scFinish→scNghiem đã có sẵn; chặn đóng phiếu khi còn cv chưa xong đúng; nghiệm thu ghi ngày/người + biên bản. |
| 10 | TC-PR-01 | Đề xuất mua | khoa | 2 | ✅ Đạt | `UAT/videos/TC-PR-01.webm` | RPC dmCreate/dmDetail/dmListBySc có sẵn (kho.ts) — đề nghị liên kết SC, tổng đúng, truy vết SC OK, laixe bị chặn mua.tao. |
| 11 | TC-PR-02 | Duyệt mua | giamdoc | 2 | ✅ Đạt | `UAT/videos/TC-PR-02.webm` | dmDecide có sẵn — da_duyet + ghi nguoi_duyet/ngay_duyet; laixe bị chặn mua.duy. |
| 12 | TC-PR-03 | Lập phiếu mua | khoa | 2 | ✅ Đạt | `UAT/videos/TC-PR-03.webm` | phNhapCreate có sẵn — PXN-xxxxxx, tồn tăng, đề nghị sang da_nhap; laixe bị chặn kho.tao. |
| 13 | TC-PR-04 | Nhập kho | khoa | 2 | ✅ Đạt | `UAT/videos/TC-PR-04.webm` | phXuatCreate có sẵn — PXX-xxxxxx, tồn giảm, sc_vattu da_xuat, chặn xuất vượt tồn; laixe bị chặn kho.xuat. |
| 14 | TC-PR-05 | Xuất kho | khoa | 2 | ✅ Đạt | `UAT/videos/TC-PR-05.webm` | **Phải sửa**: Zod schema tonKhoReport (schemas.ts) lệch handler (tu_ngay/den_ngay vs from/to) → strip args → nhap/xuat=0; + test w3.spec.ts insert dm_mua_ct thiếu sc_id. Sau sửa: nhập/xuất/tồn khớp. |
| 15 | TC-RP-01 | Đề xuất sửa chữa | laixe | 2 | ✅ Đạt | `UAT/videos/TC-RP-01.webm` | deXuatCreate/Get/List đã có sẵn; đề xuất cho_duyet không có trường chi phí; xưởng thấy trong danh sách chờ xử lý. |

> Cập nhật bởi process chạy UAT. Khi 15/15 Đạt → "đạt tiêu chuẩn".
