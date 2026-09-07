# CONTEXT — CencomOS Gara v5.4.0

> Trạng thái HIỆN TẠI ≤40 dòng. Cập nhật mỗi phiên.

## Status (2026-09-07)
- **Version**: 5.4.0 (tag `v5.4.0`); Wave A+B+C deploy-gaps DONE, HEAD `2230c56`+
- **Wave B DONE (WSL Ubuntu 26.04 — kịch bản máy đích)**: Docker WSL integration
  bật qua settings-store; deploy tách biệt `~/cencom-deploy` ports
  `25432/8080/8443` (không đụng stack Windows 18443); Node 20.20.2 trong Ubuntu;
  39 bảng + seed 42 xe/6 users (pattern "gara_root" bundle esbuild — tsx/esbuild
  không resolve `../lib` từ thư mục tách); smoke 5/5 login 200 qua 8443; cron
  backup 02:00 + restore khớp 42/6 + rollback tag `rollback-20260907`.
- **Wave A DONE (Windows dev)**: backup/restore/cron/smoke 5 roles + /api/version
  + HSTS + healthcheck v5 (chi tiết CHANGELOG Unreleased).
- **Wave C DONE**: AI fallback chain (models[] + cooldown 300s + log SLO); watchdog
  live (Task 5', test stop→UNHEALTHY→start→HEALTHY); LICENSE+EULA v1.0 draft;
  obfuscation DEFER có văn bản (`docs/DECISION_OBFUSCATION.md`).
- **Audit hiện trạng**: 4 vuln (next/postcss high — mitigated/unoptimized + LAN;
  exceljs/uuid moderate — chỉ ghi + transitive); qs patched; non-root container;
  standalone 0 `.map`; installer không secret.
- **Stacks đang chạy**: Windows 18443 (5.4.0) + WSL 8443 (5.4.0) song song, tách
  container/volume/secret hoàn toàn.
- **MCP**: opencode stdio ✓ 81 tools; HTTP cả 2 stack Bearer ON.

## Blockers
- Next 16 upgrade (2 HIGH CVE fix thật) = dự án riêng.
- EULA cần luật sư duyệt trước khi thương mại hóa.
- Máy khách thật (ngoài dev-space) khi triển khai production thực — kịch bản WSL
  đã mô phỏng đủ, mang theo `PLAN_DEPLOY_GAPS.md` + CHANGELOG Wave B là chạy được.

## Next Actions
1. Tag release deploy (sau khi anh duyệt Wave B).
2. Help F1 chờ duyệt (`docs/PLAN_HELP.md`); Hub máy sạch chờ anh thử.
3. Tunnel Cloudflare + multi-tenant GĐ10 — theo yêu cầu để sau.
