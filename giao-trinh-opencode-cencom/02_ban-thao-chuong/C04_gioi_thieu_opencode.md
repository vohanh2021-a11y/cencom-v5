# Chương 4: Giới thiệu OpenCode — VS Code của kỷ nguyên Agent

> **Mục tiêu học tập**
> - Giải thích được 3 trụ cột TUI + LSP + Skills của OpenCode bằng ví dụ Cencom.
> - So sánh OpenCode với Cursor, Claude Code và Windsurf để chọn đúng công cụ.
> - Cài đặt thành công OpenCode trên Windows và chạy 7 lệnh cơ bản đầu tiên.

---

## 1. OpenCode là gì — Ba trụ cột TUI + LSP + Skills

Nếu AI Agent là đồng nghiệp số, thì **OpenCode** là bàn làm việc của người đó. Đây là **AI coding agent mã nguồn mở** do SST / Anomaly Innovations phát triển, lưu tại `github.com/anomalyco/opencode`, giấy phép **MIT**, hơn 150.000 sao và 850 contributor. Nói gọn cho Trưởng phòng: *OpenCode là VS Code của kỷ nguyên Agent, nhưng chạy ngay trong terminal*.

Ba trụ cột được nhớ bằng cụm **TUI + LSP + Skills**:

**TUI (Terminal User Interface) — Cửa giao tiếp.** Giao diện chat trong terminal (Go + Bubble Tea). Gõ `opencode` là mở, `/` gọi lệnh, `@` chọn file, `Tab` chuyển giữa **Build** (được sửa file) và **Plan** (chỉ đọc). Ngoài TUI còn có Desktop App và extension VS Code. Ví dụ, Trưởng phòng Kho mở `D:\bao-cao-kho` rồi gõ `opencode` để yêu cầu “soát tồn xi măng tháng 7”.

**LSP (Language Server Protocol) — Người soát lỗi.** Tự nạp theo đuôi file để báo lỗi ngữ pháp khi AI sửa. Bật qua `"lsp": true` trong `opencode.json`.

**Skills — Sách quy trình.** File `SKILL.md` dạy AI quy trình riêng mà không cần lập trình. Ví dụ `cencom-bao-cao-tuan` quy định biểu mẫu Cencom. Lưu ở `~/.config/opencode/skills` (GLOBAL) hoặc `.opencode/skills` (PROJECT).

## 2. Kiến trúc 3 lớp — Tòa nhà 3 tầng

Hình dung OpenCode như tòa nhà 3 tầng:

| Tầng | Tên | Vai trò | Cấu hình |
|------|-----|---------|----------|
| **Tầng 3 — Giao diện** | Interface | Nơi người gặp AI: TUI, Desktop App, extension VS Code; nhận lệnh, `/share` phiên. | `tui.json` |
| **Tầng 2 — Lõi Agent** | Runtime | Bộ não Go: quản phiên (SQLite), điều phối Tools (`read`, `edit`, `bash`), gọi LLM. | `opencode.json` |
| **Tầng 1 — Mở rộng** | Extension | Bộ kỹ năng: Skills, LSP, MCP (nối Jira/GitHub), Plugins. | `.opencode/skills/` |

**Luồng xử lý:** Gõ yêu cầu ở Tầng 3 → Tầng 2 chọn model, gọi Tools/LSP → nếu khớp Skill ở Tầng 1 thì nạp để làm đúng biểu mẫu. Có thể `/undo` nếu chưa ưng.

![H07](03_hinh-anh-minh-hoa/H07_kien_truc_opencode_3_tang.png)
*Hình H07 — Kiến trúc 3 tầng của OpenCode: Giao diện → Lõi Agent → Mở rộng (Skills/LSP/MCP). Nguồn: opencode.ai và GitHub anomalyco/opencode.*

## 3. So sánh OpenCode với Cursor, Claude Code và Windsurf

| Tiêu chí | **OpenCode** | **Cursor** | **Claude Code** | **Windsurf** |
|----------|--------------|------------|-----------------|--------------|
| **Giá** | Miễn phí MIT; API 5–50 USD/tháng hoặc 0đ với Ollama | Hobby giới hạn; Pro 20 USD | Kèm Claude Pro 20 USD, Max 100–200 USD | Miễn phí giới hạn; Pro 15–20 USD |
| **Mã nguồn** | **Có — MIT, 150k sao** | Không | Không | Không |
| **Tùy biến quy trình** | **Mở:** `SKILL.md`, GLOBAL vs PROJECT | Cursor Rules (đóng) | Prompt nội bộ | Cascade Workflows (đóng) |
| **Lựa chọn model** | **75+ provider** + Ollama, đổi giữa phiên | Đa model qua Cursor | Chỉ họ Claude | Đa model + SWE-1.5 |
| **Chạy offline** | **Có (Ollama)** | Không | Không | Không |

**Chọn thế nào cho Cencom?** Cần tiết kiệm, không khóa nhà cung cấp, dữ liệu ở lại công ty và tự định nghĩa quy trình → chọn **OpenCode**. Cần IDE mượt, ít gõ lệnh → cân nhắc **Cursor/Windsurf**. Cần suy luận mạnh nhất trên codebase lớn → chọn **Claude Code**. Với định hướng chuẩn hóa báo cáo và tận dụng Zen Free Tier, OpenCode là lựa chọn cân bằng nhất cho thí điểm 3 tháng.

![H08](03_hinh-anh-minh-hoa/H08_so_sanh_opencode_cursor.png)
*Hình H08 — So sánh trực quan OpenCode (mở, linh hoạt) với Cursor/Claude Code/Windsurf (đóng, tiện dụng). Nguồn: nxcode.io, turbodocx.com 2026.*

## 4. Cài đặt trên Windows trong 3 bước và 7 lệnh cơ bản

> Yêu cầu: Windows 10/11 64-bit. Chỉ cần WSL2 nếu dự án bắt buộc lệnh Linux.

### Cài đặt 3 bước — 2 phút

**Bước 1 — Cài Node.js LTS.** Tải tại `nodejs.org` hoặc `winget install OpenJS.NodeJS.LTS`. Kiểm tra `node --version` và `npm --version`, mở lại PowerShell.

**Bước 2 — Cài OpenCode.**

```powershell
npm install -g opencode-ai   # Chú ý: opencode-ai, không phải opencode
opencode --version
```

Nếu báo `not recognized`, kiểm tra `npm config get prefix` trong PATH. Cập nhật: `npm install -g opencode-ai@latest`.

**Bước 3 — Kết nối và khởi tạo.**

```powershell
cd D:\du-an-cencom
opencode              # Mở TUI
/connect              # Chọn provider (Zen/Anthropic/OpenAI) và dán key
/init                # Tạo AGENTS.md — nên commit Git
```

Lần sau chỉ cần `opencode` hoặc `opencode run "Viết báo cáo tuần"`.

### 7 lệnh cơ bản

1. `opencode` — Mở TUI; `@` chọn file, `Tab` đổi Build/Plan.
2. `opencode run "câu lệnh"` — Chạy không mở TUI, hợp tự động hóa.
3. `opencode auth login` — Đăng nhập provider, lưu key vào `auth.json`.
4. `opencode models --refresh` — Liệt kê model khả dụng.
5. `opencode agent list / create` — Xem và tạo agent riêng.
6. **Quản lý Skills** — Khai báo trong `opencode.json`, kiểm tra bằng `/skill` hoặc `opencode debug config`.
7. `opencode debug config` — Xem cấu hình gộp; chỉnh `model`, `permission`, `lsp` tại đây.

> Mẹo: đặt `permission: {"edit":"ask"}` để AI hỏi trước khi sửa báo cáo quan trọng.

---

## Tóm tắt chương

OpenCode là bàn làm việc mở cho AI Agent với 3 trụ cột **TUI**, **LSP** và **Skills**. Kiến trúc 3 tầng giúp thay model hay quy trình không cần cài lại. So với Cursor, Claude Code và Windsurf, OpenCode thắng ở chi phí, mã nguồn mở và chạy offline — phù hợp Cencom. Cài đặt chỉ 3 bước và 7 lệnh là đủ để giao việc đầu tiên.

## Bài tập thực hành 5 phút

Mở PowerShell trong thư mục dự án trống, chạy `opencode --version` và `opencode debug config`. Chụp màn hình, khoanh vùng dòng `model` và `skills` đang nạp, gửi quản trị viên để xác nhận trước khi sang Chương 5.
