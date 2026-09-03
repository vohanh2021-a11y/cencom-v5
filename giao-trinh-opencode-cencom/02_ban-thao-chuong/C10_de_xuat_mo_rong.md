# Chương 10: Đề xuất mở rộng & triển khai tại Cencom

> **Mục tiêu học tập**
> - Trình bày roadmap 6 tháng từ thí điểm 2 phòng tới chuẩn hoá toàn công ty với mốc đo rõ ràng.
> - Nêu governance tối thiểu: phân quyền Admin/Member, kiểm soát chi phí và 5 quy tắc bảo mật OWASP cho báo cáo.
> - Vận dụng phụ lục thuật ngữ và template prompt 4 dòng để nhân rộng Skill không phụ thuộc cá nhân.

---

## 1. Roadmap 6 tháng — từ thí điểm tới chuẩn hoá

Cencom không triển khai ồ ạt. Ba nấc **thí điểm → nhân rộng → chuẩn hoá**, mỗi nấc có cửa kiểm tra mới được lên nấc tiếp theo.

| Giai đoạn | Phạm vi | Việc chính (2–3 giờ/tuần/phòng) | Kết quả đo được | Chủ trì |
|---|---|---|---|---|
| **Tháng 1–2: Thí điểm** | Kho + Kế toán | Cài OpenCode, cấu hình `opencode.json` với Zen Free Tier; tạo 1 Skill/phòng; nạp 2 tài liệu vào `docs/memory` | ≥5 báo cáo/tuần qua AI, sửa <20%, 0 lộ dữ liệu mật | Trưởng phòng + IT |
| **Tháng 3–4: Nhân rộng** | Thêm Xưởng, SC-Cơ giới, Kinh doanh, Nhân sự | Nhân bản Skill theo persona Chương 9; áp dụng human-in-the-loop (AI soạn nháp, người duyệt mới gửi); họp KPI 30 phút/tháng | 6/6 phòng có Skill được duyệt, giảm 30% thời gian/báo cáo | Ban Giám đốc + IT |
| **Tháng 5–6: Chuẩn hoá** | Toàn công ty | Ban hành bộ Skill chuẩn `cencom-*`, lưu tập trung `docs/memory`; đánh giá nâng Zen Team nếu vượt ngưỡng | Bộ Skill v1.0 ban hành, mỗi phòng 1 quy trình tự động có giám sát | Hội đồng Skill |

**Cửa kiểm tra:** Hết tháng 2 nếu sửa >30% hoặc có 1 vụ đưa giá vốn/hợp đồng lên model Free thì dừng nhân rộng, bổ sung ví dụ few-shot. Hết tháng 4 nếu vượt 200 request/ngày liên tục 2 tuần thì đề xuất nâng Zen trả phí.

![H19](03_hinh-anh-minh-hoa/H19_roadmap_6_thang.png)
*Hình H19 — Roadmap 6 tháng ba nấc: thí điểm 2 phòng, nhân rộng 6 phòng, chuẩn hoá bộ Skill với cửa kiểm tra sau mỗi nấc. Nguồn: kế hoạch Cencom.*

## 2. Governance — bảo mật, phân quyền và OWASP

Trưởng phòng không cần nhớ hết OWASP Top 10, chỉ cần 5 quy tắc gắn với phân quyền Zen Team.

**Phân quyền Zen Team tại Cencom:**

| Vai trò | Ai giữ | Quyền chính | Giới hạn |
|---|---|---|---|
| **Admin** | IT + 1 Phó Giám đốc | Thêm/xóa thành viên, đặt monthly limit, duyệt Skill, xem log audit | Trần 30 USD/tháng/phòng |
| **Member** | Trưởng phòng, nhân viên ủy quyền | Dùng Skill, đọc `docs/memory` phòng mình, soạn nháp | Không tự gửi email, không đọc chéo phòng khác |
| **Khách mời** | Kiểm toán tạm thời | Chỉ đọc PDF đã duyệt | Hết hạn sau 7 ngày |

**5 quy tắc bảo mật tối thiểu:**

1. **Không đưa dữ liệu mật lên Free Tier.** Giá vốn, lương, hợp đồng chỉ chạy trên model trả phí có cam kết zero-retention. Dán nhãn file `MAT` trước khi giao cho AI.
2. **Kiểm tra quyền sở hữu (IDOR).** `docs/memory/kho/*` chỉ Kho đọc; Kế toán không mở được file Kho. IT kiểm tra trong hàm xử lý, không chỉ ẩn giao diện.
3. **Validate đầu vào.** Whitelist kiểu dữ liệu: `ngay: YYYY-MM-DD`, `trang_thai: cho_duyet|da_duyet`. Từ chối file >5 MB hoặc giá trị ngoài danh mục.
4. **Chống lộ log và XSS.** Không dán HTML lạ vào báo cáo; log chỉ ghi `user_id + hành động + thời gian`, không ghi token/mật khẩu.
5. **Hạn mức và audit.** Đặt monthly limit trên Zen Team, bật `db.audit` ghi ai cho AI gửi/ghi gì; cuối tháng rà ai vượt hạn mức.

![H20](03_hinh-anh-minh-hoa/H20_governance_zen_team.png)
*Hình H20 — Governance Zen Team: Admin đặt hạn mức và duyệt Skill, Member chỉ soạn nháp trong phạm vi phòng, mọi thao tác ghi log. Nguồn: cấu hình Zen Team.*

## 3. Chi phí Zen Pro vs hiệu quả — khi nào rời Free Tier?

Free Tier đủ cho làm quen, nhưng ba giới hạn khiến không phù hợp dữ liệu mật: quota ~200 request/ngày/model, không cam kết zero-retention, model có thể ghi *available for a limited time*.

| Gói | Giá tham khảo 2026 | Giới hạn chính | Dùng khi nào |
|---|---|---|---|
| **Zen Free Tier** | 0 USD | ~7 model $0, ~200 request/ngày, không SLA | Tháng 1–2: email, tóm tắt họp, chỉnh lỗi — không chứa giá vốn |
| **Pay-as-you-go** | ~3 USD/1M token input | Mọi model trả phí, tính theo dùng thực, zero-retention | Vượt 150 request/ngày hoặc cần xử lý công nợ, giá vốn |
| **Zen Team** | Pay-as-you-go + ~7–10 USD/user/tháng | Thêm phân quyền, monthly limit, log tập trung | Từ tháng 3 khi nhân rộng 6 phòng |

**Ước tính nhanh:** 1 báo cáo 1.500 từ ≈ 3.000 token ≈ 0,009 USD. 100 báo cáo/tháng ≈ 0,9 USD. Nếu mỗi phòng tiết kiệm 20 phút/báo cáo × 10 báo cáo/tuần = 13 giờ/tháng, chỉ cần giảm 2 giờ làm thêm đã vượt chi phí Zen. Chi phí thực nằm ở số lần sửa và request thử nghiệm.

**Ngưỡng nâng cấp:** Nâng khi thỏa một trong ba điều kiện: vượt 180 request/ngày liên tục 2 tuần, cần xử lý dữ liệu mật, hoặc tỷ lệ lỗi model Free >25% so với model trả phí (Claude 4 Sonnet, Gemini 2.5 Pro) qua test A/B.

## 4. Đào tạo & phụ lục — nhân rộng không phụ thuộc một người

**Đào tạo 2 giờ/phòng:** 30 phút cài `opencode.json` → 40 phút tạo Skill `cencom-bao-cao-tuan` → 30 phút nạp `docs/memory` và RAG → 20 phút checklist bảo mật và KPI. Mỗi phòng cử 1 hạt nhân; kênh `#opencode-cencom` có IT trực 16:00–17:00 hằng ngày.

**Phụ lục A — Thuật ngữ cốt lõi:**

| Thuật ngữ | Hiểu nhanh tại Cencom |
|---|---|
| AI Agent | Đồng nghiệp số được giao mục tiêu, tự lập kế hoạch và dùng công cụ |
| Skill | File `SKILL.md` dạy AI quy trình riêng, không cần code |
| Zen / Zen Free Tier | Cổng AI đã tuyển chọn; nhóm model miễn phí ~200 request/ngày |
| TUI / LSP | Giao diện chat trong terminal / báo lỗi khi AI sửa file |
| RAG / Memory | Cho AI đọc tài liệu nội bộ trước khi trả lời |
| Human-in-the-loop | Người duyệt tại điểm kiểm tra trước khi AI gửi/ghi |
| Token / Pay-as-you-go | Đơn vị tính tiền AI / trả theo dùng thực tế |

**Phụ lục B — Template prompt 4 dòng (dán vào mọi Skill):**

> **Mục tiêu:** [Soát tồn kho tuần 12–18/08 và lập bảng chênh lệch]  
> **Ngữ cảnh:** [File `ton-kho.xlsx` trong `docs/memory/kho/`, quy trình QC206]  
> **Công cụ:** [đọc Excel, lập bảng, soạn nháp email — không tự gửi]  
> **Tiêu chí đạt:** [Bảng khớp ERP 100%, lưu Nháp, chờ duyệt trước 16:00]

Chỉ cần thay 4 dòng này, mọi phòng đều tái sử dụng cùng cấu trúc.

---

## Tóm tắt chương

Roadmap 6 tháng đi từ thí điểm 2 phòng qua nhân rộng 6 phòng tới chuẩn hoá bộ Skill v1.0, mỗi nấc có cửa kiểm tra KPI và bảo mật. Governance dựa trên phân quyền Admin/Member, monthly limit và 5 quy tắc OWASP — đặc biệt không đưa dữ liệu mật lên Free Tier. Chi phí Pay-as-you-go chỉ vài USD cho 100 báo cáo/tháng; ngưỡng nâng cấp là vượt quota, cần zero-retention hoặc lỗi Free cao. Đào tạo 2 giờ/phòng cùng phụ lục thuật ngữ và template 4 dòng giúp Cencom nhân rộng bền vững.

## Bài tập thực hành 5 phút

Viết 3 bullet đề xuất gửi Ban Giám đốc: (1) Lợi ích — *Giảm 30% thời gian báo cáo tồn kho từ 60 xuống 40 phút*; (2) Chi phí tháng đầu — *0 USD (Zen Free) + 2 giờ đào tạo, dự kiến tháng 3 nâng ~5 USD/phòng nếu vượt 180 request/ngày*; (3) Rủi ro và kiểm soát — *Rủi ro lộ giá vốn → kiểm soát bằng model zero-retention + phân quyền `docs/memory/kho`*. Gửi vào nhóm thí điểm để chốt trước họp roadmap.
