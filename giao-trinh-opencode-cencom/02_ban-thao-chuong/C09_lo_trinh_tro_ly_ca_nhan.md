# Chương 9: Lộ trình trợ lý cá nhân cho từng Trưởng phòng

> **Mục tiêu học tập**
> - Mô tả persona AI Agent theo phòng ban (Kế toán / Kho / Xưởng / Sửa chữa-Cơ giới) — việc lặp, dữ liệu chính và Skill gợi ý.
> - Lập lộ trình 30-60-90 ngày cho phòng mình với kết quả đo được sau mỗi mốc.
> - Xác định 3 KPI đo hiệu quả và cách tích hợp lịch/email/nhắc việc an toàn.

---

## 1. Persona theo phòng ban — cùng OpenCode, khác việc giao

Không có trợ lý chung cho mọi phòng. Mỗi Trưởng phòng giao cho AI Agent việc lặp khác nhau, trên dữ liệu khác nhau, bằng Skill khác nhau.

| Phòng ban | 3 việc lặp giao cho AI Agent | Dữ liệu chính | Skill gợi ý |
|---|---|---|---|
| **Kế toán** | Đối chiếu công nợ; tổng hợp thu–chi tuần; nhắc thanh toán quá hạn | Sổ công nợ Excel, ERP | `cencom-doi-chieu-cong-no` |
| **Kho (VLXD)** | Soát nhập–xuất–tồn; cảnh báo tồn thấp/cận date; lập bảng chênh lệch | Phiếu nhập/xuất, tồn ERP | `cencom-soat-ton-kho` |
| **Xưởng** | Tổng hợp nhật ký QC206; báo cáo sự cố dừng máy; theo dõi bảo trì | Nhật ký ca, biên bản QC | `cencom-nhat-ky-qc206` |
| **SC – Cơ giới** | Theo dõi điều xe + nhiên liệu; nhắc đăng kiểm/bảo dưỡng; tổng hợp chi phí xe | Lịch điều xe, log GPS | `cencom-dieu-xe-nhien-lieu` |

**Ba quy tắc:** (1) Ghi rõ `description: "Use when Trưởng phòng Kho cần..."` trong `SKILL.md` — AI chỉ làm đúng 3 việc đó. (2) Chia `docs/memory/kho/*` khác `docs/memory/ke-toan/*` để tránh lộ chéo giá vốn, lương. (3) Thí điểm 1 phòng trước (Kho hoặc Kế toán), thắng rồi mới nhân rộng.

![H17](03_hinh-anh-minh-hoa/H17_persona_truong_phong.png)
*Hình H17 — Bốn persona trợ lý theo phòng ban: Kế toán, Kho, Xưởng, SC — cùng OpenCode, khác Skill và dữ liệu được phép đọc. Nguồn: thiết kế Cencom.*

## 2. Roadmap 30-60-90 ngày — từ làm quen tới trợ lý thực thụ

Mỗi 30 ngày chỉ thêm một lớp năng lực, có điểm kiểm tra trước khi lên nấc.

| Giai đoạn | Việc chính (2–3 giờ/tuần) | Kết quả đo được |
|---|---|---|
| **30 ngày — Làm quen** | Cài OpenCode, cấu hình `opencode.json` với `mimo-v2.5-free`; dùng model Free cho 3 task không mật: soạn email, tóm tắt họp, chỉnh lỗi báo cáo | 5 báo cáo/tuần qua AI, 0 vụ lộ dữ liệu mật |
| **60 ngày — Cá nhân hoá** | Tạo 1 Skill riêng (`cencom-bao-cao-tuan`), nạp 2 tài liệu vào `docs/memory`, học giọng văn và test A/B như Chương 8 | Giảm 30% thời gian soạn, Skill được duyệt |
| **90 ngày — Trợ lý thực thụ** | Giao trọn 1 quy trình khép kín: *soát tồn → lập bảng → gửi duyệt* hoặc *đối chiếu công nợ → nhắc thanh toán*, có giám sát | 1 quy trình chạy tự động hằng tuần, tỷ lệ sửa <15% |

Cuối mỗi 30 ngày họp 30 phút rà KPI rồi quyết định nâng Zen trả phí. Nếu sửa >30%, bổ sung ví dụ few-shot hoặc siết `docs/memory`.

## 3. Tích hợp lịch/email/nhắc việc — AI soạn, người duyệt mới gửi

Trợ lý chỉ có giá trị khi gắn vào lịch và email hằng ngày, nhưng theo **human-in-the-loop**: AI được *đọc* và *soạn nháp*, chỉ người mới được *gửi/ghi*.

1. **Lịch:** AI đọc lịch tuần, tóm tắt 3 việc chính mỗi sáng 08:00 và đề xuất khung giờ soạn báo cáo. Dùng Tool `calendar` hoặc file `lich-tuan.ics` trong `docs/memory`. Không tự tạo/xóa lịch khi chưa duyệt.
2. **Email:** AI soạn nháp và lưu vào `Nháp` — Trưởng phòng bấm *Gửi* sau khi kiểm số liệu. Không cấp quyền *auto-send* trong 90 ngày đầu. Email chứa giá vốn, hợp đồng phải dùng model trả phí có zero-retention, không qua Zen Free Tier.
3. **Nhắc việc:** Đặt lịch cố định: *"Thứ Hai 09:00 nhắc Kho chốt tồn, thứ Sáu 16:00 nhắc Kế toán gửi công nợ quá hạn 7 ngày."* Chỉ ping, không tự ghi sổ.

Cấu hình `calendar: {write:"approval"}`, `email: {send:"approval"}`. Khi AI báo *"Đã soạn xong email nhắc NCC HT, lưu ở Nháp — anh duyệt gửi?"*, chỉ cần trả lời *Duyệt* hoặc *Sửa dòng 2*.

## 4. KPI đo hiệu quả — chỉ 3 chỉ số, đo hằng tuần

Đo ít nhưng đo đều trên file `KPI_tro_ly_ca_nhan.xlsx`:

| KPI | Cách đo | Mục tiêu sau 90 ngày |
|---|---|---|
| **1. Thời gian / báo cáo (phút)** | Bấm giờ từ mở file thô tới bấm Gửi | Giảm 30–40% (60 → 40 phút) |
| **2. Tỷ lệ phải sửa** | Số báo cáo bị trả về / tổng số; lỗi số liệu = 0 dung sai | <15% bị trả về, 100% khớp nguồn |
| **3. Số báo cáo tự động + chi phí Zen** | Đếm báo cáo AI soạn nháp / tổng; theo dõi request/ngày | ≥50% qua AI, <180 request/ngày |

Tuần 1–4 chỉ đo KPI 1 và 2. Nếu tỷ lệ sửa cao → thiếu mẫu giọng văn, quay lại Chương 8. Tuần 5–12 thêm KPI 3: nếu tiệm cận 200 request/ngày → đề xuất nâng Zen Pay-as-you-go. Báo cáo 90 ngày gồm biểu đồ 3 KPI và 1 đoạn bài học.

![H18](03_hinh-anh-minh-hoa/H18_kpi_do_hieu_qua.png)
*Hình H18 — Dashboard 3 KPI: thời gian/báo cáo, tỷ lệ phải sửa và số báo cáo tự động — theo dõi hằng tuần, chốt báo cáo 90 ngày. Nguồn: template Cencom.*

---

## Tóm tắt chương

Mỗi phòng cần một persona riêng: Kế toán lo công nợ, Kho lo tồn, Xưởng lo QC206, SC lo điều xe — cùng OpenCode nhưng khác Skill và dữ liệu. Lộ trình 30-60-90 ngày đi từ *làm quen* → *cá nhân hoá* → *trợ lý thực thụ*. Lịch/email chỉ cho AI soạn nháp, người duyệt mới gửi. Hiệu quả đo bằng 3 KPI: phút/báo cáo, tỷ lệ phải sửa và số báo cáo tự động.

## Bài tập thực hành 5 phút

Liệt kê 3 việc lặp của phòng bạn tuần này sẽ giao cho AI Agent đầu tiên (theo bảng Mục 1), chọn 1 Skill sẽ tạo và điền 1 dòng vào bảng KPI tuần 1: *tên báo cáo — phút soạn hiện tại — mục tiêu phút sau 30 ngày*. Chụp bảng và gửi vào nhóm thí điểm để chốt persona trước khi sang Chương 10.
