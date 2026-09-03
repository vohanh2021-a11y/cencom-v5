# Tổng hợp tính năng OpenCode — Tài liệu nghiên cứu cho Trưởng phòng Cencom

> **Mục đích:** Giúp Trưởng phòng hiểu nhanh OpenCode là gì, dùng để làm gì và khác gì Cursor/Claude Code/Windsurf. Đọc 7 phút.

---

## 1. OpenCode là gì — TUI + LSP + Skills, 100% open-source

**OpenCode** là **AI coding agent mã nguồn mở** do **SST / Anomaly Innovations** phát triển, nay tại **github.com/anomalyco/opencode** (tên cũ sst/opencode). Giấy phép **MIT**, hơn **150.000 sao**, 850+ contributor, **6,5 triệu dev/tháng** (04/2026).

Hiểu nôm na: **OpenCode là "VS Code của kỷ nguyên Agent" trong terminal** — tự đọc tài liệu, sửa file và nhớ quy trình phòng ban.

Ba trụ cột:

* **TUI (Terminal User Interface):** Giao diện chat trong terminal (Go + Bubble Tea). Gõ `opencode` để mở, ` /` gọi lệnh, `Tab` chuyển **Build** (được sửa file) ↔ **Plan** (chỉ đọc). Có cả **Desktop App** và extension VS Code.
* **LSP (Language Server Protocol):** Tự nạp LSP theo đuôi file (.ts, .py, .go...) để báo lỗi ngữ pháp khi AI đang sửa. Bật/tắt qua `"lsp": true` trong `opencode.json`.
* **Skills (Kỹ năng):** File Markdown `SKILL.md` dạy AI quy trình riêng. Ví dụ skill `cencom-bao-cao-tuan` dạy đúng giọng văn và biểu mẫu Cencom. Lưu ở `~/.config/opencode/skills` (chung) hoặc `.opencode/skills` (riêng dự án), chia sẻ qua URL. **Không cần lập trình, chỉ cần viết hướng dẫn là AI học việc mới**.

---

## 2. Kiến trúc 3 lớp — như tòa nhà 3 tầng

| Tầng | Tên | Nhiệm vụ | Cấu hình |
|------|-----|----------|----------|
| **3 - Giao diện** | Interface | Nơi người gặp AI: TUI, Desktop App, IDE extension. Gõ lệnh, kéo-thả ảnh, `/share` phiên. | `tui.json` |
| **2 - Lõi Agent** | Runtime/Server | "Bộ não" Go: quản phiên (SQLite), điều phối Tools (read/edit/bash), phân quyền, nén ngữ cảnh, gọi LLM qua Models.dev. | `opencode.json` |
| **1 - Mở rộng** | Extension | "Bộ kỹ năng": Skills, LSP, MCP (nối Jira/GitHub), Plugins, Commands. | `.opencode/skills/` |

Luồng: Gõ yêu cầu ở **Tầng 3** → **Tầng 2** chọn model, kiểm tra quyền, gọi Tools/LSP → nếu khớp skill ở **Tầng 1** thì nạp để làm đúng quy trình Cencom. Xong có thể `/undo` nếu chưa ưng.

---

## 3. So sánh OpenCode vs Cursor vs Claude Code vs Windsurf

| Tiêu chí | **OpenCode** | **Cursor** | **Claude Code** | **Windsurf (Devin Desktop)** |
|----------|--------------|------------|-----------------|-------------------------------|
| **Giá** | **Miễn phí MIT** + API ~5-50$/tháng hoặc 0đ (Ollama). Go 10$/tháng | Hobby giới hạn; Pro **20$/tháng**, Ultra 200$ | Kèm Claude Pro **20$/tháng**, Max 100-200$ | Miễn phí giới hạn; Pro **15-20$/tháng**, Max 200$ |
| **Open-source** | **Có (MIT, 150k sao)** | Không | Không | Không |
| **Skill** | **Mở**: Markdown + scripts, GLOBAL vs PROJECT, HTTP catalog | Cursor Rules (đóng) | Prompt nội bộ Anthropic | Cascade Workflows (đóng) |
| **Model** | **75+ provider** + local Ollama, đổi model giữa phiên | Đa model qua trung gian Cursor | **Chỉ Claude** (Opus 4.7/Sonnet 4.6) | Đa model + SWE-1.5 riêng |
| **Offline** | **Có (Ollama)** | Không | Không | Không |

**Chốt cho Cencom:** Muốn **tiết kiệm, không khóa nhà cung cấp, dữ liệu ở lại công ty, tự định nghĩa quy trình** → OpenCode. Muốn IDE mượt, ít gõ lệnh → Cursor/Windsurf. Muốn suy luận mạnh nhất codebase lớn → Claude Code.

---

## 4. 7 lệnh cơ bản

> Chạy trong thư mục dự án. Lần đầu `opencode` sẽ hỏi `/connect` để nhập API key.

1. **`opencode`** — Mở TUI. Dùng `@` chọn file, `Tab` đổi Build/Plan.
2. **`opencode run "câu lệnh"`** — Chạy không mở TUI, hợp tự động hóa. VD: `opencode run "Tóm tắt docs/bao-cao.md"`.
3. **`opencode auth login`** — Đăng nhập provider, lưu key vào `~/.local/share/opencode/auth.json`.
4. **`opencode models [provider] --refresh`** — Liệt kê model khả dụng.
5. **`opencode agent list / create`** — Xem/tạo agent riêng (plan chỉ đọc, build được sửa).
6. **Quản lý Skills** — Khai báo trong `opencode.json` (`"skills": ["./.opencode/skills"]`), kiểm tra bằng `/skill` trong TUI hoặc `opencode debug config`. Đây chính là `skill list/add` trong tài liệu cộng đồng.
7. **`opencode debug config`** — Xem cấu hình gộp (global + project). Sửa `model`, `permission: {"edit":"ask"}`, `lsp` tại đây.



---

## 5. Cài đặt trên Windows — 3 bước, 2 phút

> Windows 10/11 64-bit. Chỉ cần WSL2 nếu dự án bắt buộc lệnh Linux.

**Bước 1 — Cài Node.js LTS:** Tải tại nodejs.org hoặc `winget install OpenJS.NodeJS.LTS`, kiểm tra `node --version; npm --version`, mở lại PowerShell.

**Bước 2 — Cài OpenCode:**
```powershell
npm install -g opencode-ai   # Chú ý: opencode-ai, không phải opencode
opencode --version
```
Lỗi `not recognized` → kiểm tra `npm config get prefix` đã trong PATH. Cập nhật: `npm install -g opencode-ai@latest`.

**Bước 3 — Kết nối và chạy:**
```powershell
cd D:\du-an-cencom
opencode              # Mở TUI
/connect              # Chọn provider (Zen/Anthropic/OpenAI) và dán key
/init                # Tạo AGENTS.md mô tả dự án (nên commit Git)
```
Lần sau chỉ cần `opencode` hoặc `opencode run "Viết báo cáo tuần"`. Thay thế: `scoop install opencode` / `choco install opencode` / tải .exe từ Releases.

---

## 6. Nguồn tham khảo

* **opencode.ai** — tài liệu chính thức.
* **github.com/anomalyco/opencode** (cũ sst/opencode) — mã nguồn MIT, hướng dẫn cài npm/brew/scoop/choco/Docker.
* **Discord opencode.ai/discord**.
* **So sánh độc lập:** nxcode.io, turbodocx.com, devtoolsreview.com (bảng giá 2026).






