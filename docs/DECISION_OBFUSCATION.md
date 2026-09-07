# Quyết định C5 — Chống dịch ngược: DEFER cho bản LAN nội bộ (07/09/2026)

> Theo skill `deploy-governance` §6 (3 lớp: không phát hành → che code → pháp lý).

## Đã áp dụng (lớp 1 — không phát hành)
- **Không sourcemap trong release**: `productionBrowserSourceMaps: false`
  (next.config.js — khai báo tường minh, không dựa default); standalone đã kiểm
  chứng **0 file `.map`**.
- **Không file dev/plan/AI-doc trong gói**: `.dockerignore` chặn `.git`,
  `docs/`, `tests/`, `videos/`, `.env*`, `node_modules`; installer Hub/Spoke
  chỉ đóng `main/preload/standalone/static/public/db` — đã soi `build.files`.
- **Strip console production**: `compiler.removeConsole` (giữ `error`/`warn`
  để debug bằng log — đúng triết lý "debug bằng log, không bằng sourcemap").

## Quyết định: KHÔNG obfuscate/bytenode ở giai đoạn này
Lý do (so trade-off của skill):
1. Môi trường: LAN nội bộ, máy công ty, user là nhân viên — mối đe dọa dịch
   ngược thấp; lớp pháp lý (LICENSE proprietary + EULA) đã có.
2. Chi phí: obfuscator giảm hiệu năng 15–80%, bytenode khóa cứng Node version
   (mâu thuẫn với portable PG + Electron cần nâng cấp linh hoạt), và làm
   khó điều tra sự cố production (stack trace vô nghĩa).
3. Lợi ích biên: với app server-side (API + PG) thì client bundle vốn đã ít
   chứa logic nghiệp vụ — nghiệp vụ nằm trong `lib/core` chạy trên server.

## Điều kiện kích hoạt lại (làm khi ĐỦ ĐIỀU KIỆN, không phải "quên")
- Bán app cho khách ngoài tổ chức (installer rời khỏi tầm kiểm soát), hoặc
- Có yêu cầu bảo vệ IP bằng văn bản từ Ban Giám đốc.

Khi kích hoạt: lớp 2 theo skill — frontend `javascript-obfuscator` (KHÔNG
obfuscate vendor), backend `bytenode` (lock Node version), đóng exe bằng Node
Single Executable Applications (pkg đã archive — cấm dùng).

## Checklist đã chạy (lớp 1) — 07/09/2026
- [x] `productionBrowserSourceMaps: false` + build lại → 0 `.map` trong standalone
- [x] `.dockerignore` kiểm soát gói Docker
- [x] `build.files` installer không chứa docs/env/tests
- [x] `removeConsole` (trừ error/warn)
- [x] LICENSE + EULA draft (lớp 3 — C4)
