# PLAN_DEPLOY_GAPS — Hoàn thiện deploy theo Deploy Governance (chờ duyệt, CHƯA build)

> Đối chiếu: skill `deploy-governance` (5 Iron Law + §11) + `vibe-deploy-checklist` + `verification-before-completion` + `onpremise-deploy`.
> Nguyên tắc: Wave A làm local trước, Wave B cần máy Ubuntu thật + anh, Wave C hardening. **Backup (A1) chạy đầu tiên — Iron Law #2.**

## WAVE A — P0 local (~2–3h, không cần máy mới)

| ID | Task (nhỏ, 1 việc) | File chạm | Kiểm thử PASS khi |
|---|---|---|---|
| A1 | Backup dump đầu tiên: `bash Onpremise/scripts/backup.sh` (chạy từ Git Bash, stack đang UP) | `Onpremise/backup/` | File `cencom_*.sql.gz` > 0KB tồn tại |
| A2 | Verify dump: `pg_restore --list` đọc được + `gunzip -t` OK | (không sửa) | List ra >20 bảng, không lỗi |
| A3 | Restore test: tạo DB `cencom_restore_test` → restore → `COUNT xe = 42`, `COUNT users = 6` → DROP DB test | (không sửa) | Số khớp DB gốc |
| A4 | Cron: ghi dòng cron Ubuntu vào `Onpremise/README.md` + tạo Scheduled Task Windows tạm (tuần/lần, gọi backup) | `Onpremise/README.md` | Task tồn tại, chạy tay 1 lần ra file |
| A5 | Smoke 5 roles: mở rộng `smoke_onpremise.mjs` loop login admin/giamdoc/xuong/ketoan/kho (xác minh password seed trước) + dashboardAll mỗi role | `Onpremise/scripts/smoke_onpremise.mjs` | 5/5 login 200, RBAC đúng (xuong không thấy kế toán) |
| A6 | `GET /api/version` trả `{version: pkg.version}` (đọc tĩnh, như health) | `app/api/version/route.ts` (mới) | curl 200 qua nginx |
| A7 | Hardening headers: `productionBrowserSourceMaps: false` + `compiler.removeConsole` (giữ `error/warn`) trong `next.config.js` | `next.config.js` | build OK, bundle không còn `console.log`, 0 `.map` |
| A8 | `healthcheck.sh` về default v5 (`cencom_v5_web`/`cencom_v5_db`, URL 18443) như đã làm với backup.sh | `Onpremise/scripts/healthcheck.sh` | `bash healthcheck.sh` exit 0 |
| A9 | Chốt Wave A: `tsc` 0 + conformance 839/839 + smoke 6/6 (5 roles) + commit + CHANGELOG + memory | `CHANGELOG.md`, `docs/memory/` | CONF_EXIT=0, push main |

## WAVE B — Ubuntu vật lý (cần máy thật + anh ngồi cùng, ~0.5–1 ngày)

| ID | Task | Kiểm thử PASS khi |
|---|---|---|
| B1 | Pre-flight: Ubuntu 22.04/24.04, Docker + compose, copy repo (không mang `.env.*local`, `pg-portable`, `videos`), tạo `.env.onpremise.local` mới (secret random) | `docker --version` OK, env đủ key |
| B2 | UFW: `deny incoming`, allow 80/443 từ subnet LAN, 5432 chỉ localhost | `ufw status` đúng rule, scan ngoài không thấy 5432 |
| B3 | `bash scripts/init_db.sh` (migrate + seed 42 xe) | `SELECT COUNT xe=42` trên server |
| B4 | Trust cert: `init_certs.sh` + import `server.crt` vào 1 máy trạm test | Browser hết cảnh báo trên máy đó |
| B5 | Smoke 5 roles qua `https://<server-ip>` | 5/5 login 200 |
| B6 | Bật cron backup `0 2 * * *` + giữ 7–30 ngày | Sáng hôm sau có file mới |
| B7 | Rollback drill: tag image cũ → `docker compose up -d` bản cũ → health 200 → quay lại bản mới | Biết chắc cách quay lui khi deploy lỗi |

## WAVE C — Hardening (~1–1.5 ngày, song song được sau Wave A)

| ID | Task | File chạm | Ghi chú quyết định |
|---|---|---|---|
| C1 | Exceljs CVE: xác định advisory chính xác + đường khai thác (ghi qua export có auth) → **quyết**: (a) thay `xlsx` nếu rủi ro thật, hoặc (b) pin version + accept-risk có văn bản | `app/api/export/*`, tests `in_a4` | Không thay mù — assess trước |
| C2 | AI fallback chain: `ai_provider` thêm `models[]` thứ tự + retry/cooldown + log failover; UI hiện model đang dùng | `lib/ai.ts`, `lib/ai-config.ts`, `settings/ai` | Hết quota zen không treo chat |
| C3 | Monitoring tối thiểu: Uptime Kuma (1 container) hoặc `healthcheck.sh` + alert log | `docker-compose.monitoring.yml` hoặc Scheduled Task | Có alert khi health fail 3 lần liên tiếp |
| C4 | EULA tiếng Việt + LICENSE proprietary (draft, ghi rõ cần review pháp lý) | `EULA.md`, `LICENSE` | Chưa có là chưa bán được (§6 skill) |
| C5 | Obfuscation: chốt **defer** bằng văn bản (asar + no-map đủ cho LAN nội bộ; obfuscate tốn 15–80% perf + khó debug) | `docs/` (quyết định) | Không code |
| C6 | `npm outdated` review + `npm audit` lại + CHANGELOG + memory + commit | `CHANGELOG.md` | Không major vội (Next 16 là dự án riêng) |

## Ngoài scope đợt này (track riêng, cần anh)

- Help F1 (`docs/PLAN_HELP.md` — chờ anh duyệt nội dung)
- Hub máy sạch + Spoke LAN 2 máy (chờ anh thử Hub)
- Tunnel Cloudflare (anh hoãn), multi-tenant GĐ10, CI Actions tab (anh mở xem)

## Changelog phục vụ sau này

- Mỗi wave xong: append `CHANGELOG.md` + `docs/memory/CONTEXT.md`, commit message prefix `deploy-gaps:`.
- Wave B xong mới được tag release deploy (theo Iron Law #1).
