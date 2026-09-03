# Xu hướng AI Agent 2024–2026 — Nghiên cứu phục vụ Chương 1

> Tài liệu nghiên cứu thô cho Chương 1 giáo trình OpenCode — Đối tượng: Trưởng phòng Cencom VLXD Miền Trung (không chuyên IT).

---

## 1. Định nghĩa: AI Agent vs Chatbot vs Workflow

- **Chatbot:** Bạn hỏi — nó đáp trong khung chat, không tự làm gì thêm.
- **Workflow:** Chuỗi bước cố định do người lập sẵn (*nếu A thì B rồi C*). Gặp việc lạ sẽ dừng.
- **AI Agent (đồng nghiệp số):** Được giao *mục tiêu*, tự lập kế hoạch, tự chọn công cụ (đọc file, gọi API, duyệt web, gửi email), làm nhiều bước và tự kiểm tra. Con người chỉ giám sát.

> Chatbot *trả lời*, Workflow *chạy theo kịch bản*, Agent *tự làm việc để đạt mục tiêu*.

### Bảng so sánh Chatbot vs AI Agent

| Tiêu chí | Chatbot | AI Agent |
|---|---|---|
| Đầu vào | Câu hỏi đơn lẻ | Mục tiêu + ngữ cảnh + quyền dùng công cụ |
| Cách làm | Trả lời 1 lượt, chờ hỏi tiếp | Tự chia việc, lập kế hoạch nhiều bước |
| Bộ nhớ | Ngắn, theo phiên chat | Dài hạn: nhớ dự án, tài liệu |
| Dùng công cụ | Không hoặc hạn chế | Chủ động dùng file, email, ERP, trình duyệt |
| Mức chủ động | Bị động | Chủ động, tự đề xuất và thực thi |
| Ví dụ | “Viết email báo giá xi măng” | “Soát báo giá tháng 7, đối chiếu tồn kho, lập bảng chênh lệch và gửi kế toán duyệt” |

Workflow là “đường ray” cố định; Agent là “tài xế” biết chọn đường và đổi hướng khi gặp chướng ngại.

---

## 2. Ba làn sóng phát triển (2024 → 2026)

**Làn sóng 1 — Tool-use (2024): Biết dùng công cụ.** Agent học cách gọi API, đọc file, tìm web. Function Calling của OpenAI/Anthropic và Microsoft Copilot đặt móng.

**Làn sóng 2 — Multi-agent (2025): Làm việc theo đội.** Một agent quản lý chia việc cho các agent chuyên môn rồi tổng hợp. McKinsey gọi là “virtual coworkers” qua giao thức MCP/A2A. Phù hợp quy trình phức hợp như lập hồ sơ thầu.

**Làn sóng 3 — Autonomous (2025–2026): Tự chủ có kiểm soát.** Agent thao tác trực tiếp trên giao diện máy tính như người (click, điền form, vận hành phần mềm cũ không có API), tự phản chiếu và sửa lỗi, chạy 24/7. CB Insights ước thị trường enterprise agent vượt 5 tỷ USD năm 2024 và sẽ đạt 10–13 tỷ USD cuối 2025.

---

## 3. Doanh nghiệp đã áp dụng tới đâu? Số liệu 2025–2026

| Nguồn | Phát hiện chính |
|---|---|
| **McKinsey State of AI 2025** (1.993 lãnh đạo, 105 nước) | 88% tổ chức đã dùng AI ở ít nhất một bộ phận (78% năm 2024). 62% thử nghiệm Agent, 23% đã mở rộng ở 1–2 bộ phận. Chỉ 39% ghi nhận tác động lợi nhuận; 64% nói AI giúp đổi mới tốt hơn. |
| **Stanford HAI AI Index 2026** | Đầu tư AI toàn cầu 2025 đạt 581,7 tỷ USD (+130%). Generative AI đạt ~53% dân số dùng trong 3 năm — nhanh hơn PC và Internet. Năng suất dễ đo: hỗ trợ khách hàng +14–15%, lập trình +26%, marketing +50%. |
| **Microsoft WorkLab 2025** (31.000 lao động, 31 nước) | 82% lãnh đạo coi 2025 là năm bản lề; 81% dự kiến tích hợp agent trong 12–18 tháng; 46% đã dùng agent tự động hoá trọn một quy trình. 67% lãnh đạo hiểu rõ agent so với 40% nhân viên. |
| **a16z & CB Insights** | Ngân sách AI chuyển từ “thử nghiệm” sang chi thường xuyên. Doanh nghiệp chuộng mua ứng dụng đóng gói; workflow agent làm tăng chi phí chuyển đổi do cần tinh chỉnh nhiều bước. |

Nhóm “high performers” (6% theo McKinsey) khác biệt ở chỗ thiết kế lại quy trình, đo KPI rõ ràng và đào tạo lại nhân sự.

---

## 4. Ba case study ngành VLXD / sản xuất

**1. UNACEM (Peru, tập đoàn xi măng 5 nước) + IBM watsonx Orchestrate.** Xe bồn chờ 3 giờ tại cổng nhà máy Lima. Agent logistics qua WhatsApp tự tra đơn hàng và điều phối lịch xuất. Kết quả: giảm **40% thời gian chờ**, tăng số chuyến/ngày, sau đó nhân rộng sang helpdesk và mua sắm.

**2. Taiheiyo Cement (Nhật Bản) + GRID — AI điều tàu chở xi măng.** Có tới 10^1400 phương án phân bổ tàu, trước đây lập thủ công. AI tối ưu dựa trên tồn kho, luật hàng hải và thời tiết. Từ 05/2025: giảm **~10% nhiên liệu**, **rút ngắn >50% thời gian lập kế hoạch**.

**3. Conch Group + Huawei Cloud (Trung Quốc).** Mô hình AI ngành xi măng đầu tiên phủ 200+ kịch bản. Kết quả: dự báo cường độ clinker sai số <1 MPa (>85% chính xác), giảm **~1% than tiêu chuẩn** (dây chuyền 5.000 TPD giảm >4.500 tấn CO2/năm), giám sát 28 tình huống thiết bị theo thời gian thực.

> Gợi ý cho Cencom: Chọn một nút thắt có sẵn dữ liệu (điều xe, giao hàng, kiểm soát chất lượng), cho agent chạy thử trọn một quy trình, đo trước–sau rồi mới nhân rộng.

---

## 5. Nguồn tham khảo

1. McKinsey — *The State of AI in 2025* — https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai
2. Stanford HAI — *AI Index 2026* — https://hai.stanford.edu/ai-index/2026-ai-index-report ; Chapter 4 Economy — https://hai.stanford.edu/assets/files/ai_index_report_2026_chapter_4_economy.pdf
3. Stanford HAI — *12 Takeaways 2026* — https://hai.stanford.edu/news/inside-the-ai-index-12-takeaways-from-the-2026-report
4. Microsoft WorkLab — *2025 Work Trend Index: Frontier Firm* — https://www.microsoft.com/en-us/worklab/work-trend-index/2025-the-year-the-frontier-firm-is-born
5. a16z — *Owning the Workflow* — https://a16z.com/owning-the-workflow-in-b2b-ai-apps/ ; *How 100 CIOs Buying Gen AI 2025* — https://a16z.com/ai-enterprise-2025/
6. CB Insights — *Enterprise AI agents $5B+ to $13B* — https://www.cbinsights.com/research/enterprise-ai-agents-market-size/
7. IBM — *UNACEM with agentic AI* — https://www.ibm.com/new/product-blog/how-an-industrial-powerhouse-unacem-modernized-operations-with-agentic-ai
8. Taiheiyo Cement & GRID — *AI Ship Allocation* (PDF) — https://www.taiheiyo-cement.co.jp/english/summary/pdf/250804_2.pdf
9. Huawei — *Conch AI Model for Cement* — https://e.huawei.com/en/news/2025/industries/oil-gas/innovative-ai-model-cement-industry
