# Chương 3: Xu hướng làm việc cùng AI — Human-in-the-loop

> Giao việc cho AI như giao việc cho nhân viên mới: mục tiêu rõ, quyền hạn chặt, điểm kiểm tra đều thì kết quả mới đáng tin. Chương này cho khung làm việc cùng AI an toàn, dùng ngay cho báo cáo Cencom.

## Mục tiêu học tập

- **Mô tả** tiến trình Prompt → Workflow → AI Agent và chọn đúng mức tự động cho từng báo cáo.
- **Kể** 5 pattern (RAG, Memory, Tool, Planning, Reflection) bằng ví dụ Cencom.
- **Áp dụng** checklist 5 bước giao việc và checklist an toàn dữ liệu trước khi đưa thông tin cho AI.

![H05](03_hinh-anh-minh-hoa/H05_human_in_the_loop.png)

## 1. Từ prompt sang workflow sang agent

**Prompt** — một câu hỏi, một câu trả lời. Hợp việc ngắn, làm một lần: “Viết lại đoạn tồn kho 5 câu cho gọn, giữ nguyên số liệu”.

**Workflow** — gộp 3–5 prompt thành đường ray: *Soát Excel → Đối chiếu ERP → Lập bảng → Soạn email*. Người bấm chạy, AI chạy tuần tự, gặp ngoại lệ thì dừng.

**AI Agent** — giao mục tiêu, ngữ cảnh và quyền dùng công cụ; Agent tự lập kế hoạch, gọi công cụ và tự kiểm tra. Người giữ vai **Human-in-the-loop**: duyệt tại 2–3 điểm gác cổng.

| Tiêu chí | Prompt | Workflow | AI Agent |
|---|---|---|---|
| Đầu vào | Một câu hỏi | Chuỗi bước cố định | Mục tiêu + ngữ cảnh + quyền hạn |
| Cách chạy | Một lượt rồi dừng | Tuần tự theo kịch bản | Tự lập kế hoạch, tự sửa |
| Khi gặp việc lạ | Bịa hoặc sót | Dừng, báo lỗi | Đề xuất phương án, chờ duyệt |
| Vai người | Soạn lại từng lần | Bấm chạy, kiểm cuối | Duyệt tại điểm gác cổng |
| Ví dụ Cencom | “Tóm tắt biên bản 2 trang” | Workflow tồn kho tuần | “Soát tồn kho tháng 7, đối chiếu 3 nguồn, lập bảng gửi kế toán duyệt trước 16h” |

> Việc một lần → Prompt; việc lặp, bước cố định → Workflow; việc phức hợp cần tự quyết → Agent. Bắt đầu từ nấc thấp nhất đủ dùng.

![H06](03_hinh-anh-minh-hoa/H06_5_pattern_agent.png)

## 2. Năm pattern cốt lõi

| # | Pattern | Hiểu nôm na | Ví dụ Cencom | Dùng khi |
|---|---|---|---|---|
| 1 | **RAG** | Cho AI đọc tài liệu nội bộ trước khi trả lời | Mở `QC206.md` và file tồn kho rồi mới trích số | Báo cáo cần số liệu, quy chuẩn |
| 2 | **Memory** | AI nhớ quy trình, giọng văn | Nhớ “báo cáo Kho luôn 4 cột: Mã VLXD / Tồn đầu / Nhập / Tồn cuối” | Việc lặp tuần/tháng |
| 3 | **Tool** | AI tự dùng công cụ | Mở Excel, tra ERP, xuất bảng, soạn email | Cần thao tác ngoài chat |
| 4 | **Planning** | Chia việc lớn thành bước nhỏ | “Báo cáo giao hàng” → gom đơn → đối chiếu kho → tính chênh lệch → vẽ biểu đồ | Việc đa bước |
| 5 | **Reflection** | AI tự chấm bản nháp rồi sửa | Tự kiểm: thiếu nguồn? khớp 3 nguồn? câu quá dài? | Báo cáo trình lãnh đạo |

Trong OpenCode, 5 pattern được đóng gói trong **Skill**: RAG và Memory ở `docs/memory/`, Tool và Planning trong `SKILL.md`, Reflection là bước tự soát cuối. Chỉ cần chọn Skill, Agent tự gọi đúng pattern.

> Nhớ nhanh: **RAG** không bịa, **Memory** không quên, **Tool** không làm thủ công, **Planning** không rối, **Reflection** không sai.

## 3. Quy tắc giao việc — Checklist 5 bước

Khung **Mục tiêu + Ngữ cảnh + Công cụ + Ràng buộc + Tiêu chí đạt**.

| Bước | Câu hỏi gác cổng | Ví dụ (tồn kho tuần 30) |
|---|---|---|
| **1. Mục tiêu** | Giao nộp gì, cho ai, khi nào? | Lập bảng chênh lệch 28/07–03/08, gửi Kế toán trước 16h thứ Sáu |
| **2. Ngữ cảnh** | Dữ liệu ở đâu? | File `Kho_TonKho_Tuan30.xlsx` + ERP + mẫu 4 cột phòng Kho |
| **3. Công cụ & quyền hạn** | Được/không được làm gì? | Được đọc Excel/ERP, tạo bảng; KHÔNG gửi ra ngoài, KHÔNG sửa số gốc |
| **4. Ràng buộc** | Giữ gì tuyệt đối? | Giữ 100% số liệu, không làm tròn, ghi nguồn dưới bảng |
| **5. Tiêu chí đạt** | Thế nào là xong? | Khớp 3 nguồn, sai số 0; DỪNG để Trưởng phòng duyệt trước khi gửi |

**Mẫu câu giao việc:**

> “Lập bảng chênh lệch tồn kho tuần 30 (nguồn: Kho_TonKho_Tuan30.xlsx và ERP). Dùng mẫu 4 cột phòng Kho, giữ nguyên số liệu, ghi nguồn. Tạo nháp → DỪNG để tôi duyệt → mới gửi Kế toán trước 16h thứ Sáu. Tiêu chí đạt: khớp 3 nguồn, sai số 0.”

Đặt 2 điểm dừng bắt buộc: (1) duyệt nháp trước khi gửi/ghi, (2) duyệt bản cuối trước khi trình lãnh đạo.

## 4. An toàn dữ liệu

Phân loại trước khi dán vào model, nhất là **Zen Free Tier** (không cam kết lưu trữ).

| Cấp độ | Ví dụ Cencom | Đưa vào Free? | Cách làm |
|---|---|---|---|
| **Xanh — Công khai** | Báo giá niêm yết, QC206 | Được | Dùng trực tiếp |
| **Vàng — Nội bộ** | Báo cáo tuần, tồn kho | Được nếu đã ẩn danh | Xóa tên khách, giá vốn trước khi dán |
| **Đỏ — Nhạy cảm** | Lương, hợp đồng, số TK, CCCD | **KHÔNG** | Chỉ local hoặc Zen trả phí; để AI viết khung, điền tay phần đỏ |

**Checklist 5 điểm:**

- [ ] **1. Phân loại:** Xanh / Vàng / Đỏ — Đỏ thì dừng.
- [ ] **2. Ẩn danh:** Xóa tên khách, số TK, giá nhạy cảm.
- [ ] **3. Thu gọn:** Chỉ đưa 1–2 trang cần thiết.
- [ ] **4. Ghi nguồn & giữ số:** Yêu cầu AI ghi “Nguồn: file X” và giữ nguyên số liệu.
- [ ] **5. Duyệt trước khi gửi:** Mọi bảng/email do AI soạn phải qua người duyệt.

> Quy ước Cencom: khi nghi ngờ, chọn mức an toàn cao hơn. Dữ liệu Đỏ không bao giờ vào model Free.

## Tóm tắt

- Ba nấc Prompt → Workflow → Agent tăng dần tự động; chọn nấc thấp nhất đủ dùng và giữ Human-in-the-loop tại điểm duyệt.
- Năm pattern RAG/Memory/Tool/Planning/Reflection giải bài toán bịa số liệu, quên quy trình, làm thủ công, rối bước và sai sót.
- Giao việc chuẩn cần 5 bước Mục tiêu – Ngữ cảnh – Công cụ & quyền hạn – Ràng buộc – Tiêu chí đạt, kèm 2 điểm dừng bắt buộc.
- An toàn chia Xanh/Vàng/Đỏ; Đỏ không đưa vào Free, Vàng phải ẩn danh, mọi kết quả ghi nguồn và được duyệt.

## Bài tập 5 phút

Viết một câu giao việc cho báo cáo tồn kho tuần theo mẫu **Mục tiêu + Ngữ cảnh + Công cụ + Ràng buộc + Tiêu chí đạt**.

*Khung điền:* “Mục tiêu: … | Ngữ cảnh: file … + ERP … | Công cụ: được … / không được … | Ràng buộc: giữ … | Tiêu chí đạt: … | Dừng duyệt tại: (1) … (2) …”

*Ví dụ đạt:* “Lập bảng chênh lệch tồn kho tuần 30 từ Kho_TonKho_Tuan30.xlsx và ERP, theo mẫu 4 cột phòng Kho; được đọc file/tạo bảng, không gửi ngoài; giữ nguyên số liệu, ghi nguồn; DỪNG duyệt nháp rồi mới gửi Kế toán trước 16h — khớp 3 nguồn, sai số 0.”
