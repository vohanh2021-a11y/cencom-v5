# Chương 2: Bản đồ Model AI mới nhất — Chọn model nào cho báo cáo?

> Báo cáo Cencom cần tiếng Việt chuẩn, giữ đúng số liệu và chi phí hợp lý. Chương này cho anh/chị bản đồ 6 họ model mới nhất (08/2026) và cách chọn nhanh theo ngân sách.

## Mục tiêu học tập

- **So sánh** 6 họ model (GPT-5, Claude 4, Gemini 2.5, Grok-4, Qwen3, Llama 4) theo tiếng Việt, context, suy luận và giá.
- **Chọn** đúng tier Tiết kiệm / Cân bằng / Chất lượng cao cho từng loại báo cáo tuần, tháng, trình lãnh đạo.
- **Ước tính** chi phí token cho một báo cáo và áp dụng mẹo tiết kiệm qua OpenCode Zen.

![H03](03_hinh-anh-minh-hoa/H03_ban_do_model_ai.png)

## 1. Bốn tiêu chí chọn model cho báo cáo

**Tiếng Việt hành chính.** Câu ngắn, số liệu dày, thuật ngữ VLXD cố định (PCB30/40, mác bê tông, ca máy). Model phải giữ đúng con số, không làm tròn. GPT-5 và Claude 4 giữ văn phong công văn tốt nhất; Gemini 2.5 ít lặp ý; Grok-4, Qwen3, Llama 4 cần 2–3 đoạn mẫu để ổn định thuật ngữ.

**Giá trên 1 triệu token.** 1.000 từ tiếng Việt ≈ 1.500 token. Báo cáo tuần 8–10 trang ≈ 6.000–8.000 token đầu vào. GPT-5 mini 0,25/2 USD rẻ gấp 5 lần GPT-5; Claude Opus 15/75 USD đắt gấp 60 lần — chỉ dùng cho báo cáo trình Ban Giám đốc.

**Context — AI nhớ được bao nhiêu.** Báo cáo tuần cần 30–50 trang (~40K token); báo cáo tháng kèm phụ lục, ảnh cần 200K–1M. Vượt context, AI quên phần đầu và bịa số liệu. Gemini 2.5 và Llama 4 cho 1M–10M; GPT-5 400K đủ 2–3 báo cáo tháng; Claude 4 chuẩn 200K, bản 1M cùng giá.

**Khả năng suy luận.** Báo cáo sao chép số liệu chỉ cần suy luận thấp; báo cáo tổng hợp cần đối chiếu 3 nguồn (bán hàng, kho, kế toán) và giải thích chênh lệch — cần model suy luận cao. GPT-5 chỉnh 4 mức; Claude 4 có thinking 64K; Gemini Pro và Grok Heavy đối chiếu đa agent.

> Chỉ cần viết lại cho gọn — chọn model rẻ. Cần đối chiếu và kết luận — chọn model suy luận cao.

## 2. So sánh 6 họ model mới nhất

**GPT-5 / GPT-5 mini (OpenAI, 08/2025).** Suy luận flagship, chỉnh 4 mức và gọi chuỗi tool dài. Tiếng Việt rất tốt. Context 400K (input 272K, output 128K). Giá 1,25/10 USD; mini 0,25/2 USD, cache 0,025 USD.

**Claude 4 Sonnet / Opus (Anthropic, 05/2025).** Hybrid: trả lời nhanh hoặc thinking 64K. Sonnet cân bằng, mặc định cho 80% báo cáo Cencom; Opus giữ 5+ ràng buộc cùng lúc. Tiếng Việt xuất sắc. Context 200K (1M từ bản 4.6). Giá Sonnet 3/15, Opus 15/75 USD.

**Gemini 2.5 Pro / Flash (Google, 03–06/2025).** Đa phương thức (text/ảnh/video/PDF). Pro suy luận sâu, Flash tối ưu tốc độ–giá. Context 1M cho cả hai. Giá Pro 1,25 (>200K là 2,50)/10–15 USD, Flash 0,30/2,50 USD.

**Grok-4 (xAI, 07/2025).** RL 200K GPU, tìm kiếm native; bản Heavy chạy đa agent đối chiếu. Tiếng Việt khá. Context 256K (4.3 lên 1M). Giá 3/15 USD, bản 4.3 chỉ 1,25/2,50 USD.

**Qwen3 235B-A22B (Alibaba, 04/2025).** MoE 235B (22B hoạt động/token), 100+ ngôn ngữ. Tiếng Việt tốt, song ngữ ổn định. Context 131K (YaRN 262K). Giá 0,70/2,80 USD, qua OpenRouter chỉ 0,18–0,455 USD.

**Llama 4 Scout / Maverick (Meta, 04/2025).** Mô hình mở. Scout chạy 1 GPU H100, context 10M kỷ lục; Maverick 1M. Tiếng Việt có hỗ trợ nhưng cần prompt mẫu. Tự host miễn phí, API 0,19–0,49 USD.

![H04](03_hinh-anh-minh-hoa/H04_bang_so_sanh_model.png)

## 3. Bảng khuyến nghị 7 cột — 9 dòng model

Giá 07–08/2026; cache/batch giảm 50–80%.

| Model | Context | Tiếng Việt | Giá input/output (USD/1M) | Suy luận | Phù hợp báo cáo Cencom | Tier gợi ý |
|---|---|---|---|---|---|---|
| GPT-5 | 400K | Rất tốt | 1,25 / 10 | Cao (4 mức) | Báo cáo tháng tổng hợp | 2 — Cân bằng |
| GPT-5 mini | 400K | Rất tốt | 0,25 / 2 | Khá cao | Báo cáo tuần số lượng lớn | 1 — Tiết kiệm |
| Claude 4 Sonnet | 200K (1M) | Xuất sắc | 3 / 15 | Cao, hybrid | Mặc định mọi báo cáo | 2 — Cân bằng |
| Claude 4 Opus | 200K (1M) | Xuất sắc | 15 / 75 | Rất cao | Trình lãnh đạo, soát cuối | 3 — Chất lượng |
| Gemini 2.5 Pro | 1M | Tốt | 1,25–2,50 / 10–15 | Rất cao | Báo cáo dài kèm ảnh/bản vẽ | 2 — Cân bằng |
| Gemini 2.5 Flash | 1M | Tốt | 0,30 / 2,50 | Khá cao | Báo cáo tuần, RAG nhanh | 1 — Tiết kiệm |
| Grok-4 | 256K (1M) | Khá | 3 / 15 (4.3: 1,25/2,50) | Rất cao | Nghiên cứu thị trường | 3 — Chất lượng |
| Qwen3 235B-A22B | 131K (262K) | Tốt | 0,70 / 2,80 | Khá cao | Tiết kiệm, On-Premise | 1 — Tiết kiệm |
| Llama 4 Maverick/Scout | 1M / 10M | Khá | 0,19–0,49 (mở) | Khá | Kho tài liệu khổng lồ | 1 — Tiết kiệm |

*Đọc nhanh: cần tiếng Việt xuất sắc → Sonnet/Opus/GPT-5; cần rẻ → mini/Flash/Qwen3/Llama 4; cần hồ sơ dày → Gemini/Llama 4; cần suy luận sâu → Pro/Opus/Grok Heavy.*

## 4. Ba tier — chỉ cần nhớ 3 mức

**Tier 1 — Tiết kiệm (báo cáo tuần).** **GPT-5 mini + Gemini Flash + Qwen3** (hoặc Llama 4 nếu tự host). Giá 0,25–0,70 USD/1M, context 400K–1M. 20 báo cáo/tháng × 8K token ≈ 160K token → dưới 0,10 USD. Mẹo Zen: cache prompt mẫu, batch 20–30 báo cáo giảm 50%. Skill: `cencom-bao-cao-tiet-kiem`.

**Tier 2 — Cân bằng (khuyên dùng, 80% nhu cầu).** **Claude Sonnet + Gemini Pro + GPT-5**. Tiếng Việt xuất sắc, suy luận ổn, giá vừa (Sonnet 3/15, Pro 1,25/10). Hợp báo cáo tháng, đối chiếu 3 nguồn, báo cáo kèm ảnh. Định tuyến 80% qua Sonnet/Flash, 20% ca khó lên Pro/GPT-5. Chi phí ~2–5 USD/tháng. Skill: `cencom-bao-cao-can-bang`.

**Tier 3 — Chất lượng cao (trình lãnh đạo, hồ sơ thầu).** **Claude Opus + GPT-5 high + Grok Heavy**. Dành cho báo cáo chiến lược, tổng kết quý — nơi sai một chi tiết là rủi ro. Opus giữ 5+ ràng buộc, Grok Heavy đối chiếu đa agent. Giá cao (15/75) nên chỉ dùng 2–4 báo cáo/tháng. Skill: `cencom-bao-cao-cao-cap`.

> Tạo 3 skill trong `opencode.json`; chỉ cần gõ `/skill cencom-bao-cao-can-bang` là OpenCode tự chọn model.

## Tóm tắt

- Chọn model theo 4 tiêu chí: tiếng Việt, giá/token, context và suy luận — báo cáo càng quan trọng càng ưu tiên suy luận và tiếng Việt.
- 6 họ model mỗi họ một thế mạnh: GPT-5 linh hoạt, Claude 4 tiếng Việt xuất sắc, Gemini 2.5 đọc hồ sơ 1M, Grok-4 tìm kiếm tươi, Qwen3 rẻ đa ngữ, Llama 4 mở với context 10M.
- Bảng 9 dòng cho thấy không có model tốt nhất cho mọi việc — Sonnet là mặc định, mini/Flash tiết kiệm, Opus/Pro/Grok dành cho việc khó.
- Ba tier Tiết kiệm / Cân bằng / Chất lượng giúp quyết định trong 10 giây và gắn trực tiếp vào 3 skill Cencom.

## Bài tập 5 phút

Lấy một báo cáo tuần gần nhất của phòng bạn (tồn kho, bán hàng, điều xe hoặc QC). Xếp nó vào **Tier 1 / 2 / 3** và ghi 2 dòng lý do theo 4 tiêu chí trên. Ví dụ: "Báo cáo tồn kho tuần — Tier 1 (GPT-5 mini) vì chỉ cần viết lại gọn, ít suy luận, context 40K là đủ; chi phí dưới 0,01 USD/báo cáo."
