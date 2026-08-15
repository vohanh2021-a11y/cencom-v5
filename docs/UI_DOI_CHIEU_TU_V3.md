# UI ĐỐI CHIẾU — Danh sách điều chỉnh giao diện chức năng cần kiểm tra ở v4.0

> Dành cho AI / phiên làm việc khác tiếp tục phát triển **cencomOS_gara_4.0_supa**.
> File này ghi lại các yêu cầu & lỗi UI/UX đã phát hiện và sửa ở **v3.6** — khi port giao diện sang
> Next.js/Tailwind, phải **đọc, đối chiếu và tinh chỉnh** theo danh sách dưới đây.
> Nguồn: `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\` (bản gốc đang chạy) · Ngày cập nhật: 2026-08-15

---

## 1. BỐI CẢNH

Ở v3.6, chủ dự án yêu cầu kiểm tra và sửa một loạt vấn đề giao diện chức năng. Các sửa đổi đã hoàn tất
ở v3.6 (Kanban, toast, ESC, preview) — **bản v4.0 cần tái tạo đúng hành vi** (UI parity), không được
"quên" các hành vi này khi viết lại frontend bằng Next.js.

---

## 2. DANH SÁCH BẮT BUỘC ĐỐI CHIẾU (checklist cho AI phiên khác)

### 2.1 Toast thông báo — nhỏ, tự tắt nhanh, đóng được bằng click/ESC
- **Yêu cầu chủ dự án**: toast không được quá lớn che cả màn hình; tự tắt nhanh (~1s–1.5s);
  phải có cách đóng nhanh: click chuột, hoặc phím ESC.
- **Đã làm ở v3.6** (`client/index.html`):
  - `pointer-events: auto` (trước là `none` → không click được).
  - Timeout tự ẩn giảm từ `2600ms` → `1500ms`.
  - Có nút `✕` bên trong toast + click vào thân toast cũng đóng (`toastHide()`).
  - ESC trong keydown toàn cục đóng toast trước, rồi mới đóng modal.
- **Cần làm ở v4**: component Toast (Tailwind) — kích thước tối đa, `max-width`, tự ẩn 1.5s,
  nút đóng, hỗ trợ ESC; **không** dùng `pointer-events: none` thuần.

### 2.2 ESC đóng mọi cửa sổ nhỏ / modal
- **Yêu cầu chủ dự án**: ESC phải đóng được mọi cửa sổ nhỏ (toast, modal chi tiết, modal form…),
  không bắt buộc phải bấm nút `✕`.
- **Đã làm ở v3.6**: keydown toàn cục trong `index.html` xử lý ESC theo thứ tự:
  1. Đóng palette (nếu mở) → 2. Đóng toast → 3. Đóng `#vhdModal` (modal hồ sơ SC Kanban)
     → 4. Đóng `gd3modal` (modal form chung qua `clModal`).
  - `openVehicleDetail` trong `gd3.js` expose `window.openVehicleDetail` và overlay có
    `id="vhdModal"` để keydown tìm thấy.
- **Cần làm ở v4**: hook `keydown` toàn cục một chỗ; mọi modal/overlay phải có id/quy ước để
  đóng chung; ưu tiên đóng layer gần nhất (toast → modal nhỏ → modal to).

### 2.3 Kanban Bảng điều khiển — 1 xe = 1 ô, 5 cột, modal hồ sơ SC
- **Yêu cầu chủ dự án**: Kanban đơn giản, mỗi **xe = 1 thẻ**, không mỗi phiếu 1 thẻ.
- **Đã làm ở v3.6** (`server/xuong.js` `dashboardAll()` + `client/gd3.js`):
  - 5 cột: `de_xuat | da_duyet | dang_sua | cho_nghiem | tu_choi` (bỏ `da_tong_duyet`,
    `da_hoan`, `da_quyet`).
  - Group theo `bks`; thẻ xe hiển thị: số SC, tổng tiền, tiến độ CV, thợ chính, ETA,
    breakdown trạng thái (🔧 đang sửa / 📋 chờ nghiệm / 📝 chờ duyệt).
  - Ưu tiên xếp cột: `dang_sua(5) > cho_nghiem(4) > da_duyet(3) > de_xuat(2) > tu_choi(1)`.
  - Bấm thẻ → **modal timeline** 5 bước: Lập → Duyệt → Bắt đầu → Hẹn trả → Nghiệm thu
    (dot xanh = done, dot vàng = ETA); hiện mã SC, trạng thái, loại (xưởng/NC ngoài),
    người lập, mô tả, tổng tiền, tiến độ CV.
- **Lưu ý v4**: `packages/core/src/xuong.ts` đã có `dashboardAll` 5 cột + group BKS
  (GĐ2 pass). Việc còn lại là **UI**: tái tạo thẻ xe + modal timeline giống v3.6.

### 2.4 Role Preview — dữ liệu DEMO phải khác nhau theo vai
- **Lỗi gốc ở v3.6**: `_demoDM(role)` và `_demoVattu()` **không lọc theo role** → mọi vai
  xem thử đều thấy y hệt nhau ở tab Đề nghị mua / Kho & tồn (cảm giác "copy 1 bản giống nhau").
- **Đã sửa ở v3.6** (`server/preview.js`):
  - `_demoDM(role)`: `giamdoc/ketoan/quanly` thấy cả 3 (cho_duyet, da_duyet, tu_choi);
    `khoa` chỉ thấy `da_duyet`; `tho/xuong/laixe` thấy `[]`.
  - `_demoVattu(role)`: `giamdoc/ketoan/quanly/khoa` thấy đủ 5; `tho`/`xuong` thấy lát cắt
    vật tư liên quan sửa chữa; `laixe` thấy `[]`.
  - `previewKho(role)` truyền `role` xuống `_demoVattu(role)`; `_demoHome(role)` cũng dùng
    `_demoVattu(role)` cho `lowTon`.
  - Thêm test role-specific vào `tests/gd3_preview.js`.
- **Cần làm ở v4**: `packages/core/src/preview.ts` phải implement đúng logic lọc theo vai;
  viết test cho từng vai (đặc biệt `khoa`, `tho`, `laixe`).

### 2.5 Cổng lái xe — không bắt buộc đổi mật khẩu khi vào
- **Yêu cầu chủ dự án**: lái xe đăng nhập vào thẳng giao diện chính, **không** bị modal
  bắt buộc đổi mật khẩu mặc định.
- **Đã làm ở v3.6** (`client/laixe.html`): xoá modal `pwModal`, `openPwModal`/`sendPw`,
  check `needChangePw` trong `rpc()`. Backend vẫn giữ `must_change` (chỉ cần cho admin).
- **Lưu ý v4**: quyết định giữ hay bỏ hoàn toàn luồng `must_change` cho lái xe; nếu giữ
  backend thì UI cổng lái xe không được khoá.

---

## 3. CÁCH ĐỐI CHIẾU (workflow gợi ý)

1. Đọc file này → đánh dấu từng mục `[ ]` thành `[x]` khi UI v4 đã khớp.
2. Chạy app v3.6 (`cd server; node index.js`, cổng 3100) để xem hành vi thật bên gốc.
3. Với mỗi mục ở mục 2, mở màn hình tương ứng trong v4 và so sánh 1-1.
4. Nếu phát hiện khác biệt → sửa, thêm test (vitest cho core; Playwright cho UI nếu có).
5. Cập nhật file này + `docs/CHANGELOG.md` của v4.

---

## 4. GHI NHẬN

| Ngày | Mục | Trạng thái v4 |
|---|---|---|
| 2026-08-15 | 2.1 Toast | ⏳ chưa đối chiếu |
| 2026-08-15 | 2.2 ESC modal | ⏳ chưa đối chiếu |
| 2026-08-15 | 2.3 Kanban 1 xe/1 ô + modal timeline | ⏳ core đã có (GĐ2); UI chưa |
| 2026-08-15 | 2.4 Preview demo theo vai | ⏳ chưa đối chiếu (xem `packages/core/src/preview.ts`) |
| 2026-08-15 | 2.5 Cổng lái xe bỏ mustChange | ⏳ chưa đối chiếu |
