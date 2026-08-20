# SCENARIOS — Kịch bản Fully-Dressed (Thiết kế ngược từ 4 vai)

> Template: Cockburn *Writing Effective Use Cases*. Mỗi use case có MSS (Main Success
> Scenario) + Extensions + Stakeholder. Không mô tả UI (INTENT NOT UI).

---

## UC1 — Trưởng xưởng lập & phê duyệt phiếu sửa chữa (SC)

- **Primary Actor**: `xuong` (Trưởng xưởng)
- **Goal**: Tiếp nhận xe, lập phiếu sửa chữa, phê duyệt để bắt đầu sửa
- **Scope**: Một phiếu sửa chữa cho 1 xe
- **Level**: User Goal
- **Preconditions**: Đã đăng nhập; xe đã có trong hệ thống
- **Trigger**: Xe vào xưởng cần sửa chữa

**Main Success Scenario (MSS):**
1. Trưởng xưởng chọn xe vào xưởng
2. Hệ thống hiển thị thông tin xe (biển, chủ, năm SX)
3. Trưởng xưởng thêm các công việc sửa (mô tả, nguyên nhân, loại xử lý)
4. Trưởng xưởng thêm vật tư dự kiến (từ danh mục hoặc vật tư mới)
5. Hệ thống tính tạm tổng chi phí (tong_cong + tong_vt)
6. Trưởng xưởng **bắt đầu sửa** → trạng thái `dang_sua`
   (⚠️ duyệt làm THỦ CÔNG — phiên bản này KHÔNG có nút duyệt/ngưỡng trên phần mềm)
7. Hệ thống ghi `activity_log`: "xuong bat dau sua SC-X"

**Extensions:**
- 3a. Chưa có vật tư trong kho → hệ thống báo thiếu → chuyển UC2 (Kho mua)
- 4a. Vật tư chưa có trong danh mục → Trưởng xưởng/Kho thêm mới vật tư
- 6a. Từ chối phiếu (trước khi sửa) → trạng thái `tu_choi` + ghi lý do → kết thúc

**Stakeholder interests:**
- Giám đốc: muốn biết xe nào đang chờ/sửa
- Kế toán: cần phiếu đã duyệt để làm hồ sơ
- Kho: cần danh sách vật tư để chuẩn bị

---

## UC2 — Kho vật tư đi mua đồ (Đề nghị mua DM + Nhập kho)

- **Primary Actor**: `kho` (Kho vật tư)
- **Goal**: Mua vật tư thiếu và nhập kho để phục vụ sửa chữa
- **Preconditions**: Đã đăng nhập; có phiếu SC hoặc nhu cầu mua
- **Trigger**: Cần vật tư không có sẵn trong kho

**MSS:**
1. Kho xem phiếu SC cần vật tư (hoặc tự tạo nhu cầu)
2. Kho tạo Đề nghị mua (DM) cho vật tư thiếu + số lượng
3. Hệ thống tính tổng DM
4. Kho **duyệt** DM → `da_duyet`
5. Kho nhập hàng về → tạo phiếu nhập → tăng `vattu.ton`, cập nhật giá
6. Hệ thống ghi `activity_log`: "kho nhập X đơn vị Y"

**Extensions:**
- 2a. Vật tư chưa có trong danh mục → Kho thêm mới vật tư trước
- 4a. Từ chối DM → `tu_choi` + lý do
- 5a. Xuất kho cho SC → giảm `ton`; thiếu tồn → fail (không cho xuất âm)

**Stakeholder interests:**
- Trưởng xưởng: cần vật tư để bắt đầu sửa
- Kế toán: cần chứng từ nhập để hạch toán
- Giám đốc: theo dõi chi phí mua qua activity feed

---

## UC3 — Kế toán làm hồ sơ & quyết toán

- **Primary Actor**: `ketoan` (Kế toán)
- **Goal**: Hoàn thiện hồ sơ sửa chữa, ghi nhận chi phí, quyết toán
- **Preconditions**: Phiếu SC đã `da_hoan` (hoàn thành sửa)
- **Trigger**: Phiếu sửa xong, cần chốt hồ sơ

**MSS:**
1. Kế toán mở phiếu đã hoàn thành sửa
2. Hệ thống hiển thị công việc + vật tư + chi phí
3. Kế toán nhập **báo giá NCC** (`baogia`: NCC, items) — thuộc 8 bước hồ sơ
4. Kế toán nhập thông tin hồ sơ (số chứng từ, ngày, ghi chú)
5. Kế toán **quyết toán** → SC `da_quyet` + lưu `ho_so` + `baogia`
5. Hệ thống ghi `activity_log`: "ketoan quyết toán SC-X"

**Extensions:**
- 3a. Thiếu chứng từ → báo chờ bổ sung, giữ trạng thái `da_hoan`
- 2a. Phát hiện sai chi phí → Kế toán báo Trưởng xưởng điều chỉnh (trước khi quyết)

**Stakeholder interests:**
- Giám đốc: cần báo cáo chi phí chính xác
- Kho: đối soát vật tư xuất với hồ sơ

---

## UC4 — Giám đốc quan sát

- **Primary Actor**: `giamdoc` (Giám đốc)
- **Goal**: Xem toàn bộ hoạt động xưởng, KPI, báo cáo
- **Preconditions**: Đã đăng nhập
- **Trigger**: Mở bảng điều khiển

**MSS:**
1. Giám đốc mở bảng điều khiển (dashboard)
2. Hệ thống hiển thị KPI (số xe đang sửa, tổng chi phí tháng, vật tư tồn thấp)
3. Giám đốc xem **feed hoạt động** gần đây (ai, làm gì, khi nào, xe nào)
4. Giám đốc xem báo cáo theo khoảng thời gian

**Extensions:**
- 3a. Lọc feed theo vai trò / xe / ngày → hiển thị kết quả lọc

**Stakeholder interests:**
- Chính Giám đốc là người duy nhất cần quan sát tổng thể

---

## UC5 — Theo dõi toàn bộ hoạt động xưởng (Cross-cutting)

- **Áp dụng cho**: MỌI hành động ghi của UC1–UC4
- **MSS (ẩn):**
  1. Mỗi hành động ghi (tạo/duyệt/từ chối/nhập/xuất/quyết toán) → hệ thống tự ghi
     `activity_log` (actor, role, hành động, đối tượng, sc_id, timestamp)
  2. Giám đốc truy vấn feed → xem dòng thời gian hoạt động xưởng

**Extensions:**
- Truy vấn lỗi → trả rỗng, không crash

---

## Tóm tắt Entity xuất hiện

| Use Case | Entity liên quan |
|---|---|
| UC1 | xe, sc, sc_congviec, sc_vattu, vattu, activity_log |
| UC2 | dm, dm_chitiet, vattu, nhap_xuat, activity_log |
| UC3 | sc, ho_so, activity_log |
| UC4 | activity_log, sc, vattu (dashboard) |
| UC5 | activity_log (mọi UC) |
