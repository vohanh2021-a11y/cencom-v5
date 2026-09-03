# Chương 6: Thiết lập & cá nhân hoá — Tải skill, tạo skill riêng

> **Mục tiêu học tập**
> - Phân biệt GLOBAL vs PROJECT Skill, nêu đúng vị trí lưu và khi nào dùng mỗi loại tại Cencom.
> - Đọc hiểu anatomy `SKILL.md` (frontmatter `name`, `description`) và dùng `opencode skill list/add` để tải — kiểm tra Skill.
> - Tự tạo Skill mẫu `cencom-bao-cao-tuan` và đăng ký vào `SKILL_REGISTER.md` để dùng ngay cho báo cáo tuần.

---

## 1. Skill là gì — GLOBAL vs PROJECT đặt ở đâu?

Nếu OpenCode là bàn làm việc, **Skill** là *sách quy trình* — file `SKILL.md` dạy AI làm đúng biểu mẫu Cencom không cần code. Mỗi Skill gói: khi nào dùng, làm bước nào, cho ra mẫu nào.

| Tiêu chí | **GLOBAL Skill** | **PROJECT Skill** |
|---|---|---|
| **Vị trí lưu** | `~/.config/opencode/skills/<ten>/SKILL.md` | `<du-an>/.opencode/skills/<ten>/SKILL.md` |
| **Phạm vi** | Mọi dự án trên máy — dùng cá nhân | Chỉ dự án đó — đi theo repo, chia sẻ qua Git |
| **Khi nào dùng** | Quy trình riêng: `cencom-viet-email`, `cencom-tom-tat-hop` | Quy trình chung: `cencom-bao-cao-tuan`, `cencom-kiem-kho` |
| **Ai thấy** | Chỉ máy bạn | Cả phòng khi clone repo |

**Quy tắc chọn nhanh:** việc chỉ mình bạn dùng → GLOBAL; việc cả phòng cần duyệt chung → PROJECT. Trên Windows, `~` chính là `C:\Users\<TenBan>\.config\opencode\skills`.

![H11](03_hinh-anh-minh-hoa/H11_anatomy_skill_md.png)
*Hình H11 — Anatomy file SKILL.md: frontmatter (name, description) + thân Markdown hướng dẫn AI từng bước. Nguồn: opencode.ai/docs/skills.*

## 2. Tải Skill có sẵn và anatomy `SKILL.md`

### 2.1. Tải và kiểm tra — `opencode skill list/add`

Hai lệnh cần nhớ:

```powershell
opencode skill list                          # Xem Skill đang có
opencode skill add cencom-bao-cao-tuan       # Tải từ registry/GitHub
opencode debug config                        # Kiểm tra đã gộp chưa
# Trong TUI: gõ /skill để duyệt nhanh
```

Nếu không hiện, kiểm tra: đúng thư mục GLOBAL/PROJECT chưa, đã khởi động lại TUI chưa.

### 2.2. Anatomy `SKILL.md` — frontmatter là chìa khóa

Mọi Skill chỉ là một file `SKILL.md`, nhưng **frontmatter** đầu file quyết định có nạp được không:

```markdown
---
name: cencom-bao-cao-tuan
description: "Use when Trưởng phòng cần soạn báo cáo tuần Cencom: tổng hợp tồn kho, doanh số, việc tồn và kế hoạch tuần tới theo biểu mẫu chuẩn."
---

# Skill cencom-bao-cao-tuan
...
```

| Thành phần | Yêu cầu | Lỗi hay gặp |
|---|---|---|
| `name` | Chữ thường, dấu gạch ngang, khớp tên thư mục | `Cencom_BaoCaoTuan` (sai quy ước) |
| `description` | Bắt đầu bằng **"Use when..."**, nêu KHI NÀO dùng | Thiếu "Use when" → AI không tự gợi ý |
| Thân file | Markdown: mục tiêu, bước làm, checklist, template | Chỉ ghi prompt chung, thiếu bước kiểm tra |

OpenCode dùng `description` để tự gợi ý Skill khi yêu cầu khớp ngữ cảnh — viết càng cụ thể, AI càng chọn đúng.

![H12](03_hinh-anh-minh-hoa/H12_global_vs_project_skill.png)
*Hình H12 — So sánh GLOBAL (máy cá nhân) vs PROJECT (theo repo, chia sẻ phòng ban) và luồng đăng ký vào SKILL_REGISTER. Nguồn: opencode.ai/docs/skills.*

## 3. Tạo Skill mẫu `cencom-bao-cao-tuan` — dán là chạy

Skill hoàn chỉnh — chỉ cần tạo thư mục và dán nguyên văn.

**Tạo PROJECT Skill (khuyên dùng):**

```powershell
mkdir .opencode\skills\cencom-bao-cao-tuan
notepad .opencode\skills\cencom-bao-cao-tuan\SKILL.md
```

**Nội dung `SKILL.md` mẫu:**

```markdown
---
name: cencom-bao-cao-tuan
description: "Use when Trưởng phòng Cencom cần soạn báo cáo tuần: tổng hợp tồn kho, doanh số, việc tồn, kế hoạch tuần tới theo biểu mẫu chuẩn A4."
---

# cencom-bao-cao-tuan — Báo cáo tuần Cencom

## Mục tiêu
Báo cáo 400–500 từ, giọng trang trọng, gồm 3 bảng: Tồn kho, Doanh số, Việc tồn.

## Quy trình 4 bước

### Bước 1 — Thu thập
Đọc `ton-kho-*.xlsx` và `doanh-so-*.xlsx` trong thư mục dự án. Thiếu thì hỏi người dùng.

### Bước 2 — Tổng hợp
Tính: tồn dưới định mức, top 3 VLXD bán chạy, việc quá hạn >3 ngày.

### Bước 3 — Viết báo cáo
Theo mẫu:

| Mục | Nội dung | Số liệu |
|-----|----------|---------|
| Tồn kho | Xi măng, sắt, gạch | Dưới định mức: ... |
| Doanh số | Tổng tuần / so kế hoạch | ...% |
| Việc tồn | Việc chưa xong + phụ trách | ... việc |

### Bước 4 — Kiểm tra trước khi gửi
- [ ] Đủ 3 bảng, số liệu khớp file gốc
- [ ] Giọng trang trọng, không icon
- [ ] Ghi rõ phụ trách và deadline tuần tới

> Human-in-the-loop: dừng trước khi gửi email, chờ Trưởng phòng duyệt.
```

Muốn dùng cá nhân trên mọi dự án, chỉ đổi đường dẫn thành `~/.config/opencode/skills/cencom-bao-cao-tuan/SKILL.md`.

## 4. Kiểm tra & đăng ký vào `SKILL_REGISTER.md`

Tạo xong cần hai bước để AI tự gợi ý:

**Bước 1 — Kiểm tra nạp:**

```powershell
opencode skill list
opencode debug config | findstr cencom
# Đạt khi /skill trong TUI hiện cencom-bao-cao-tuan
```

Chạy `node E:\DevTools\opencode\config\check-skills.js` phải `ERR=0`. `WARN` là khuyến nghị, `ERR>0` là sai `name`/`description`.

**Bước 2 — Đăng ký `SKILL_REGISTER.md`:**

"Danh bạ Skill" để đồng nghiệp và Orchestrator biết Skill nào dùng khi nào:

| Trường | Điền cho `cencom-bao-cao-tuan` |
|---|---|
| Tên | `cencom-bao-cao-tuan` |
| Phạm vi | PROJECT (hoặc GLOBAL nếu cá nhân) |
| Kích hoạt khi | `Use when soạn báo cáo tuần Cencom` |
| Đường dẫn | `.opencode/skills/cencom-bao-cao-tuan/SKILL.md` |

PROJECT Skill thì commit cả thư mục lên Git — cả phòng clone là có. GLOBAL thì không commit, mỗi máy tự `opencode skill add`.

> Mẹo đặt tên: `cencom-<phong>-<viec>` như `cencom-kho-kiem-ke`, `cencom-ke-toan-doi-soat` để 6 phòng không trùng.

---

## Tóm tắt chương

Skill là file `SKILL.md` dạy AI quy trình Cencom — chỉ cần đúng frontmatter `name` và `description` "Use when...". GLOBAL ở `~/.config/opencode/skills` dùng cá nhân, PROJECT ở `.opencode/skills` đi theo repo cho cả phòng. Lệnh `opencode skill list/add` và `/skill` giúp tải và kiểm tra, `check-skills.js` đảm bảo `ERR=0`. Skill mẫu `cencom-bao-cao-tuan` với quy trình 4 bước và 3 bảng là khuôn sẵn — dán vào là chạy, đăng ký vào `SKILL_REGISTER.md` để AI tự gợi ý đúng lúc.

## Bài tập thực hành 5 phút

Tạo PROJECT Skill `cencom-bao-cao-tuan` bằng mẫu ở Mục 3 (hoặc tự viết `description` bắt đầu "Use when..."). Chạy `opencode skill list` và `opencode debug config`, chụp màn hình dòng `cencom-bao-cao-tuan` đã hiện. Trong TUI, gõ *"Soạn báo cáo tuần Kho từ ton-kho-07.xlsx"* và xác nhận AI có gợi ý Skill vừa tạo trước khi sang Chương 7.
