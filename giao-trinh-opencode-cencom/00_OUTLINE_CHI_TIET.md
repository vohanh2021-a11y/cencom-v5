# OUTLINE CHI TIẾT — GIÁO TRÌNH OPENCODE CENCOM

> **SSOT cho 10 chương · 10.000 từ · 20 hình** · Đối tượng: Trưởng phòng Cencom (không chuyên IT)  
> Palette: #FFFFFF · #1A1A1A · Deep Navy #0F2342 · #E6F0FF · #FFE8D6

## Quy ước thống nhất

- **Thuật ngữ chuẩn:** `AI Agent`, `Skill` (file `SKILL.md`), `Zen Free Tier` — giữ nguyên, không dịch.
- **Giọng văn:** Ngắn gọn, hành chính thân thiện, ví dụ VLXD thực tế; mỗi chương mở bằng *Mục tiêu học tập*, kết bằng *Bài tập 5 phút*.
- **Cấu trúc chương:** 800–1.000 từ, 2 placeholder `![Hxx](03_hinh-anh-minh-hoa/Hxx_*.png)`, có bảng/bước khi phù hợp.

---

## Mục lục 3 cấp

### Chương 1. Xu thế AI Agent 2024–2026 — Từ chatbot tới đồng nghiệp số

#### Mục tiêu học tập
- Phân biệt Chatbot / Workflow / AI Agent bằng ví dụ Cencom.
- Mô tả 3 làn sóng Tool-use → Multi-agent → Autonomous.
- Chọn 1 quy trình thí điểm để giao cho AI Agent.

#### Nội dung chi tiết
1. Định nghĩa và bảng so sánh Chatbot vs AI Agent (6 tiêu chí).
2. Ba làn sóng phát triển và dấu mốc (Function Calling, MCP/A2A, Computer-use).
3. Số liệu áp dụng (McKinsey 88%, Stanford HAI 53%, WorkLab 46%).
4. 3 case VLXD (UNACEM 40%, Taiheiyo -50% thời gian, Conch-Huawei) và bài học cho Cencom.

#### Bài tập 5 phút
Viết 1 câu giao mục tiêu cho AI Agent với quy trình phòng bạn (báo giá / điều xe / QC).

#### Hình minh hoạ
![H01](03_hinh-anh-minh-hoa/H01_xu_the_ai_agent_tong_quan.png)
![H02](03_hinh-anh-minh-hoa/H02_ba_lan_song_agent.png)

### Chương 2. Bản đồ Model AI — Chọn model nào cho báo cáo?

#### Mục tiêu học tập
- So sánh 6 họ model theo tiếng Việt, context, reasoning, giá.
- Chọn đúng tier Tiết kiệm / Cân bằng / Cao cấp theo loại báo cáo.
- Ước tính chi phí token cho báo cáo tuần/tháng.

#### Nội dung chi tiết
1. 4 tiêu chí chọn model cho báo cáo Cencom.
2. Hồ sơ 6 họ model: GPT-5/mini, Claude 4 Sonnet/Opus, Gemini 2.5 Pro/Flash, Grok-4, Qwen3, Llama 4.
3. Bảng so sánh 9 dòng model (context, giá, phù hợp báo cáo).
4. Khuyến nghị 3 tier và 3 Skill `cencom-bao-cao-tiet-kiem/can-bang/cao-cap`.

#### Bài tập 5 phút
Xếp 1 báo cáo tuần của bạn vào Tier 1/2/3 và nêu lý do.

#### Hình minh hoạ
![H03](03_hinh-anh-minh-hoa/H03_ban_do_model_ai.png)
![H04](03_hinh-anh-minh-hoa/H04_bang_so_sanh_model.png)

### Chương 3. Làm việc cùng AI — Human-in-the-loop

#### Mục tiêu học tập
- Mô tả tiến trình Prompt → Workflow → AI Agent.
- Kể 5 pattern (RAG, Memory, Tool, Planning, Reflection) bằng ví dụ Cencom.
- Áp dụng checklist an toàn dữ liệu trước khi giao việc.

#### Nội dung chi tiết
1. Từ prompt đơn lẻ tới AI Agent tự lập kế hoạch.
2. 5 pattern cốt lõi và khi nào dùng (RAG tra tài liệu, Memory nhớ quy trình).
3. Quy tắc giao việc: mục tiêu rõ, quyền hạn rõ, điểm kiểm tra con người.
4. Checklist bảo mật: phân loại mật, không đưa dữ liệu nhạy cảm vào Zen Free Tier.

#### Bài tập 5 phút
Viết prompt giao việc theo mẫu Mục tiêu + Ngữ cảnh + Công cụ + Tiêu chí đạt cho báo cáo tồn kho.

#### Hình minh hoạ
![H05](03_hinh-anh-minh-hoa/H05_human_in_the_loop.png)
![H06](03_hinh-anh-minh-hoa/H06_5_pattern_agent.png)

### Chương 4. Giới thiệu OpenCode — VS Code của kỷ nguyên Agent

#### Mục tiêu học tập
- Giải thích 3 trụ cột TUI + LSP + Skill cho người không chuyên IT.
- So sánh OpenCode vs Cursor/Claude Code/Windsurf.
- Cài đặt và chạy lệnh đầu tiên trên Windows.

#### Nội dung chi tiết
1. OpenCode là gì: TUI trong terminal, LSP kiểm lỗi, Skill dạy quy trình.
2. Kiến trúc 3 tầng (Giao diện → Lõi Agent → Mở rộng) và luồng xử lý.
3. Bảng so sánh 4 công cụ (giá, open-source, Skill, model, offline).
4. Cài đặt 3 bước: Node.js LTS → `npm i -g opencode-ai` → `/connect` + `/init`.
5. 7 lệnh cơ bản: `opencode`, `run`, `auth login`, `models`, `agent`, Skill, `debug config`.

#### Bài tập 5 phút
Chạy `opencode --version` và `opencode debug config`, chụp màn hình.

#### Hình minh hoạ
![H07](03_hinh-anh-minh-hoa/H07_kien_truc_opencode_3_tang.png)
![H08](03_hinh-anh-minh-hoa/H08_so_sanh_opencode_cursor.png)

### Chương 5. Zen Free Tier — Dùng miễn phí hiệu quả

#### Mục tiêu học tập
- Mô tả Zen là AI Gateway đã tuyển chọn, nguyên tắc no lock-in.
- Nêu quota ~200 request/ngày/model và lưu ý bảo mật nhóm Free.
- Cấu hình `opencode.json` và áp dụng 3 mẹo tiết kiệm.

#### Nội dung chi tiết
1. Zen là gì, khác gì Bring Your Own Key.
2. 7 model Free giá $0, cảnh báo “available for a limited time”.
3. Bảng Free vs Trả phí vs Team (chi phí, model, giới hạn, auto-reload).
4. 3 bước: opencode.ai/auth → `/connect` → `opencode.json` (apiKey qua biến môi trường).

#### Bài tập 5 phút
Tạo `opencode.json` với `model: mimo-v2.5-free`, `small_model: big-pickle`, kiểm tra `/models`.

#### Hình minh hoạ
![H09](03_hinh-anh-minh-hoa/H09_zen_free_tier_quota.png)
![H10](03_hinh-anh-minh-hoa/H10_cau_hinh_opencode_json.png)

### Chương 6. Thiết lập & cá nhân hoá — Tải Skill, tạo Skill riêng

#### Mục tiêu học tập
- Phân biệt GLOBAL vs PROJECT Skill và vị trí lưu.
- Đọc hiểu anatomy `SKILL.md` (frontmatter `name`, `description`).
- Tạo Skill mẫu `cencom-bao-cao-tuan`.

#### Nội dung chi tiết
1. Skill là gì: file Markdown dạy AI Agent quy trình, không cần code.
2. Khai báo trong `opencode.json`, kiểm tra bằng `/skill` / `debug config`.
3. GLOBAL vs PROJECT: khi nào dùng chung, khi nào riêng dự án.
4. Anatomy `SKILL.md` và thực hành tạo `cencom-bao-cao-tuan`.

#### Bài tập 5 phút
Viết frontmatter cho Skill `cencom-bao-cao-tuan` với `description` bắt đầu “Use when…”.

#### Hình minh hoạ
![H11](03_hinh-anh-minh-hoa/H11_anatomy_skill_md.png)
![H12](03_hinh-anh-minh-hoa/H12_global_vs_project_skill.png)

### Chương 7. Dạy AI đọc hiểu tài liệu & nghiên cứu mở rộng

#### Mục tiêu học tập
- Đưa tài liệu nội bộ vào `docs/memory` để AI Agent tra cứu (RAG local).
- Dùng `webfetch` nghiên cứu ngoài và đối chiếu nguồn.
- Áp dụng 5 Iron Laws của memory-engineering.

#### Nội dung chi tiết
1. Chuẩn bị `docs/memory/00-INDEX ≤30 dòng`, `MEMORY ≤80 dòng`.
2. RAG local: AI Agent đọc trước khi viết, không đoán mò.
3. Nghiên cứu mở rộng bằng `webfetch` (ví dụ cào QC206).
4. 5 Iron Laws và giới hạn context_max_chars 1500.

#### Bài tập 5 phút
Đặt 1 file nội bộ ≤2 trang vào `docs/memory/` và yêu cầu AI Agent tóm tắt 3 ý.

#### Hình minh hoạ
![H13](03_hinh-anh-minh-hoa/H13_rag_local_memory.png)
![H14](03_hinh-anh-minh-hoa/H14_webfetch_nghien_cuu.png)

### Chương 8. Học giọng văn & tạo Skill viết lại báo cáo

#### Mục tiêu học tập
- Thu thập 3–5 báo cáo mẫu và trích đặc trưng giọng văn.
- Viết prompt few-shot giữ số liệu, đổi diễn đạt.
- Đóng gói Skill `viet-lai-phong-cach-[Ten]` và test A/B.

#### Nội dung chi tiết
1. Thu thập mẫu được lãnh đạo khen, đánh dấu câu/từ đặc trưng.
2. Phân tích giọng văn: từ khóa, độ dài câu, tone trang trọng.
3. Prompt few-shot 2–3 đoạn mẫu.
4. Tạo Skill và test A/B; lưu ý không đưa báo cáo mật vào model Free.

#### Bài tập 5 phút
Dán 1 đoạn báo cáo 5 câu, yêu cầu AI Agent viết lại ngắn 20% giữ số liệu.

#### Hình minh hoạ
![H15](03_hinh-anh-minh-hoa/H15_hoc_giong_van.png)
![H16](03_hinh-anh-minh-hoa/H16_skill_viet_lai_bao_cao.png)

### Chương 9. Lộ trình trợ lý cá nhân cho từng Trưởng phòng

#### Mục tiêu học tập
- Mô tả persona AI Agent theo phòng ban (Kế toán/Kho/Xưởng/SC).
- Lập lộ trình 30-60-90 ngày cho phòng mình.
- Xác định KPI đo hiệu quả.

#### Nội dung chi tiết
1. Persona theo phòng: việc lặp, dữ liệu chính, Skill gợi ý.
2. Lộ trình 30-60-90 ngày (xem Timeline).
3. Tích hợp lịch/email/nhắc việc theo nguyên tắc human-in-the-loop.
4. KPI: thời gian/báo cáo, tỷ lệ sửa, số báo cáo tự động, chi phí Zen.

#### Bài tập 5 phút
Liệt kê 3 việc lặp tuần này sẽ giao cho AI Agent đầu tiên.

#### Hình minh hoạ
![H17](03_hinh-anh-minh-hoa/H17_persona_truong_phong.png)
![H18](03_hinh-anh-minh-hoa/H18_kpi_do_hieu_qua.png)

### Chương 10. Đề xuất mở rộng & triển khai tại Cencom

#### Mục tiêu học tập
- Trình bày roadmap 6 tháng triển khai toàn công ty.
- Nêu governance: bảo mật, phân quyền, chi phí Zen Pro, đào tạo.
- Dùng phụ lục thuật ngữ và template prompt để nhân rộng.

#### Nội dung chi tiết
1. Roadmap 6 tháng: thí điểm 2 phòng → nhân rộng 6 phòng → chuẩn hoá Skill.
2. Governance: phân quyền Admin/Member, monthly limit, zero-retention.
3. Chi phí Zen pay-as-you-go vs Team; ngưỡng nâng cấp từ Zen Free Tier.
4. Đào tạo workshop 2 giờ/phòng và kênh hỗ trợ nội bộ.

#### Bài tập 5 phút
Viết 3 bullet đề xuất gửi Ban Giám đốc: lợi ích, chi phí tháng đầu, rủi ro và kiểm soát.

#### Hình minh hoạ
![H19](03_hinh-anh-minh-hoa/H19_roadmap_6_thang.png)
![H20](03_hinh-anh-minh-hoa/H20_governance_zen_team.png)

---

## Timeline 30-60-90 ngày

| Giai đoạn | Việc chính | Kết quả đo được |
|-----------|------------|-----------------|
| **30 ngày — Làm quen** | Cài OpenCode, cấu hình `opencode.json`, dùng model Free cho 3 task (email, tóm tắt, chỉnh báo cáo) | 5 báo cáo/tuần qua AI Agent, 0 lộ dữ liệu mật |
| **60 ngày — Cá nhân hoá** | Tạo 1 Skill riêng, nạp 2 tài liệu vào `docs/memory`, học giọng văn và test A/B | Giảm 30% thời gian soạn báo cáo, Skill được duyệt |
| **90 ngày — Trợ lý thực thụ** | Giao trọn 1 quy trình (soát tồn kho → lập bảng → gửi duyệt), tích hợp lịch/nhắc việc | 1 quy trình chạy tự động có giám sát, báo cáo 90 ngày |

> Kiểm tra cuối mỗi 30 ngày: họp 30 phút rà KPI, quyết định nâng cấp Zen trả phí.

---

## Phụ lục thuật ngữ (10 từ)

| Thuật ngữ | Định nghĩa |
|-----------|------------|
| **AI Agent** | Đồng nghiệp số được giao mục tiêu, tự lập kế hoạch và dùng công cụ để hoàn thành. |
| **Skill** | File `SKILL.md` dạy AI Agent quy trình riêng của Cencom, không cần lập trình. |
| **Zen Free Tier** | Nhóm model miễn phí trong Zen (~200 request/ngày/model, không cam kết). |
| **TUI** | Giao diện chat trong terminal; gõ `opencode` để mở, `Tab` đổi Build/Plan. |
| **LSP** | Cơ chế báo lỗi ngữ pháp theo loại file khi AI Agent đang sửa. |
| **RAG** | Cho AI Agent đọc tài liệu nội bộ trước khi trả lời, tránh bịa đặt. |
| **Human-in-the-loop** | Người phê duyệt tại điểm kiểm tra trước khi AI Agent gửi/ghi dữ liệu quan trọng. |
| **Context** | Lượng chữ AI Agent nhớ trong một phiên (200K–1M token). |
| **Token** | Đơn vị tính chi phí; 1.000 từ tiếng Việt ≈ 1.500 token. |
| **Pay-as-you-go** | Trả theo lượng dùng thực tế trên Zen, không phí cố định hằng tháng. |

*SSOT — mọi chương 01–10 tuân thủ mục tiêu, mục con, bài tập và placeholder đã nêu. Thuật ngữ AI Agent / Skill / Zen Free Tier giữ nguyên.*
