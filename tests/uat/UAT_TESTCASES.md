# TÀI LIỆU KỊCH BẢN UAT — CencomOS Garage 4.0 (Quy chế 206)

> **Mục đích**: Hướng dẫn người kiểm thử (kể cả không rành công nghệ) thực hiện và đánh giá
> hệ thống theo **quy trình làm việc thật** của garage: tiếp nhận/sửa chữa xe, mua sắm vật tư,
> và quyết toán. Mỗi kịch bản mô tả rõ: ai làm, làm thế nào, mong đợi thấy gì, và khi nào là "đạt".
>
> **Nguyên tắc vàng**: UAT không kiểm tra "nút có bấm được không", mà kiểm tra
> "quy trình có chạy đúng ngoài đời không". Nếu một bước sai hoặc không giống mô tả,
> đánh dấu **KHÔNG ĐẠT** và ghi rõ chỗ sai vào cột Ghi chú.

---

## 1. Cách dùng tài liệu này
1. Đọc **Mục 2** để biết dùng tài khoản nào cho từng vai.
2. Chọn **quy trình** cần thử (Sửa chữa / Mua sắm / Quyết toán).
3. Làm đúng từng bước theo số thứ tự. Không bỏ bước.
4. Ở mỗi bước, so sánh **màn hình thật** với phần **Kết quả kỳ vọng**.
5. Điền kết quả vào **Phiếu tổng hợp (Mục 7)**.
6. Nếu hệ thống báo lỗi không mong muốn → chụp màn hình, ghi chú, báo lại đội kỹ thuật.

## 2. Tài khoản dùng thử (mật khẩu chung: `cencom@123`)
| Tài khoản | Vai trò (gọi tên) | Việc thường làm |
|---|---|---|
| `admin-1` | Quản trị viên | Toàn quyền, cấu hình, xem mọi báo cáo |
| `giamdoc-1` | Giám đốc | Duyệt lớn, xem báo cáo, xuất hồ sơ |
| `xuong-1` | Xưởng trưởng / Kỹ thuật | Lập phiếu sửa chữa, duyệt kỹ thuật, nghiệm thu |
| `khoa-1` | Phòng TB / Kho | Đề xuất mua, nhập/xuất kho |
| `ketoan-1` | Kế toán | Quyết toán, thanh toán, xuất hồ sơ |
| `pttb-1` | Phòng TB | Đề xuất mua, duyệt mua |
| `laixe-1` | Lái xe | Đề xuất sửa chữa, xem tình trạng xe |

> Mọi người dùng đều **đăng nhập bằng tài khoản/mật khẩu**, sau đó làm việc trên menu chính.

## 3. Quy tắc nghiệp vụ cốt lõi (phải luôn đúng)
- **Ba bên tách biệt**: Sửa chữa, Mua sắm, Kho là 3 luồng riêng. Không được trộn chi phí.
- **Phải có HĐĐT mới được thanh toán**: Phiếu nào thiếu hóa đơn điện tử (HĐĐT) thì **không được quyết toán/thanh toán**. Đây là luật cứng (Quy chế 206).
- **Ưu tiên dùng vật tư tồn kho** trước khi mua mới.
- **Hồ sơ 9 tab** (toàn bộ chi phí) chỉ người **lãnh đạo / kế toán** được tải; thợ, lái xe, kho **không được** xem toàn bộ chi phí.

---

# QUY TRÌNH 1 — TIẾP NHẬN & SỬA CHỮA XE

## TC-RP-01 — Lái xe đề xuất sửa chữa cho một xe
- **Vai**: Lái xe (`laixe-1`)
- **Tiền đề**: Đăng nhập bằng `laixe-1`.
- **Mục tiêu**: Ghi nhận xe hỏng cần sửa.
- **Các bước**:
  1. Mở menu **Xe / Đề xuất sửa chữa**.
  2. Nhập **biển kiểm soát** (vd: `51C-12345`).
  3. Nhập **mô tả hỏng hóc** (vd: "Máy không nổ, cần cứu hộ").
  4. Bấm **Gửi đề xuất**.
- **Kết quả kỳ vọng**: Hệ thống báo "Đã gửi". Đề xuất xuất hiện trong danh sách chờ xưởng xử lý.
- **Tiêu chí đạt**: Lái xe thấy đề xuất của mình đã nằm trong hệ thống; không cần nhập chi phí.
- **Thử sai (nên có)**: Để trống biển số → hệ thống báo "Thiếu thông tin", không cho gửi.

## TC-RP-02 — Xưởng trưởng lập phiếu sửa chữa (SC) bằng quy trình 8 bước
- **Vai**: Xưởng trưởng (`xuong-1`)
- **Tiền đề**: Có ít nhất 1 xe cần sửa (từ TC-RP-01 hoặc nhập trực tiếp).
- **Mục tiêu**: Tạo phiếu sửa chữa ghi rõ chẩn đoán, công việc, vật tư.
- **Các bước**:
  1. Mở menu **Sửa chữa → Tạo phiếu mới**.
  2. Bước 1 (Thông tin chung): nhập **biển kiểm soát**, chọn **loại xe**, ngày tiếp nhận.
  3. Bước 2 (Chẩn đoán): nhập **mô tả hỏng hóc**, **nguyên nhân nghi ngờ**.
  4. Bước 3 (Công việc): thêm các **công việc sửa chữa** (vd: "Thay bugi", "Vệ sinh kim phun").
  5. Bước 4 (Vật tư): với mỗi vật tư, chọn **Thay thế** hoặc **Khắc phục**, số lượng.
     - *Lưu ý*: nếu vật tư đã có trong kho, hệ thống nên gợi ý dùng hàng tồn trước.
  6. Bước 5–7: xác nhận ước tính, gán kỹ thuật viên (nếu có).
  7. Bước 8: bấm **Tạo phiếu**.
- **Kết quả kỳ vọng**: Hệ thống tạo **phiếu sửa chữa** (mã dạng `SC-xxxxxx`), chuyển sang màn hình chi tiết. Trạng thái hiển thị "Chờ duyệt".
- **Tiêu chí đạt**: Mã phiếu sinh ra đúng; công việc & vật tư đã lưu đủ; trạng thái đầu là "Chờ duyệt".
- **Thử sai**: Thiếu biển số → không cho tạo. Chọn "Thay thế" mà không nhập số lượng → báo lỗi.

## TC-RP-03 — Duyệt phiếu sửa chữa (theo thẩm quyền)
- **Vai**: Kỹ thuật / Xưởng trưởng (`xuong-1`) hoặc Giám đốc (`giamdoc-1`) với phiếu lớn.
- **Tiền đề**: Có phiếu ở trạng thái "Chờ duyệt" (từ TC-RP-02).
- **Mục tiêu**: Xác nhận phiếu hợp lệ để đưa vào thực hiện.
- **Các bước**:
  1. Mở **Sửa chữa → Danh sách**, mở phiếu vừa tạo.
  2. Xem lại công việc, vật tư, tổng chi phí ước tính.
  3. Bấm **Duyệt** (hoặc **Từ chối** nếu sai).
- **Kết quả kỳ vọng**: Nếu duyệt → trạng thái sang "Đang sửa chữa". Nếu từ chối → phiếu quay lại "Chờ sửa", có ghi chú lý do.
- **Tiêu chí đạt**: Trạng thái thay đổi đúng; người đề xuất thấy được kết quả duyệt.
- **Thử sai**: Người không có quyền duyệt (vd lái xe) mở phiếu → **không có nút Duyệt**.

## TC-RP-04 — Thợ thực hiện & Nghiệm thu
- **Vai**: Xưởng trưởng / Kỹ thuật viên (`xuong-1`)
- **Tiền đề**: Phiếu đã duyệt (từ TC-RP-03).
- **Mục tiêu**: Cập nhật tiến độ, ghi nhận hoàn thành, đóng phiếu.
- **Các bước**:
  1. Mở phiếu, cập nhật **tiến độ** từng công việc (đang làm / xong).
  2. Khi xong hết, bấm **Nghiệm thu**.
  3. Kiểm tra vật tư xuất kho đã khớp với thực tế.
  4. Bấm **Đóng phiếu**.
- **Kết quả kỳ vọng**: Trạng thái sang "Đã nghiệm thu / Chờ quyết toán". Hệ thống ghi ngày hoàn thành.
- **Tiêu chí đạt**: Không thể "Đóng phiếu" khi còn công việc chưa xong (nếu hệ thống kiểm soát).
- **Thử sai**: Đóng phiếu khi chưa nghiệm thu → hệ thống từ chối hoặc giữ trạng thái.

## TC-RP-05 — Theo dõi luồng trạng thái (mọi vai thấy đúng góc nhìn)
- **Vai**: Lái xe, Xưởng, Kế toán, Giám đốc (lần lượt đăng nhập)
- **Tiền đề**: Phiếu đã qua các bước trên.
- **Mục tiêu**: Mỗi vai thấy thông tin phù hợp, không lộ chi phí cho người không được xem.
- **Các bước**:
  1. Lái xe (`laixe-1`) mở phiếu → thấy trạng thái, **không thấy** chi tiết chi phí vật tư.
  2. Xưởng (`xuong-1`) mở phiếu → thấy công việc, vật tư, nhưng **không tải được hồ sơ 9 tab**.
  3. Kế toán (`ketoan-1`) / Giám đốc (`giamdoc-1`) mở phiếu → thấy đầy đủ, **có nút Xuất hồ sơ**.
- **Kết quả kỳ vọng**: Phân quyền hiển thị đúng theo vai.
- **Tiêu chí đạt**: Lái xe & xưởng **không** truy cập được toàn bộ chi phí.

---

# QUY TRÌNH 2 — MUA SẮM VẬT TƯ

## TC-PR-01 — Đề xuất mua vật tư
- **Vai**: Phòng TB / Kho (`khoa-1` hoặc `pttb-1`)
- **Tiền đề**: Có vật tư cần mua (do sửa chữa hoặc tồn kho thấp).
- **Mục tiêu**: Ghi nhận nhu cầu mua.
- **Các bước**:
  1. Mở menu **Mua sắm → Đề xuất mua**.
  2. Chọn/nhập **vật tư**, số lượng, đơn giá dự kiến, lý do mua.
  3. (Nếu từ sửa chữa) liên kết với **phiếu sửa chữa** tương ứng.
  4. Bấm **Gửi đề xuất**.
- **Kết quả kỳ vọng**: Đề xuất nằm trong danh sách chờ duyệt mua.
- **Tiêu chí đạt**: Thông tin lưu đủ; có thể truy vết về phiếu sửa chữa gốc.

## TC-PR-02 — Duyệt đề xuất mua
- **Vai**: Giám đốc (`giamdoc-1`) / Phòng TB (`pttb-1`)
- **Tiền đề**: Có đề xuất ở trạng thái "Chờ duyệt".
- **Mục tiêu**: Phê duyệt mới được mua.
- **Các bước**:
  1. Mở đề xuất, xem vật tư & số tiền.
  2. Bấm **Duyệt** (hoặc **Từ chối** kèm lý do).
- **Kết quả kỳ vọng**: Đề xuất sang "Đã duyệt" → có thể lập đơn hàng mua.
- **Tiêu chí đạt**: Không ai ngoài người có thẩm quyền bấm được Duyệt.

## TC-PR-03 — Lập phiếu mua / Đơn hàng
- **Vai**: Phòng TB / Kho (`khoa-1`)
- **Tiền đề**: Đề xuất đã duyệt (TC-PR-02).
- **Mục tiêu**: Tạo phiếu mua hàng gửi nhà cung cấp.
- **Các bước**:
  1. Từ đề xuất đã duyệt, bấm **Tạo phiếu mua**.
  2. Kiểm tra vật tư, số lượng, đơn giá, nhà cung cấp.
  3. Bấm **Lưu phiếu mua**.
- **Kết quả kỳ vọng**: Phiếu mua được tạo (mã `MUA-xxxxxx`), trạng thái "Chờ nhập kho".
- **Tiêu chí đạt**: Số tiền phiếu mua không vượt quá đề xuất đã duyệt (hệ thống nên cảnh báo nếu vượt).

## TC-PR-04 — Nhập kho vật tư
- **Vai**: Kho (`khoa-1`)
- **Tiền đề**: Có phiếu mua "Chờ nhập kho" (TC-PR-03).
- **Mục tiêu**: Hàng về, nhập kho, tăng tồn kho.
- **Các bước**:
  1. Mở phiếu mua, bấm **Nhập kho**.
  2. Nhập số lượng thực nhận, ngày nhập.
  3. Xác nhận.
- **Kết quả kỳ vọng**: Tồn kho vật tư **tăng** đúng số lượng; phiếu sang "Đã nhập".
- **Tiêu chí đạt**: Số lượng tồn kho sau nhập = trước + thực nhận.

## TC-PR-05 — Xuất kho cho phiếu sửa chữa
- **Vai**: Kho (`khoa-1`)
- **Tiền đề**: Có phiếu sửa chữa cần vật tư đã có trong kho.
- **Mục tiêu**: Xuất đúng vật tư cho đúng phiếu.
- **Các bước**:
  1. Mở phiếu sửa chữa, mục **Vật tư**, bấm **Xuất kho**.
  2. Hệ thống trừ tồn kho tương ứng.
- **Kết quả kỳ vọng**: Tồn kho **giảm**; phiếu sửa chữa ghi nhận vật tư đã xuất.
- **Tiêu chí đạt**: Không thể xuất nhiều hơn tồn kho thực tế (hệ thống báo lỗi nếu thiếu).

---

# QUY TRÌNH 3 — QUYẾT TOÁN & BÁO CÁO

## TC-ST-01 — Quyết toán phiếu sửa chữa
- **Vai**: Kế toán (`ketoan-1`)
- **Tiền đề**: Phiếu đã nghiệm thu, có đủ chứng từ.
- **Mục tiêu**: Chốt chi phí, chuyển sang thanh toán.
- **Các bước**:
  1. Mở phiếu sửa chữa đã nghiệm thu.
  2. Mở mục **Quyết toán**, kiểm tra các khoản: công việc, vật tư, phụ phí vận chuyển (nếu có).
  3. Bấm **Quyết toán**.
- **Kết quả kỳ vọng**: Phiếu sang "Đã quyết toán"; số liệu khớp với thực tế nhập.
- **Tiêu chí đạt**: Tổng chi phí hiển thị = tổng công việc + vật tư + phụ phí (không âm, không nhảy số lạ).

## TC-ST-02 — CHẶN thanh toán khi thiếu HĐĐT (luật cứng Quy chế 206)
- **Vai**: Kế toán (`ketoan-1`)
- **Tiền đề**: Phiếu sửa chữa hoặc phiếu mua **chưa gắn hóa đơn điện tử (HĐĐT)**.
- **Mục tiêu**: Hệ thống phải **từ chối** cho quyết toán/thanh toán.
- **Các bước**:
  1. Mở một phiếu **chưa có HĐĐT**.
  2. Thử bấm **Quyết toán / Thanh toán**.
- **Kết quả kỳ vọng**: Hệ thống **báo lỗi rõ ràng** (vd: "Chưa có hóa đơn điện tử, không được thanh toán") và **không lưu** quyết toán.
- **Tiêu chí đạt**: Không thể quyết toán khi thiếu HĐĐT. Đây là **test quan trọng nhất** của Quy chế 206.
- **Thử ngược**: Gắn HĐĐT hợp lệ → mới cho quyết toán.

## TC-ST-03 — Xuất hồ sơ 9 tab (giới hạn vai)
- **Vai**: Kế toán (`ketoan-1`) / Giám đốc (`giamdoc-1`) — được; Lái xe / Xưởng / Kho — không được.
- **Tiền đề**: Có ít nhất 1 phiếu sửa chữa.
- **Mục tiêu**: Chỉ lãnh đạo/kế toán tải được toàn bộ hồ sơ chi phí.
- **Các bước**:
  1. Đăng nhập `ketoan-1` (hoặc `giamdoc-1`), mở phiếu, bấm **Xuất hồ sơ (9 tab)**.
  2. Đăng nhập `laixe-1` (hoặc `xuong-1`), mở cùng phiếu, thử bấm/truy cập **Xuất hồ sơ**.
- **Kết quả kỳ vọng**:
  - Kế toán/Giám đốc: tải được file Excel 9 sheet (thông tin chung, công việc, vật tư thay thế, vật tư khắc phục, củ hỏng, biên bản, chi phí…).
  - Lái xe/Xưởng/Kho: **bị từ chối** (không có nút, hoặc bấm ra thông báo "Không có quyền").
- **Tiêu chí đạt**: Phân quyền xuất hồ sơ đúng; vai không được phép không lấy được file chi phí.

## TC-ST-04 — Báo cáo chi phí theo xe / theo thời gian
- **Vai**: Giám đốc / Kế toán (`giamdoc-1`, `ketoan-1`)
- **Tiền đề**: Đã có vài phiếu sửa chữa & mua quyết toán.
- **Mục tiêu**: Xem tổng chi phí đúng, tách biệt 3 bên.
- **Các bước**:
  1. Mở menu **Báo cáo → Chi phí**.
  2. Chọn **theo xe** (nhập biển số) hoặc **theo khoảng thời gian**.
  3. Xem số liệu.
- **Kết quả kỳ vọng**: Tổng chi phí sửa chữa, mua, kho **hiển thị riêng biệt**, không cộng nhầm.
- **Tiêu chí đạt**: Số liệu báo cáo = tổng các phiếu đã quyết toán trong kỳ.

## TC-ST-05 — Đối soát 3 bên (sửa chữa – mua – kho)
- **Vai**: Kế toán (`ketoan-1`)
- **Tiền đề**: Có chuỗi: phiếu sửa chữa → xuất kho → phiếu mua → nhập kho.
- **Mục tiêu**: Số liệu 3 luồng khớp nhau, không lệch.
- **Các bước**:
  1. Mở báo cáo, so sánh: vật tư xuất cho sửa chữa = vật tư nhập từ mua (cho cùng đợt).
  2. Kiểm tra chi phí sửa chữa không chứa khoản mua chưa nhập kho.
- **Kết quả kỳ vọng**: Các số đối soát khớp; nếu lệch, hệ thống có cảnh báo.
- **Tiêu chí đạt**: Không có chi phí "treo" không giải trình được.

---

# 4. Ma trận quyền theo vai (tham khảo nhanh)
| Hành động | Lái xe | Xưởng | Kho/PTTB | Kế toán | Giám đốc | Admin |
|---|---|---|---|---|---|---|
| Đề xuất sửa chữa | ✅ | ✅ | ✅ | ❌ | ❌❌* | ✅ |
| Lập & duyệt SC | ❌ | ✅ | ❌ | ❌ | ✅(lớn) | ✅ |
| Nghiệm thu / đóng phiếu | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Đề xuất & duyệt mua | ✅(đx) | ❌ | ✅ | ❌ | ✅ | ✅ |
| Nhập/xuất kho | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| Quyết toán / thanh toán | ❌ | ❌ | ❌ | ✅ | ✅(duyệt) | ✅ |
| Xuất hồ sơ 9 tab | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Xem báo cáo chi phí | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |

\* Giám đốc không trực tiếp đề xuất sửa chữa nhưng được duyệt lớn.

# 5. Các điểm rủi ro cần chú ý khi UAT
- **HĐĐT là then chốt**: nếu thiếu HĐĐT mà vẫn quyết toán được → **lỗi nghiêm trọng**, báo ngay.
- **Lộ chi phí**: lái xe/xưởng mà xem được toàn bộ hồ sơ 9 tab → **lỗi phân quyền**.
- **Nhầm 3 bên**: chi phí mua bị gộp vào sửa chữa → sai báo cáo.
- **Tồn kho âm**: xuất kho nhiều hơn tồn → lỗi kho.

# 6. Tiêu chí "ĐẠT" chung
- Mọi bước trong kịch bản chạy đúng như **Kết quả kỳ vọng**.
- Không có lỗi hệ thống (màn hình đỏ, treo, mất dữ liệu).
- Phân quyền đúng theo Mục 4.
- Các test "thử sai" (negative) cũng phản hồi đúng.

# 7. Phiếu tổng hợp kết quả (điền khi chạy)
| Mã TC | Tên quy trình | Vai thử | Kết quả (Đạt/Không) | Ghi chú / Lỗi gặp |
|---|---|---|---|---|
| TC-RP-01 | Đề xuất sửa chữa | Lái xe | ☐ | |
| TC-RP-02 | Lập phiếu SC 8 bước | Xưởng | ☐ | |
| TC-RP-03 | Duyệt phiếu | Xưởng/GĐ | ☐ | |
| TC-RP-04 | Nghiệm thu & đóng phiếu | Xưởng | ☐ | |
| TC-RP-05 | Phân quyền xem phiếu | Nhiều vai | ☐ | |
| TC-PR-01 | Đề xuất mua | Kho/PTTB | ☐ | |
| TC-PR-02 | Duyệt mua | GĐ/PTTB | ☐ | |
| TC-PR-03 | Lập phiếu mua | Kho | ☐ | |
| TC-PR-04 | Nhập kho | Kho | ☐ | |
| TC-PR-05 | Xuất kho cho SC | Kho | ☐ | |
| TC-ST-01 | Quyết toán phiếu | Kế toán | ☐ | |
| TC-ST-02 | CHẶN thiếu HĐĐT | Kế toán | ☐ | ⭐ Quan trọng nhất |
| TC-ST-03 | Xuất hồ sơ 9 tab | Kế toán/GĐ vs khác | ☐ | |
| TC-ST-04 | Báo cáo chi phí | GĐ/Kế toán | ☐ | |
| TC-ST-05 | Đối soát 3 bên | Kế toán | ☐ | |

> Khi chạy tự động (Playwright), mỗi dòng trên tương ứng 1 kịch bản trong `tests/uat/roles/`.
> Tài liệu này là bản con người đọc; bản máy chạy nằm ở `tests/uat/` (cần dev chạy `pwsh tests/uat/run-all.ps1`).

---

⚠️ **Lưu ý hệ thống sản xuất (Production Check)**
- **Còn thiếu gì?** Tài liệu UAT này mới là bản **thiết kế kịch bản** (mức nghiệp vụ). Bản tự động (Playwright) hiện mới phủ 1 phần (login + phân quyền xuất hồ sơ + admin tạo SC); chưa viết kịch bản máy cho trọn vẹn 3 quy trình (mua, kho, quyết toán, chặn HĐĐT). Ngoài ra lỗi `must_change` của 4 vai (giamdoc/xuong/khoa/ketoan) trong script `ensure-uat-users.mjs` **chưa sửa** (UPDATE chỉ nhắm 2 vai) → chưa chạy live được 4 vai này.
- **Rủi ro ở đâu?** (1) Nếu để script cũ, UAT live chỉ chạy được 3/7 vai. (2) Test "chặn thiếu HĐĐT" (TC-ST-02) là quan trọng nhất nhưng hiện **chưa có** test máy tương ứng — mới chỉ mô tả trong tài liệu. (3) Phân quyền xuất hồ sơ đã siết (ROLE_RESTRICT) nhưng cần UAT thực tế xác nhận.
- **Đã chạy kiểm thử chưa?** Chưa chạy live UAT (kẹt login 4 vai do bug script). Đã chạy: typecheck web (EXIT 0), core 341/341 test, conformance QC206 (6/6), migration áp thành công, harness liệt kê 35 test hợp lệ.
- **Đề xuất cải thiện tiếp theo?** (a) Sửa scope UPDATE trong `ensure-uat-users.mjs` → chạy live 7 vai + xuất video. (b) Viết thêm spec máy ánh xạ TC-ST-02 (chặn HĐĐT), TC-PR (mua/kho), TC-RP (duyệt/nghiệm thu) theo đúng mã TC ở trên. (c) Gắn mã TC vào tên test để đối chiếu dễ dàng giữa tài liệu và kết quả máy.
