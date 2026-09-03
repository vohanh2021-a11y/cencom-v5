# Chương 1: Xu thế AI Agent 2024–2026 — Từ chatbot tới đồng nghiệp số

> Năm 2023 ta hỏi chatbot để được trả lời. Từ 2024, AI trở thành đồng nghiệp số: được giao mục tiêu, tự lập kế hoạch và dùng công cụ để hoàn thành quy trình. Chương này giúp trưởng phòng Cencom chọn việc đầu tiên để giao cho Agent.

## Mục tiêu học tập

- **Phân biệt** Chatbot / Workflow / AI Agent bằng ví dụ Cencom (báo giá, điều xe, kiểm soát chất lượng).
- **Mô tả** 3 làn sóng Tool-use → Multi-agent → Autonomous và dấu mốc chính.
- **Chọn** 1 quy trình thí điểm của phòng mình để giao cho AI Agent và đo hiệu quả.

![H01](03_hinh-anh-minh-hoa/H01_xu_the_ai_agent_tong_quan.png)

## 1. Chatbot vs AI Agent — Khác nhau ở đâu?

**Chatbot** chỉ trả lời trong khung chat. Anh/chị hỏi — nó đáp một lượt rồi chờ tiếp. Nó không tự mở file, không gửi email, không nhớ việc tuần trước.

**Workflow** là đường ray cố định: nếu A thì B rồi C. Chạy nhanh, ít sai, nhưng gặp việc lạ ngoài kịch bản sẽ dừng.

**AI Agent (đồng nghiệp số)** được giao mục tiêu. Anh/chị nêu mục tiêu, ngữ cảnh và quyền dùng công cụ; Agent tự chia việc, lập kế hoạch nhiều bước, tự gọi công cụ như đọc file, tra tồn kho, gửi email và tự kiểm tra. Người chỉ giám sát và phê duyệt.

> Chatbot *trả lời*, Workflow *chạy theo kịch bản*, Agent *tự làm việc để đạt mục tiêu*.

| Tiêu chí | Chatbot | AI Agent (đồng nghiệp số) |
|---|---|---|
| Đầu vào | Một câu hỏi đơn lẻ | Mục tiêu + ngữ cảnh + quyền dùng công cụ |
| Cách làm | Trả lời một lượt, chờ hỏi tiếp | Tự chia việc, lập kế hoạch nhiều bước |
| Bộ nhớ | Ngắn, theo phiên chat | Dài hạn, nhớ dự án và tài liệu |
| Dùng công cụ | Không hoặc hạn chế | Chủ động dùng file, email, ERP, trình duyệt |
| Mức chủ động | Bị động, chờ lệnh | Chủ động đề xuất và thực thi |
| Ví dụ Cencom | “Viết email báo giá xi măng PCB40” | “Soát báo giá tháng 7, đối chiếu tồn kho, lập bảng chênh lệch và gửi kế toán duyệt trước 16h” |

## 2. Ba làn sóng phát triển

**Làn sóng 1 — Tool-use (2024): Biết dùng công cụ.** Mốc là Function Calling: AI lần đầu gọi API, đọc file, tìm web tin cậy. Microsoft đưa Copilot vào Word, Excel, Outlook.

**Làn sóng 2 — Multi-agent (2025): Làm việc theo đội.** Một agent quản lý chia việc cho các agent chuyên môn rồi tổng hợp. Giao thức MCP và A2A cho phép agent trao đổi như đồng nghiệp. Phù hợp việc phức hợp như lập hồ sơ thầu: một agent đọc hồ sơ, một agent bóc khối lượng, một agent tra giá, rồi tổng hợp dự toán.

**Làn sóng 3 — Autonomous (2025–2026): Tự chủ có kiểm soát.** Agent thao tác trực tiếp trên giao diện — bấm nút, điền form, vận hành cả phần mềm cũ không có API — đồng thời tự sửa lỗi và chạy 24/7. Thị trường enterprise agent vượt 5 tỷ USD năm 2024 và dự báo 10–13 tỷ USD cuối 2025.

![H02](03_hinh-anh-minh-hoa/H02_ba_lan_song_agent.png)

## 3. Doanh nghiệp đã áp dụng tới đâu?

- **McKinsey (gần 2.000 lãnh đạo, 105 nước):** 88% tổ chức đã dùng AI ở ít nhất một bộ phận (78% năm trước). 62% thử nghiệm Agent, 23% đã mở rộng ở một đến hai bộ phận. Chỉ 39% thấy tác động rõ tới lợi nhuận; nhóm hiệu quả cao (khoảng 6%) thắng nhờ thiết kế lại quy trình và đo KPI.
- **Stanford HAI Index 2026:** Đầu tư AI toàn cầu năm 2025 đạt 581,7 tỷ USD, tăng 130%. Generative AI đạt 53% dân số chỉ sau ba năm — nhanh hơn PC và Internet. Năng suất tăng: hỗ trợ khách hàng 14–15%, lập trình khoảng 26%, marketing tới 50%.
- **Microsoft WorkLab (31.000 lao động, 31 nước):** 82% lãnh đạo coi 2025 là năm bản lề; 81% dự kiến tích hợp agent trong 12–18 tháng và 46% đã tự động hóa trọn một quy trình. Khoảng cách nhận thức còn lớn: 67% lãnh đạo hiểu về agent so với 40% nhân viên.

## 4. Ba bài học từ ngành xi măng cho Cencom

**UNACEM (Peru) — Giảm 40% thời gian xe chờ.** Xe bồn tại nhà máy Lima thường chờ ba tiếng vì lịch xuất chưa khớp đơn. Agent qua WhatsApp tự tra đơn hàng, kiểm tra tồn kho và điều phối lịch xuất.

**Taiheiyo Cement (Nhật Bản) — Rút ngắn hơn 50% thời gian lập kế hoạch tàu.** Trước đây lập thủ công mất nhiều ngày. Từ 5/2025, AI của GRID tự tối ưu theo tồn kho, luật hàng hải và thời tiết, giúp giảm khoảng 10% nhiên liệu và rút ngắn hơn một nửa thời gian.

**Conch Group và Huawei Cloud (Trung Quốc) — 200 kịch bản nhà máy.** Sai lệch dự báo cường độ clinker dưới 1 MPa (chính xác trên 85%), giảm khoảng 1% than — tương đương hơn 4.500 tấn CO2 mỗi năm cho dây chuyền 5.000 tấn/ngày — và giám sát 28 tình huống thiết bị.

Bài học: chọn nút thắt đã có dữ liệu — điều xe, giao hàng hay kiểm soát chất lượng — cho agent chạy thử trọn một quy trình rồi đo trước và sau.

## Tóm tắt

- Chatbot trả lời một câu hỏi; Agent được giao mục tiêu và tự hoàn thành nhiều bước bằng công cụ, có bộ nhớ dài hạn.
- Ba làn sóng 2024–2026 là Tool-use, Multi-agent và Autonomous với mốc Function Calling, MCP/A2A và Computer-use.
- 88% tổ chức đã dùng AI, 46% đã tự động hóa trọn một quy trình; nhóm hiệu quả cao thắng nhờ thiết kế lại quy trình và đo KPI.
- Ba case xi măng cho thấy giá trị rõ nhất khi bắt đầu từ nút thắt có dữ liệu và đo được.

## Bài tập 5 phút

Viết một câu giao việc theo mẫu *Mục tiêu + Ngữ cảnh + Công cụ + Tiêu chí đạt*. Ví dụ: “Soát báo giá tháng 7 (file Excel Kinh doanh), đối chiếu tồn kho ERP, lập bảng chênh lệch và soạn email gửi kế toán duyệt trước 16h; tiêu chí đạt là bảng không sai số.”
