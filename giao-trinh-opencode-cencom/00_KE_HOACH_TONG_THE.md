# KẾ HOẠCH BIÊN SOẠN GIÁO TRÌNH OPENCODE — CENCOM VLXD MIỀN TRUNG
## Trợ lý soạn văn bản báo cáo cho Trưởng phòng ban

> **Orchestrator:** Muse Spark (UI Mode — điều phối swarm)  
> **Mục tiêu:** 10.000 từ · 10 chương · 20 hình minh hoạ (500 từ / 1 hình) · Xuất bản **WORD + PPTX**  
> **Đối tượng:** Trưởng phòng ban Cencom — không chuyên IT, cần dùng ngay cho công việc báo cáo hàng ngày  
> **Palette PPTX/WORD:** Nền trắng #FFFFFF · Chữ đen #1A1A1A · Deep Navy #0F2342 (header chương) · Xanh nhạt #E6F0FF · Cam nhạt #FFE8D6  

---

## 1. CẤU TRÚC THƯ MỤC ĐÃ THIẾT LẬP (BƯỚC 1 — HOÀN TẤT ✅)

```
giao-trinh-opencode-cencom/
├── 00_KE_HOACH_TONG_THE.md          ← file này
├── 00_OUTLINE_CHI_TIET.md            ← sẽ tạo ở Wave 2
├── 01_tai-lieu-nghien-cuu/           ← WAVE 1: cào dữ liệu (4 agent song song)
│   ├── xu-huong-ai-agent/            (báo cáo AI Agent 2024-2026, nguồn: a16z, Stanford HAI, Microsoft WorkLab)
│   ├── model-ai-2026/                (bảng so sánh GPT-5 / Claude 4 / Gemini 2.5 / Grok-4 / Qwen3 / Llama4)
│   ├── opencode-docs/                (docs chính thức opencode.ai + GitHub SST/opencode)
│   └── zen-free-tier/                (opencode Zen, pricing, quota free tier, so sánh free vs pro)
├── 02_ban-thao-chuong/               ← WAVE 3: bản thảo từng chương (10 file .md, mỗi file 800-1100 từ)
│   ├── C01_xu_the_ai_agent.md
│   ├── C02_ban_do_model_ai.md
│   ├── C03_lam_viec_cung_ai.md
│   ├── C04_gioi_thieu_opencode.md
│   ├── C05_zen_free_tier_thuc_hanh.md
│   ├── C06_thiet_lap_skill_ca_nhan.md
│   ├── C07_day_ai_doc_hieu_tai_lieu.md
│   ├── C08_hoc_giong_van_tao_skill.md
│   ├── C09_lo_trinh_tro_ly_ca_nhan.md
│   └── C10_de_xuat_mo_rong.md
├── 03_hinh-anh-minh-hoa/              ← WAVE 3-4: 20 hình (PNG 1600x900, prompt Midjourney/DALL·E style flat)
│   ├── H01_...png  (mỗi chương 2 hình)
│   └── ...
└── 04_ban-giao/
    ├── GiaoTrinh_OpenCode_Cencom_v1.0.docx   ← WAVE 4 merge
    └── GiaoTrinh_OpenCode_Cencom_v1.0.pptx   ← WAVE 5 slide
```

> **Nguyên tắc Orchestrator:** Mỗi agent con chỉ viết **500–1000 từ / 1 file**, không tràn context. Orchestrator tổng hợp, đảm bảo thống nhất giọng văn, thuật ngữ, hình ảnh.

---

## 2. OUTLINE 10 CHƯƠNG — PHÂN BỔ TỪ & HÌNH

| Chương | Tiêu đề | Từ | Hình | Nội dung chính |
|--------|---------|-----|------|----------------|
| **C01** | Xu thế AI Agent 2024–2026 — Từ chatbot tới đồng nghiệp số | 1.000 | H01–H02 | Định nghĩa Agent vs Chatbot, 3 làn sóng (Tool-use → Multi-agent → Autonomous), số liệu áp dụng doanh nghiệp VN & thế giới, case Cencom |
| **C02** | Bản đồ Model AI mới nhất — Chọn model nào cho báo cáo? | 1.000 | H03–H04 | So sánh GPT-5/5-mini, Claude 4 Sonnet/Opus, Gemini 2.5 Pro/Flash, Grok-4, Qwen3, Llama4; tiêu chí: tiếng Việt, giá, context, reasoning |
| **C03** | Xu hướng làm việc cùng AI — Human-in-the-loop | 1.000 | H05–H06 | Prompt → Workflow → Agent, 5 pattern (RAG, Memory, Tool, Planning, Reflection), quy tắc giao việc cho AI, checklist an toàn dữ liệu |
| **C04** | Giới thiệu OpenCode — VS Code của kỷ nguyên Agent | 1.000 | H07–H08 | Kiến trúc OpenCode (TUI + LSP + Skills), so sánh Cursor/Claude Code/Windsurf, cài đặt Windows, giao diện, lệnh cơ bản |
| **C05** | OpenCode Zen Free Tier — Dùng miễn phí hiệu quả | 1.000 | H09–H10 | Đăng ký Zen, quota free (request/ngày, model), cấu hình `opencode.json`, thực hành 3 task báo cáo hàng ngày, mẹo tiết kiệm quota |
| **C06** | Thiết lập & cá nhân hoá — Tải skill, tạo skill riêng | 1.000 | H11–H12 | `opencode skill list/add`, GLOBAL vs PROJECT skill, anatomy `SKILL.md` (frontmatter), tạo skill `cencom-bao-cao-tuan` mẫu |
| **C07** | Dạy AI đọc hiểu tài liệu & nghiên cứu mở rộng | 1.000 | H13–H14 | Đưa tài liệu nội bộ vào `docs/memory`, RAG local, `webfetch` nghiên cứu ngoài, memory-engineering 5 Iron Laws, demo cào QC206 |
| **C08** | Học giọng văn & tạo skill viết lại báo cáo | 1.000 | H15–H16 | Thu thập 3–5 báo cáo mẫu, phân tích giọng văn (từ khóa, câu, tone), prompt few-shot, tạo skill `viet-lai-phong-cach-[Ten]`, test A/B |
| **C09** | Lộ trình trợ lý cá nhân cho từng Trưởng phòng | 1.000 | H17–H18 | Persona theo phòng ban (Kế toán/Kho/Xưởng/SC), 30-60-90 ngày, tích hợp lịch/email/nhắc việc, KPI đo hiệu quả |
| **C10** | Đề xuất mở rộng & triển khai tại Cencom | 1.000 | H19–H20 | Roadmap 6 tháng, governance (bảo mật, phân quyền), chi phí Zen Pro, đào tạo, phụ lục thuật ngữ + template prompt |
| **Tổng** | | **10.000** | **20** | Mỗi 500 từ gắn 1 hình minh hoạ |

**Quy tắc hình ảnh:** Prompt tiếng Anh flat vector, palette navy/orange/white, có icon Cencom, caption tiếng Việt, nguồn ghi rõ.

---

## 3. LỘ TRÌNH THỰC HIỆN 5 WAVE (ORCHESTRATOR ĐIỀU PHỐI)

### WAVE 0 — Thiết lập (ĐÃ XONG ✅)
- Tạo thư mục, file kế hoạch này, `swarm_init` (reservation mode do còn uncommitted changes)

### WAVE 1 — Cào dữ liệu nghiên cứu (4 agent song song, 30–45 phút)
| Agent | Nhiệm vụ | Output |
|-------|----------|--------|
| **R1** | Xu thế AI Agent (a16z, Stanford, McKinsey 2025) | `01_tai-lieu-nghien-cuu/xu-huong-ai-agent/nghien-cuu.md` |
| **R2** | Model AI 2026 (OpenAI, Anthropic, Google, xAI, Alibaba) | `model-ai-2026/so-sanh-model.md` + bảng |
| **R3** | OpenCode docs (opencode.ai, GitHub, Discord) | `opencode-docs/tong-hop-tinh-nang.md` |
| **R4** | Zen free tier (pricing, quota, so sánh) | `zen-free-tier/zen-free-tier.md` |

### WAVE 2 — Outline chi tiết + Template (1 agent, 15 phút)
- Viết `00_OUTLINE_CHI_TIET.md` (mục lục 3 cấp, learning objectives mỗi chương)
- Tạo `tools/build_giao_trinh/` — script `merge_docx.py` (python-docx) + `build_pptx.py` (python-pptx) với theme Cencom

### WAVE 3 — Viết bản thảo 10 chương (2 đợt, mỗi đợt 5 agent song song)
- Đợt 3A: C01–C05 (mỗi agent 800–1.000 từ, 2 hình placeholder)
- Đợt 3B: C06–C10 (tương tự)
- Output contract mỗi agent: `02_ban-thao-chuong/Cxx_*.md` (Markdown, heading H2/H3, bảng, quote, checklist)

### WAVE 4 — Merge WORD (1 agent tổng hợp)
- Đọc 10 file chương → `04_ban-giao/GiaoTrinh_OpenCode_Cencom_v1.0.docx`
- Style: Heading 1 navy #0F2342 chữ trắng, Heading 2 xanh nhạt, table header cam nhạt, font **Be Vietnam Pro / Arial**, chèn 20 hình, mục lục tự động, header/footer Cencom

### WAVE 5 — Chuyển sang PPTX (1 agent slide)
- Đọc DOCX → 35–40 slide (cover, agenda, mỗi chương 3 slide, case study, Q&A)
- Thư viện: `python-pptx`, theme: cover navy, slide nội dung nền trắng, accent xanh/cam, icon lucide, hình 16:9

---

## 4. HỢP ĐỒNG OUTPUT & RANH GIỚI (cho mọi agent con)

1. **objective:** 1–3 câu granular (vd: "Viết C04 900 từ, giới thiệu OpenCode, có bảng so sánh, 2 placeholder hình")
2. **output_format:** File Markdown cụ thể + word count + số hình placeholder `![Hxx](...)`
3. **tools_guidance:** Được dùng `webfetch`/`websearch` (chỉ trong 01_tai-lieu-nghien-cuu), `read`/`write` đúng file được giao, không lan sang chương khác
4. **task_boundaries:** KHÔNG tự merge, KHÔNG tạo file ngoài phạm vi, KHÔNG copy nguyên văn >100 từ (paraphrase)

---

## 5. KIỂM SOÁT CHẤT LƯỢNG & RỦI RO

- **Nhất quán giọng văn:** Orchestrator duyệt outline trước, mỗi chương mở đầu bằng "Mục tiêu học tập" và kết bằng "Bài tập thực hành 5 phút"
- **Chống mất context:** Mỗi chương ≤1.000 từ, agent độc lập, Orchestrator giữ `00_OUTLINE_CHI_TIET.md` làm single source of truth
- **Hình ảnh:** Dùng placeholder trước, đợt cuối thay bằng ảnh AI generate (prompt lưu trong `03_hinh-anh-minh-hoa/prompts.md`)
- **Verify trước bàn giao:** `npx tsc --noEmit` không áp dụng (dự án docs), nhưng chạy `python -m docx` check + mở PPTX preview

---

## 6. BƯỚC TIẾP THEO — CẦN XÁC NHẬN CỦA BẠN

1. **Bạn đồng ý outline 10 chương trên?** (có muốn đổi tên chương / thêm bớt nội dung VLXD đặc thù?)
2. **Cho phép bắt đầu WAVE 1 (cào dữ liệu) ngay?** — 4 agent sẽ chạy song song, mỗi agent ~500–800 từ nghiên cứu
3. **Xác nhận palette & font:** Deep Navy #0F2342 + Xanh nhạt #E6F0FF + Cam nhạt #FFE8D6 + Be Vietnam Pro — có muốn dùng font khác?

> Sau khi bạn OK, Orchestrator sẽ spawn **WAVE 1** ngay, rồi tuần tự WAVE 2 → 3A → 3B → 4 → 5. Mỗi wave báo cáo tiến độ + file output để bạn duyệt.

---

## 7. ƯỚC TÍNH THỜI GIAN

| Wave | Thời gian | Ghi chú |
|------|-----------|---------|
| 1 | 30–45′ | Research |
| 2 | 15′ | Outline + script |
| 3A+3B | 60–90′ | Viết 10 chương |
| 4 | 15′ | Merge DOCX |
| 5 | 20′ | Build PPTX |
| **Tổng** | **~2,5–3 giờ** | Có thể chia 2 phiên nếu cần |

---

*File này là SSOT cho toàn bộ swarm. Mọi agent con đọc trước khi làm việc.*
