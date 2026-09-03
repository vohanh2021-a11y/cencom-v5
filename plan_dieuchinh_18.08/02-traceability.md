# 02 — MA TRẬN ĐỐI CHIẾU (TRACEABILITY) QC206 ↔ HỆ THỐNG v4

> Cách đọc: mỗi dòng = 1 yêu cầu từ QC206 → bằng chứng trong code v4 → trạng thái (✅ có / ⚠️ một phần / ❌ thiếu).
> Bằng chứng lấy từ `packages/core/src/*`, `apps/web/lib/rpc-dispatch.ts`, `apps/web/app/(app)/*`.

## A. Nguyên tắc & trách nhiệm (Điều 2)

| Mã | Yêu cầu QC206 | Bằng chứng v4 | Trạng thái |
|---|---|---|---|
| P2.1a | Tổ PTTB quản lý TB ngoài xưởng, giám sát | Chưa có role `Tổ PTTB`; giám sát chưa phân vai riêng | ❌ |
| P2.1b | Xưởng thực hiện sửa khi có lệnh PTTB | `xuong` có `sc.tao/sua/kehoach`; `de_xuat` từ `xuong` | ✅ |
| P2.1c | Tổ PTTB quyết định mua chất lượng VTPT | `mua.duy` = `ketoan/quanly/giamdoc` (không phải PTTB) | ⚠️ |
| P2.2a | KHÔNG TT khi thiếu hồ sơ/chứng từ | `phieuChiCreate` chỉ chặn vượt nợ, **không check `vat_invoice`** | ❌ |
| P2.2b | KHÔNG TT khi không thu hồi VT cũ | `autoGenCuHong` thủ công, không bắt buộc, không link tới TT | ❌ |
| P2.3a | Sửa chữa có kế hoạch/lệnh cấp phát | `de_xuat` → `deXuatApprove` → `deXuatToSC` | ✅ |
| P2.3b | Có nghiệm thu PTTB + bàn giao | `scNghiem` (`sc.duy`); chưa rõ "bàn giao" thành biên bản | ⚠️ |

## B. Quy trình sửa chữa (Điều 3 — 7 bước)

| Bước | Yêu cầu | Bằng chứng v4 | Trạng thái |
|---|---|---|---|
| 1 | Lập kế hoạch SC (đề xuất lái xe + kiểm tra) | `de_xuat` (Đề xuất); `laixe` chỉ preview | ⚠️ |
| 2 | Gửi kế hoạch → Xưởng xác nhận | `deXuatApprove` (de_xuat.duy) | ✅ |
| 3 | Kiểm tu hư hỏng, bổ sung | `sc/[id]` có trạng thái; chưa có "bản kiểm tu" riêng | ⚠️ |
| 4 | Lập phương án + kế hoạch mua VT | `sc` + `mua` (`dmFromSC`) | ✅ |
| 5 | Công ty phê duyệt nếu lớn | `canApproveSC` (giamdoc/quanly ≤ ngưỡng) | ✅ |
| 6 | Tổ chức sửa chữa | `scStart`, `scWork*` | ✅ |
| 7 | Nghiệm thu – bàn giao – bảo hành | `scNghiem` + `bien_ban_nghiem` (snapshot); thiếu in "bàn giao+bảo hành" | ⚠️ |

## C. Quản lý vật tư (Điều 5)

| Mã | Yêu cầu | Bằng chứng v4 | Trạng thái |
|---|---|---|---|
| 5.1a | Mua theo kế hoạch phê duyệt | `dmDecide` (mua.duy), `canApproveMua` | ✅ |
| 5.1b | Nhập–xuất kho trước khi dùng | `phNhapCreate` + `autoXuatSC` (chỉ xuất khi nhập đủ) | ✅ |
| 5.1c | Bắt buộc thu hồi VT cũ nhập kho | `loai_nhap='cu_hong'` + `phieu_nhap_thanhly` (tự động từ SC, thủ công chưa có UI) | ⚠️ |
| 5.1d | Báo giá + hồ sơ mua bán | `baogia`, `vatInvoiceSave` | ✅ |
| 5.2a | Kho VTPT tập trung tại Xưởng | `kho` module (1 thủ kho = `khovattu`) | ✅ |
| 5.2b | Kho nhiên liệu thuộc phòng Xe máy | Chưa phân kho nhiên liệu riêng | ❌ (nhỏ) |
| 5.2c | Kho chất thải nguy hại | `thanhly` (Thanh lý VT cũ/hỏng) — gần đúng | ⚠️ |

## D. Quản lý chi phí & thanh toán (Điều 6 + liên đới)

| Mã | Yêu cầu | Bằng chứng v4 | Trạng thái |
|---|---|---|---|
| D.1 | Xưởng lập hồ sơ quyết toán | `quyetToan` (asset.quyet), `lichSuaList` | ✅ |
| D.2 | Tổ PTTB kiểm soát giá/chất lượng | Chưa có role PTTB để kiểm soát | ❌ |
| D.3 | Thanh toán NCC (có chứng từ) | `phieuChiCreate` — **thiếu check HĐĐT** | ❌ |
| D.4 | Công nợ phải trả NCC | `cong_no` (phai_tra), `congNoList` | ✅ |
| D.5 | VAT đầu vào | `vatInvoiceSave` (Nợ 133) | ✅ |

## E. Kế toán (8 bước) — đã có trong `plan_ketoan/read_06`
- Đối chiếu: `ketoan-gd2/gd3` test đã cover Nợ 154/152, 622/334, 642/241, 331/112.
- Khoản chưa cover: **enforce P2.2a (TT cần HĐĐT)** và **P2.2b (TT cần thu hồi VT cũ)** ở tầng logic.

## TỔNG KẾT GAP (cần build sau khi duyệt)
1. ❌ Thiếu role `Tổ PTTB` (giám sát + quyết định mua).
2. ❌ Role `laixe` chỉ demo → cần role thực hoặc gộp vào `de_xuat` của đơn vị.
3. ❌ `phieuChiCreate` chưa chặn thiếu `vat_invoice` (P2.2a).
4. ❌ Chưa bắt buộc thu hồi VT cũ trước khi nghiệm thu/thanh toán (P2.2b).
5. ⚠️ Mẫu 6 (nhập VT cũ hỏng) thiếu UI nhập thủ công; Mẫu 8 (bảng kê thay thế) thiếu in.
6. ⚠️ Nghiệm thu thiếu "bàn giao + bảo hành" thành biên bản in.
