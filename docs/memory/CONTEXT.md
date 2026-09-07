# CONTEXT — CencomOS Gara v5.4.0

> Trạng thái HIỆN TẠI ≤40 dòng. Cập nhật mỗi phiên.

## Status (2026-09-07)
- **Version**: **v5.4.1 (tag release DEPLOY — đã push)**; Wave A+B+C deploy-gaps DONE
- **Final verification 9/9 PASS (deploy-governance §11)**: tag==pkg ✓, 0 .map ✓,
  health+version cả 2 stack ✓, backup 2 môi trường ✓, tag remote ✓.
- **Wave B DONE (WSL Ubuntu 26.04 — kịch bản máy đích)**: Docker WSL integration
  bật qua settings-store; deploy tách biệt `~/cencom-deploy` ports
  `25432/8080/8443` (không đụng stack Windows 18443); Node 20.20.2 trong Ubuntu;
  39 bảng + seed 42 xe/6 users (pattern "gara_root" bundle esbuild); smoke 5/5
  login 200 qua 8443; cron backup 02:00 + restore khớp 42/6 + rollback tag.
  ⚠ Bài học: bind volume `./relative` chết khi daemon restart — WSL compose đã
  chuyển named volume; data sống nhờ cron backup.
- **Wave A DONE (Windows dev)**: backup/restore/cron/smoke 5 roles + /api/version
  + HSTS + healthcheck v5.
- **Wave C DONE**: AI fallback chain (models[] + cooldown 300s + log SLO); watchdog
  live (Task 5'); LICENSE+EULA v1.0 draft; obfuscation DEFER có văn bản
  (`docs/DECISION_OBFUSCATION.md`).
- **Audit hiện trạng**: 4 vuln (next/postcss high — mitigated/LAN; exceljs/uuid
  moderate — chỉ ghi); qs patched; non-root; 0 `.map`; installer không secret.
- **Stacks đang chạy**: Windows 18443 + WSL 8443, đều 5.4.0 healthy (image bake
  trước khi bump 5.4.1 — version bump chỉ metadata, lần deploy kế bake mới).
- **MCP**: opencode stdio ✓ 81 tools; HTTP cả 2 stack Bearer ON.

## Blockers
- Next 16 upgrade (2 HIGH CVE fix thật) = dự án riêng.
- EULA cần luật sư duyệt trước khi thương mại hóa.
- Máy khách thật (ngoài dev-space) — mang `PLAN_DEPLOY_GAPS.md` + CHANGELOG
  Wave B + MEMORY lesson (named volume!) là chạy được.

## Next Actions
1. Help F1 chờ duyệt (`docs/PLAN_HELP.md`); Hub máy sạch chờ anh thử.
2. Tunnel Cloudflare + multi-tenant GĐ10 — theo yêu cầu để sau.
