# So sánh Model AI 2025–2026 — Chọn model nào cho báo cáo Cencom?

> **Nhóm nghiên cứu:** R2 · **Ngày:** 22/08/2026 · **Phạm vi:** 03/2025–08/2025 · **Đối tượng:** Trưởng phòng Cencom VLXD Miền Trung

Báo cáo tuần/tháng của Cencom cần tiếng Việt chuẩn, giữ đúng số liệu và chi phí hợp lý khi chạy qua OpenCode Zen. Tài liệu tóm tắt 6 họ model mới nhất để lãnh đạo chọn nhanh theo ngân sách.

---

## 1. Tổng quan 6 họ model — mỗi model 4 dòng

### 1) GPT-5 / GPT-5 mini (OpenAI — 08/2025)
**Điểm mạnh:** Flagship reasoning, chỉnh mức suy luận minimal/low/medium/high và gọi chuỗi tool dài, hợp báo cáo tổng hợp. **Tiếng Việt:** Rất tốt, văn phong hành chính gọn, giữ thuật ngữ VLXD khi có few-shot. **Context:** 400K (input tối đa 272K, output 128K), đủ 2–3 báo cáo tháng. **Giá:** GPT-5 1,25/10 USD, mini 0,25/2 USD/1M token, cache 0,025 USD.

### 2) Claude 4 Sonnet / Opus (Anthropic — 05/2025)
**Điểm mạnh:** Hybrid — trả lời nhanh hoặc thinking mở rộng 64K; Opus top coding/nhiệm vụ dài, Sonnet cân bằng tốc độ–chi phí. **Tiếng Việt:** Xuất sắc, Sonnet mạch lạc, Opus giữ 5+ ràng buộc cùng lúc. **Context:** 200K chuẩn, bản 4.6+ lên 1M cùng giá. **Giá:** Sonnet 3/15 USD, Opus 15/75 USD/1M, batch giảm 50%.

### 3) Gemini 2.5 Pro / Flash (Google — 03–06/2025)
**Điểm mạnh:** Hybrid đa phương thức (text/ảnh/audio/video/PDF/codebase), Pro suy luận sâu, Flash tối ưu Pareto. **Tiếng Việt:** Tốt, Pro ít lặp ý, Flash dịch/phân loại nhanh. **Context:** 1M cho cả hai (Flash 65K output, Pro 64K), nạp được video 3 giờ. **Giá:** Pro 1,25 (>200K 2,50)/10–15 USD, Flash 0,30/2,50 USD, cache 0,03 USD.

### 4) Grok-4 (xAI — 07/2025)
**Điểm mạnh:** RL quy mô lớn trên 200K GPU, gọi tool và tìm kiếm native, bản Heavy chạy đa agent đối chiếu. **Tiếng Việt:** Khá, cần hiệu đính thuật ngữ VLXD. **Context:** 256K (bản 4.3/4.6 lên 500K–1M), output 8K. **Giá:** Grok-4 3/15 USD (cache 0,75), Grok 4.3 chỉ 1,25/2,50 USD.

### 5) Qwen3 235B-A22B (Alibaba — 04/2025)
**Điểm mạnh:** MoE 235B (22B active/token), chuyển mượt thinking/non-thinking, hỗ trợ 100+ ngôn ngữ, gọi hàm agent. **Tiếng Việt:** Tốt, ổn định song ngữ Việt–Anh. **Context:** 131K mặc định, YaRN lên 262K, output 16K. **Giá:** Alibaba 0,70/2,80 USD, qua OpenRouter/DeepInfra 0,18–0,455 USD.

### 6) Llama 4 Scout / Maverick (Meta — 04/2025)
**Điểm mạnh:** MoE đa phương thức mở, Scout chạy 1 GPU H100, Maverick cân bằng chất lượng–giá, chưng cất từ Behemoth 288B. **Tiếng Việt:** Có hỗ trợ chính thức (12 ngôn ngữ), cần prompt mẫu. **Context:** Scout 10M (kỷ lục), Maverick 1M. **Giá:** Mở trọng số — tự host miễn phí, API bên thứ ba 0,19–0,49 USD blended.

---

## 2. Bảng so sánh nhanh

| Model | Context | Tiếng Việt | Giá input/output (USD/1M) | Reasoning | Phù hợp báo cáo Cencom |
|---|---|---|---|---|---|
| GPT-5 | 400K | Rất tốt | 1,25 / 10 | Cao, 4 mức | Báo cáo tháng tổng hợp |
| GPT-5 mini | 400K | Rất tốt | 0,25 / 2 | Khá cao | Báo cáo tuần số lượng lớn |
| Claude 4 Sonnet | 200K (1M) | Xuất sắc | 3 / 15 | Cao, hybrid | Mặc định mọi báo cáo |
| Claude 4 Opus | 200K (1M) | Xuất sắc | 15 / 75 | Rất cao | Báo cáo lãnh đạo, soát cuối |
| Gemini 2.5 Pro | 1M | Tốt | 1,25–2,50 / 10–15 | Rất cao | Báo cáo dài kèm ảnh/bản vẽ |
| Gemini 2.5 Flash | 1M | Tốt | 0,30 / 2,50 | Khá cao | Báo cáo tuần, RAG nhanh |
| Grok-4 | 256K (1M) | Khá | 3 / 15 (4.3: 1,25/2,50) | Rất cao | Nghiên cứu thị trường |
| Qwen3 235B-A22B | 131K (262K) | Tốt | 0,70 / 2,80 | Khá cao | Tiết kiệm, On-Premise |
| Llama 4 Maverick/Scout | 1M / 10M | Khá | 0,19–0,49 (mở) | Khá | Kho tài liệu khổng lồ |

> Giá niêm yết 07–08/2026; cache/batch có thể giảm 50–80%.

---

## 3. Khuyến nghị 3 tier cho Cencom

### Tier 1 — Tiết kiệm (báo cáo tuần)
**GPT-5 mini + Gemini 2.5 Flash + Qwen3** (hoặc Llama 4 nếu tự host). Chỉ 0,25–0,70 USD/1M, context 400K–1M, đủ báo cáo 5–10 trang. Dùng khi cần nhanh, ít suy luận sâu. Mẹo Zen: cache prompt mẫu, dùng batch 20–30 báo cáo giảm 50%.

### Tier 2 — Cân bằng (khuyên dùng)
**Claude 4 Sonnet + Gemini 2.5 Pro + GPT-5**. Tối ưu 80% nhu cầu: tiếng Việt xuất sắc, reasoning ổn, giá vừa (Sonnet 3/15, Pro 1,25/10). Dùng cho báo cáo tháng gửi ban giám đốc. Định tuyến 80% qua Sonnet/Flash, 20% ca khó lên Pro/GPT-5.

### Tier 3 — Chất lượng cao (trình lãnh đạo)
**Claude 4 Opus + GPT-5 high + Grok-4 Heavy**. Dành cho báo cáo chiến lược, tổng kết quý, hồ sơ thầu — nơi sai một chi tiết là rủi ro. Opus giữ 5+ ràng buộc, Grok Heavy đối chiếu đa agent. Giá cao (15/75) nên dùng chọn lọc, bật extended thinking.

**Triển khai:** Tạo 3 skill `cencom-bao-cao-tiet-kiem` / `can-bang` / `cao-cap` để trưởng phòng chỉ chọn tier.

---

## 4. Nguồn

* OpenAI — GPT-5 docs & pricing (08/2025): 1,25/10 USD, mini 0,25/2 USD, 400K.
* Anthropic — Claude 4 announcement (22/05/2025) & Pricing (08/2026): Sonnet 3/15, Opus 15/75, 200K (1M từ 4.6).
* Google — Gemini 2.5 blog & API pricing (06–08/2026): Pro 1,25–2,50/10–15, Flash 0,30/2,50, 1M.
* xAI — Developer pricing & AI-TLDR Grok-4 (07/2025): 3/15 USD, 256K; 4.3 là 1,25/2,50, 1M.
* Alibaba Cloud & OpenRouter — Qwen3 235B-A22B (04/2025): 0,70/2,80, 131K–262K, 100+ ngôn ngữ.
* Meta — Llama 4 blog & Model Card (05/04/2025): Scout 10M, Maverick 1M, 17B active.

> Giá/context trích trang chính thức 07–08/2026; kiểm tra lại trước khi duyệt ngân sách.
