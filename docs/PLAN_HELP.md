# KẾ HOẠCH TRANG HƯỚNG DẪN (Help — phím F1) — chờ duyệt

> Mục tiêu: người dùng tự học được app mà không cần gọi hỗ trợ. Phím **F1** ở bất kỳ màn hình nào cũng mở trang này. Nội dung lọc theo vai (NV kho không thấy mục kế toán).

## 1. Vị trí & cách mở

| Cách mở | Chi tiết |
|---|---|
| Phím **F1** | Listener toàn cục trong `(app)/layout.tsx` (keydown, `preventDefault` để chặn help trình duyệt) → `router.push('/huong-dan')` |
| Menu Electron | `Trợ giúp → 📖 Hướng dẫn sử dụng (F1)` trong `electron-hub/main.js` + `electron-spoke/main.js` (mở route `/huong-dan` trong cửa sổ) |
| Link trong app | Icon ❓ ở header cạnh NotificationCenter |

- Route: `app/(app)/huong-dan/page.tsx` (client component, không cần DB).
- Nội dung theo vai: prop `role` từ layout — tab Kế toán/AI Settings chỉ hiện với `admin,giamdoc,ketoan`; tab Kho chỉ `kho,admin,giamdoc`; SC/Xưởng cho `xuong`.

## 2. Cấu trúc Tab → Sub-tab

```
1. Bắt đầu (chung mọi vai)
   1.1 Đăng nhập & đổi mật khẩu lần đầu
   1.2 Tổng quan màn hình (dashboard, menu, tìm kiếm)
   1.3 Quy trình 8 bước hồ sơ QC206 (sơ đồ)
2. Sửa chữa — SC (vai xuong, giamdoc, admin)
   2.1 Tạo phiếu SC mới
   2.2 Thêm công việc & vật tư
   2.3 Duyệt theo ngưỡng (ai được duyệt bao nhiêu)
   2.4 Bắt đầu sửa → hoàn thành → nghiệm thu → quyết toán
   2.5 Từ chối phiếu
3. Kho & Mua sắm (vai kho, giamdoc, admin)
   3.1 Nhập kho / Xuất kho
   3.2 Phiếu 2 tầng (phieu_id) đọc thế nào
   3.3 Đề nghị mua (DM) & duyệt ngưỡng 5tr
   3.4 Tồn kho, tồn tối thiểu, vật tư thiếu
   3.5 Vật tư cũ hỏng & thanh lý
4. Kế toán (vai ketoan, giamdoc, admin)
   4.1 Sổ cái, chứng từ, khóa/mở kỳ
   4.2 Công nợ phải trả / phải thu
   4.3 Hóa đơn VAT đầu vào
   4.4 Báo cáo & xuất Excel
5. AI Trợ lý (HUB, vai giamdoc, admin, ketoan)
   5.1 Cài đặt provider (zen + mimo-v2.5)
   5.2 Hỏi đáp trong phạm vi dữ liệu
   5.3 Vision: upload hóa đơn viết tay → báo giá
   5.4 Giới hạn & bảo mật key
6. Đồng bộ Spoke (máy trạm LAN)
   6.1 Nhập IP HUB lần đầu
   6.2 Làm việc offline (hàng đợi, badge)
   6.3 Đồng bộ & xử lý xung đột
7. Sao lưu & Khôi phục (HUB, admin)
   7.1 Sao lưu 1-click
   7.2 Khôi phục từ file
   7.3 Lịch tự động (Task Scheduler)
8. MCP cho trưởng phòng (giamdoc, admin)
   8.1 Lấy MCP_API_KEY ở đâu
   8.2 Kết nối từ máy LAN (opencode/Cursor)
   8.3 Danh sách tool đọc được
9. Hỏi đáp nhanh (FAQ chung)
```

## 3. Nội dung chi tiết từng sub-tab (duyệt)

### 1.1 Đăng nhập & đổi mật khẩu lần đầu
> Mở app → nhập **Tên đăng nhập** + **Mật khẩu** (mặc định do admin cấp, vd `cencom@123`) → Đăng nhập. Lần đầu hệ thống **bắt buộc đổi mật khẩu** (màn hình “Đổi mật khẩu bắt buộc”): nhập mật khẩu cũ → mật khẩu mới (≥6 ký tự) → Lưu. Quên mật khẩu: nhờ admin đặt lại (`Người dùng → Đặt lại mật khẩu`).

### 1.2 Tổng quan màn hình
> **Dashboard**: 6 thẻ KPI (số xe, SC chờ duyệt/đang sửa/chờ nghiệm thu, quyết toán hôm nay, hoạt động 24h) + bảng Kanban 5 cột theo trạng thái SC. **Ô tìm kiếm** trên cùng: gõ ≥2 ký tự (mã SC, biển số, tên vật tư) → nhảy tới bản ghi. **Chuông** 🔔: vật tư thiếu + SC quá hạn. Menu trái lọc theo vai của bạn.

### 1.3 Quy trình 8 bước hồ sơ QC206
> 1 Kế hoạch (Mẫu 01) → 2 Kiểm tử vật tư → 3 Báo giá NCC → 4 Nhập kho → 5 Xuất kho → 6 Thu hồi VT cũ → 7 Nghiệm thu → 8 Bảng kê/quyết toán. Trang SC hiện **thanh tiến độ 8 bước**; thiếu bước nào thì quyết toán bị chặn — bấm vào bước thiếu để bổ sung.

### 2.1 Tạo phiếu SC mới
> `Sửa chữa → + Tạo phiếu` → chọn **Biển số xe** (ô tìm kiếm, xe chưa có thì `Xe → Thêm xe` trước) → Ngày (mặc định hôm nay) → Ghi chú thăm khám → Lưu. Phiếu mới ở trạng thái **đề xuất**.

### 2.2 Thêm công việc & vật tư
> Mở phiếu → `+ Công việc`: mô tả, loại xử lý (thay mới/sửa chữa/bảo dưỡng/khác), số lượng, đơn giá, gán thợ. `+ Vật tư`: chọn tên vật tư trong kho, số lượng (giá dự kiến `gd_dk`). Tổng phiếu tự tính: `tong_cong + tong_vt`.

### 2.3 Duyệt theo ngưỡng
> Nút **Duyệt** chỉ hiện ở phiếu `đề xuất`. Tổ trưởng xưởng duyệt được phiếu ≤ **5.000.000đ**; vượt ngưỡng phải **Giám đốc** duyệt (hệ thống báo “cần Giám đốc duyệt”). Sau duyệt → **Tổng duyệt** để chốt snapshot (kể từ đây không sửa dòng được nữa — muốn sửa phải lập phiếu mới).

### 2.4 Bắt đầu sửa → … → quyết toán
> `Bắt đầu sửa` (đề xuất đã duyệt → đang sửa, kèm hẹn ngày trả xe) → cập nhật tiến độ từng dòng việc (`cho/đang/hoan`) → `Hoàn thành` → `Nghiệm thu` (nhập tổng vật tư/nhân công thực tế) → `Quyết toán` (kế toán, khóa sổ phiếu).

### 3.1 Nhập kho / Xuất kho
> `Kho → Nhập`: chọn vật tư, số lượng, đơn giá, NCC → tồn tăng ngay. `Xuất`: chọn vật tư + phiếu SC (nếu xuất cho sửa chữa) → tồn giảm; **hết tồn thì bị chặn** (không cho xuất âm).

### 3.3 Đề nghị mua & duyệt 5tr
> Khi vật tư thiếu: `Tạo DM từ SC` (gom các dòng `cần mua`) hoặc `Tự động bổ sung` (quét dưới `ton_min`). DM ở `chờ duyệt` → người duyệt bấm **Duyệt/Từ chối** (từ chối bắt buộc lý do). Kế toán chỉ duyệt DM ≤ 5tr; trên 5tr cần Giám đốc. Duyệt xong → `Nhập theo DM` để tăng tồn.

### 3.4 Tồn kho & vật tư thiếu
> Tab `Tồn kho`: cột `thiếu = tồn − tồn_min` (âm = đang thiếu, cờ đỏ). Chuông 🔔 báo danh sách thiếu mỗi ca. Đặt `tồn tối thiểu` khi tạo vật tư để hệ thống tự cảnh báo.

### 4.1 Sổ cái & khóa kỳ
> Mọi nhập/xuất/quyết toán tự sinh bút toán Nợ/Có (không nhập tay). Cuối tháng: `Kế toán → Khóa kỳ` (chọn tháng) → từ đó không ghi lùi được nữa. Ghi nhầm thì `Mở lại kỳ` → sửa → khóa lại ngay.

### 4.2 Công nợ
> Tab `Công nợ`: `phải trả` (NCC) / `phải thu` (khách), mỗi dòng có **tuổi nợ** (số ngày quá hạn). Bấm `Chi` để thanh toán từng phần; hệ thống chặn chi vượt số còn lại.

### 4.4 Báo cáo & xuất Excel
> `Kế toán → Báo cáo`: chọn kỳ → xem cân đối phát sinh, chi phí, sổ 152/331/133. Nút **Xuất Excel** tải `.xlsx` (tối đa 20.000 dòng/lần; quá tải hệ thống báo thử lại sau).

### 5.1 Cài đặt provider
> `Cài đặt → AI` (chỉ admin/giám đốc): chọn **opencode zen**, dán **API key**, Model `mimo-v2.5` → **Test kết nối** (phải báo OK mới Lưu). Key được mã hóa trước khi lưu, không ai đọc được.

### 5.2 Hỏi đáp trong phạm vi dữ liệu
> Bấm nút 🤖 góc phải → hỏi tiếng Việt, vd “Tồn kho thiếu gì?”, “Công nợ quá hạn bao nhiêu?”. AI **chỉ trả lời từ số liệu thật** (tồn kho/công nợ/SC/DM); câu hỏi ngoài phạm vi (thời tiết, chính trị…) sẽ bị từ chối. Lịch sử chat được lưu để xem lại.

### 5.3 Vision hóa đơn viết tay
> `Báo giá → 📷 Upload ảnh hóa đơn` → chọn ảnh chụp hóa đơn (rõ chữ) → AI đọc ra NCC/ngày/dòng hàng **điền sẵn vào form** → **kiểm tra & sửa lại** → mới bấm Lưu. Ảnh mờ thì chụp lại, không lưu mù.

### 6.1 Nhập IP HUB lần đầu
> Mở app Spoke → màn hình “Kết nối HUB” → nhập IP HUB (vd `192.168.1.10:3000`, hỏi KT trưởng) → **Lưu & Kết nối** → đăng nhập như bình thường. Chỉ làm 1 lần, máy nhớ.

### 6.2 Làm việc offline
> Rút dây mạng vẫn nhập SC/vật tư bình thường — dữ liệu nằm chờ ở máy (badge **● Offline (N chưa đồng bộ)** góc trái). Không mất dữ liệu khi tắt máy đột ngột.

### 6.3 Đồng bộ & xung đột
> Có mạng → bấm **Đồng bộ** → máy gửi từng dòng lên HUB. Nếu HUB đã có bản mới hơn (vd người khác sửa cùng phiếu) → hiện **dialog xác nhận từng dòng** (“HUB mới hơn 2 phút — Ghi đè?”) → chọn **Đồng ý** hoặc **Bỏ**. Không bao giờ mất dữ liệu thầm lặng.

### 7.1 Sao lưu 1-click
> `Cài đặt → Sao lưu → Sao lưu ngay` → file `cencom-YYYYMMDD.dump` nằm ở `%APPDATA%/CencomOS/backup/`. Copy file này ra USB/D: mỗi tuần.

### 7.3 Lịch tự động
> Trên HUB: mở `Task Scheduler → Create Task` → chạy `pg_dump` mỗi đêm 23:00 ra `D:\Backup\CencomOS` (xem `Onpremise/scripts/backup.sh` mẫu). Kiểm tra file mới mỗi sáng thứ 2.

### 8.1–8.3 MCP
> Hỏi admin lấy **MCP_API_KEY** → trong opencode/Cursor trỏ `http://HUB_IP:3001/mcp` kèm Bearer → gọi được 81 tool đọc (`dashboardAll`, `tonKho`, `scList`…); tool ghi mặc định TẮT (muốn mở phải xin admin bật `MCP_WRITE_TOOLS`).

### 9. FAQ
> **Quên mật khẩu?** → nhờ admin đặt lại. **Xuất kho báo hết tồn?** → kiểm tra tồn thực + phiếu nhập chưa duyệt. **Không thấy menu Kế toán?** → đúng vai mới thấy (hỏi admin cấp quyền). **Spoke báo Offline dù có mạng?** → kiểm tra IP HUB + HUB có mở app không. **AI báo chưa cấu hình?** → admin vào Cài đặt → AI nhập key zen.

## 4. Triển khai sau duyệt (không làm trước)

1. `app/(app)/huong-dan/page.tsx` — Tabs + Sub-tabs (component `HelpTabs.tsx`), nội dung từ mục 3, lọc theo `role`.
2. F1 listener trong `(app)/layout.tsx` (`useEffect` keydown, bỏ qua khi đang gõ input).
3. Menu Electron Hub/Spoke: `Trợ giúp → 📖 Hướng dẫn (F1)` → `loadURL(.../huong-dan)`.
4. Icon ❓ header + test `tsc` + build.

**Anh duyệt nội dung trên (hoặc gạch chỗ cần sửa) → em ghép vào app.**
