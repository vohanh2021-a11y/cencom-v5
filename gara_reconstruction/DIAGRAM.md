# DIAGRAM — Mối công việc, Quan hệ vai trò & Ma trận quyền (v5.0)

> Cập nhật theo yêu cầu: **Giám đốc = quyền kiểm tra (xem mọi thứ)**;
> **Admin = quản trị mạng (xem + test-create lưu 1 ngày)**.

---

## 1. BIỂU ĐỒ MỐI CÔNG VIỆC (Work Flow)

```
                    ┌─────────────┐
                    │   XE VÀO    │
                    └──────┬──────┘
                           │ (xuong tiếp nhận)
                           ▼
                  ┌────────────────┐
   ┌───────────▶ │  SC (de_xuat)  │ ◀────────────┐
   │             │  + CV / VT     │              │
   │             └───────┬────────┘              │
   │                     │ thiếu VT?             │ vật tư
   │                     ▼                       │ cần?
   │            ┌────────────────┐               │
   │            │ [KHO] DM +     │───────────────┘
   │            ....................              │
   │            └───────┬────────┘
   │                    │ (xuong)
   │                    ▼
   │           ┌────────────────┐
   │           │ SC dang_sua    │
   │           └───────┬────────┘
   │                   ▼
   │           ┌────────────────┐
   │           │ SC da_hoan     │
   │           └───────┬────────┘
   │                   │ (ketoan)
   │     ┌─────────────┼──────────────┐
   │     ▼             ▼              ▼
   │ ┌────────┐  ┌──────────┐  ┌──────────┐
   └─│baogia  │  │ ho_so    │  │scQuyetToan│
     │(8 bước)│  │(kế toán) │  │→da_quyet │
     └───┬────┘  └────┬─────┘  └────┬─────┘
         │            │             │
         └────────────┼─────────────┘
                      ▼
              ┌─────────────────────┐
              │  activity_log       │ ──▶ [GIÁM ĐỐC] xem MỌI THỨ
              │  (mọi hành động)    │      dashboard + feed + report
              └─────────────────────┘
                      │
                      └──▶ [ADMIN] xem (đánh giá) + test-create (lưu 1 ngày)
```

**Chú thích**: Giám đốc là điểm cuối QUAN SÁT (read-all). Admin cũng có thể xem để
đánh giá hệ thống, và được phép lập dữ liệu MỚI để test (đánh dấu `is_test=1`,
tự xoá sau 1 ngày).

---

## 2. BIỂU ĐỒ QUAN HỆ GIỮA CÁC VAI TRÒ (Role Relationships)

```
                    ┌──────────────┐
                    │   ADMIN      │  QUẢN TRỊ MẠNG
                    │ (xem + test  │  chỉ đảm bảo hệ thống chạy
                    │  1 ngày)     │
                    └──────┬───────┘
                           │ cấp tài khoản 4 vai (setup)
                           ▼
        ┌──────────────────────────────────────────┐
        │              HỆ THỐNG GARA               │
        └──────┬───────────────┬──────────┬────────┘
               │               │          │
               ▼               ▼          ▼
          ┌─────────┐    ┌──────────┐  ┌──────────┐
          │GIÁM ĐỐC │    │TRƯỞNG XƯỞNG│ │ KẾ TOÁN │
          │XEM MỌI  │    │(lập/sửa) │  │ (hồ sơ)  │
          │THỨ      │    └────┬─────┘  └────┬─────┘
          │(kiểm tra)│         │ yêu cầu VT  │ quyết toán
          └────┬────┘         ▼             ▲
               │ xem toàn bộ  ┌──────────┐  │
               └─────────────▶│ KHO VT   │──┘
                              │(mua/nhập)│
                              └──────────┘
```

**Mô tả quan hệ**:
- `admin` → chỉ setup user + đảm bảo hạ tầng; **KHÔNG** giữ quyền nghiệp vụ.
- `giamdoc` → **QUYỀN KIỂM TRA**: xem mọi thứ (tất cả module, mọi vai) để giám sát.
- `xuong` → tạo/quản lý SC, yêu cầu Kho mua VT.
- `kho` → đáp ứng VT, nhập/xuất.
- `ketoan` → đóng hồ sơ (baogia + ho_so + quyết toán).
- Vòng lặp: Xưởng ↔ Kho ↔ Kế toán (nghiệp vụ) → tất cả → Giám đốc (kiểm tra).

---

## 3. MA TRẬN QUYỀN (Permission Matrix) — v3

| Chức năng | giamdoc | admin | xuong | ketoan | kho |
|---|:---:|:---:|:---:|:---:|:---:|
| **Xem xe** | ✅ mọi | ✅ | ✅ | ✅ | ✅ |
| **Tạo xe** | ❌ | ✅*test | ❌ | ❌ | ❌ |
| **Xem SC (mọi trạng thái)** | ✅ mọi | ✅ | ❌ | ✅ | ✅ |
| **Tạo/quản lý SC** | ❌ | ✅*test | ✅ | ❌ | ❌ |
| **Xem vật tư** | ✅ mọi | ✅ | ✅ | ✅ | ✅ |
| **Tạo/sửa vật tư** | ❌ | ✅*test | ❌ | ❌ | ✅ |
| **Nhập/Xuất kho** | ❌ | ✅*test | ❌ | ❌ | ✅ |
| **DM tạo/nhập** | ❌ | ✅*test | ❌ | ❌ | ✅ |
| **Xem báo giá** | ✅ mọi | ✅ | ✅ | ✅ (q.ly) | ✅ |
| **Tạo/sửa báo giá** | ❌ | ✅*test | ❌ | ✅ | ❌ |
| **Xem hồ sơ** | ✅ mọi | ✅ | ✅ | ✅ (q.ly) | ✅ |
| **Tạo/sửa hồ sơ + quyết toán** | ❌ | ✅*test | ❌ | ✅ | ❌ |
| **Dashboard quan sát** | ✅ | ✅ | ✅*xưởng | ❌ | ❌ |
| **Activity Feed (toàn bộ)** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Report chi phí** | ✅ | ✅ | ❌ | ❌ | ❌ |

**Chú thích**:
- ✅*test = admin tạo ở **chế độ TEST** (`is_test=1`), dữ liệu **tự xoá sau 1 ngày** (soft-delete qua cron). Dùng để admin kiểm thử hệ thống, KHÔNG phải nghiệp vụ thật.
- `giamdoc` là **QUYỀN KIỂM TRA** duy nhất có xem mọi thứ (bao gồm Activity Feed toàn bộ hệ thống).
- `admin` XEM để đánh giá; tạo chỉ để test (1 ngày). **Admin KHÔNG nắm quyền nghiệp vụ.**
- 4 vai nghiệp vụ (xuong/ketoan/kho) + giamdoc = quyền chính; admin = hỗ trợ kỹ thuật.

---

## 4. TÓM TẮT HIỂU BIẾT

| Yêu cầu | Phản ánh ở đâu |
|---|---|
| Giám đốc xem mọi thứ (quyền kiểm tra) | Ma trận: giamdoc ✅ mọi cột XEM; Activity Feed độc quyền |
| Admin chỉ xem + test 1 ngày | Ma trận: admin ✅ xem + ✅*test; SCHEMA `is_test` + chính sách tự huỷ |
| Quyền chính ở Giám đốc | giamdoc giữ oversight; admin bị tước quyền nghiệp vụ |
| 4 vai nghiệp vụ | xuong/ketoan/kho giữ quyền ghi module mình |
| Theo dõi toàn bộ | activity_log → giamdoc |
| Giữ báo giá | baogia (ketoan quản lý, giamdoc xem) |
