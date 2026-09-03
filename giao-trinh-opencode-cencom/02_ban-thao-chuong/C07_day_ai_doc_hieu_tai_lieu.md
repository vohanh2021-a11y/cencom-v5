# Chương 7: Dạy AI đọc hiểu tài liệu & nghiên cứu mở rộng

> **Mục tiêu học tập**
> - Đưa tài liệu nội bộ vào `docs/memory` để AI Agent tra cứu trước khi trả lời (RAG local), không đoán mò.
> - Dùng `webfetch`/`websearch` nghiên cứu ngoài và đối chiếu nguồn trước khi đưa vào báo cáo.
> - Áp dụng 5 Iron Laws của memory-engineering và giới hạn `context_max_chars = 1500` để tránh tràn ngữ cảnh.

---

## 1. Đưa tài liệu nội bộ vào `docs/memory` — 00-INDEX, MEMORY, CONTEXT

AI Agent chỉ giỏi khi đọc đúng tài liệu. Tại Cencom, quy trình QC và biểu mẫu nằm rải rác; nhồi chung một file khiến AI quên và bịa đặt. Giải pháp là `docs/memory` — tủ hồ sơ 3 ngăn.

| File | Vai trò | Giới hạn cứng | Ví dụ Cencom |
|---|---|---|---|
| `00-INDEX.md` | Mục lục lướt — AI đọc đầu tiên để biết có gì | **≤30 dòng** | `QC206 \| Quy trình kiểm soát VLXD vào kho \| 2026-02-10` |
| `MEMORY.md` | Quyết định đã chốt + lý do | **≤80 dòng** | `2026-02-10: Áp dụng QC206 cho xi măng, gạch — vì lỗi ẩm 12%` |
| `CONTEXT.md` | Việc đang làm phiên này | **≤40 dòng**, reset mỗi phiên | `Hôm nay: soạn báo cáo tồn kho tuần 07 cho phòng Kho` |

**Cách làm 3 bước:** 1) `mkdir docs\memory`; 2) Viết `00-INDEX.md` — mỗi dòng `Tên | Mô tả 1 câu | Ngày`, quá 30 dòng phải tách `patterns/qc.md`; 3) Viết `MEMORY.md` theo khuôn `## YYYY-MM-DD` + 4 dòng (quyết định, lý do, tác động), cuối phiên có thay đổi phải append.

> Nguyên tắc: AI đọc `00-INDEX` trước, chỉ mở file liên quan — không dán 50 trang vào prompt.

## 2. RAG local — bắt AI đọc trước khi viết

RAG (Retrieval-Augmented Generation) là *cho AI đọc tài liệu nội bộ trước khi trả lời*. RAG local đọc từ `docs/memory` trên máy, không gửi ra ngoài, không tốn quota Zen.

**Luồng chuẩn:** 1) Trưởng phòng: *"Lập báo cáo nhập kho theo QC206"* → 2) AI mở `00-INDEX.md` thấy `qc206-tom-tat.md` → 3) AI đọc file đã compile ≤80 dòng và trích đúng điều khoản.

| Không RAG (AI đoán) | Có RAG local (AI đọc) |
|---|---|
| "Quy trình QC206 gồm 5 bước..." (sai, bịa) | "Theo QC206 §2.3: xi măng lưu kho >30 ngày phải kiểm ẩm lại" (đúng, có nguồn) |
| Không ghi nguồn, khó kiểm | Ghi rõ `Nguồn: docs/memory/qc206-tom-tat.md` |

**Compile trước khi nạp** là bắt buộc: tóm tắt 2 trang thành 60–80 dòng, giữ số liệu then chốt. Giới hạn `context_max_chars = 1500` ký tự — vượt là AI quên đầu, nhớ đuôi.

![H13](03_hinh-anh-minh-hoa/H13_rag_local_memory.png)
*Hình H13 — Luồng RAG local: 00-INDEX → MEMORY/CONTEXT → AI trả lời có trích nguồn, không đoán mò. Nguồn: opencode.ai/docs + memory-engineering.*

## 3. Nghiên cứu mở rộng bằng `webfetch`/`websearch` — đối chiếu trước khi tin

Khi tài liệu nội bộ chưa đủ, cần tham chiếu ngoài (tiêu chuẩn, giá VLXD, quy định). OpenCode có hai công cụ:

| Công cụ | Khi nào dùng | Ví dụ lệnh |
|---|---|---|
| `websearch` | Tìm nguồn — chưa biết trang nào | `websearch "QC206 xi măng 2024 site:gov.vn"` |
| `webfetch` | Đọc 1 URL cụ thể đã chọn | `webfetch https://tieuchuan.gov.vn/qc206` |

**Quy tắc 3 kiểm:** 1) Tìm 2 nguồn độc lập (gov.vn + hiệp hội VLXD); 2) Đối chiếu ngày ban hành, ưu tiên bản mới nhất; 3) Dán link cuối đoạn để duyệt một click. Không copy >100 từ, tóm tắt lại giữ số liệu. Dữ liệu mật (giá vốn, khách hàng) chỉ dùng RAG local, không `websearch`.

![H14](03_hinh-anh-minh-hoa/H14_webfetch_nghien_cuu.png)
*Hình H14 — Nghiên cứu ngoài bằng webfetch/websearch: tìm → đọc → đối chiếu 2 nguồn → trích link vào báo cáo. Nguồn: opencode.ai/docs/tools.*

## 4. Demo cào QC206 & 5 Iron Laws — checklist không tràn ngữ cảnh

**Demo QC206:** Trưởng phòng Kho kiểm nhập xi măng:

```powershell
webfetch https://tieuchuan.gov.vn/qc206-xi-mang-2024 --format markdown
# Compile -> docs/memory/qc206-tom-tat.md (≤80 dòng)
# Cập nhật 00-INDEX.md: QC206 | Kiểm ẩm, lưu kho xi măng | 2026-02-10
# Ra lệnh: "Theo qc206-tom-tat.md, lập checklist 5 bước nhập kho xi măng"
```
Kết quả: AI trả checklist 5 bước trích `§2.3 QC206`, không bịa thêm.

**5 Iron Laws phải nhớ** (từ `memory-engineering` — áp dụng mọi dự án):

| # | Iron Law | Hiểu nhanh |
|---|---|---|
| 1 | **Giới hạn dòng cứng** | 00-INDEX ≤30, MEMORY ≤80, CONTEXT ≤40 — vượt phải tách file |
| 2 | **Ghi nhớ bắt buộc** | Cuối phiên có thay đổi → append `MEMORY.md`, reset `CONTEXT.md` |
| 3 | **Compile trước khi nạp** | Tóm tắt ≤1500 ký tự rồi mới đưa vào prompt, cấm dán nguyên file dài |
| 4 | **Phân tầng module** | Chia theo chủ đề (`qc/`, `kho/`, `bao-cao/`), không dồn một cục |
| 5 | **Ưu tiên tiếng Việt** | 4 quy tắc tiếng Việt global là cao nhất, trên mọi Iron Law khác |

**Checklist trước khi giao việc cho AI:**

- [ ] `00-INDEX.md` ≤30 dòng, `MEMORY.md` ≤80 dòng, `CONTEXT.md` ≤40 dòng
- [ ] Tài liệu nội bộ đã compile, không dán thô
- [ ] `context_max_chars` để 1500, mỗi module ≤80 dòng
- [ ] Nghiên cứu ngoài có 2 nguồn + link, không lộ dữ liệu mật

---

## Tóm tắt chương

Dạy AI đọc hiểu gồm hai chân: **RAG local** (3 file `00-INDEX` ≤30, `MEMORY` ≤80, `CONTEXT` ≤40) bắt AI đọc trước khi viết và trích nguồn; và **webfetch/websearch** để tìm, đọc, đối chiếu 2 nguồn có link. Demo QC206 cho thấy cào → compile → index → checklist chuẩn. Cả hai tuân 5 Iron Laws: giới hạn dòng cứng, compile ≤1500 ký tự, phân tầng module để không tràn ngữ cảnh.

## Bài tập thực hành 5 phút

Chọn 1 tài liệu nội bộ ≤2 trang (ví dụ: 1 mục QC206 hoặc quy trình nhập kho). Compile thành `docs/memory/qc206-tom-tat.md` ≤60 dòng, thêm 1 dòng vào `00-INDEX.md`. Trong TUI OpenCode, ra lệnh: *"Dựa trên qc206-tom-tat.md, tóm tắt 3 ý chính để kiểm xi măng nhập kho, ghi rõ nguồn"*. Chụp màn hình câu trả lời có trích nguồn và kiểm tra `context_max_chars` đang là 1500.
