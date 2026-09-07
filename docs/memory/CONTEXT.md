# CONTEXT — CencomOS Gara v5.4.0

> Trạng thái HIỆN TẠI ≤40 dòng. Cập nhật mỗi phiên.

## Status (2026-09-07)
- **Version**: 5.4.0 (tag `v5.4.0`); Wave A+C deploy-gaps đã commit `b956591`
- **Git**: `main` HEAD `b956591` — plan: `docs/PLAN_DEPLOY_GAPS.md`
- **Wave A DONE (verify thật)**: backup dump đầu tiên → restore khớp `xe=42/users=6`
  → cron README + Task `CencomV5Backup` chạy ra file; smoke **5 roles + RBAC spot**
  PASS (giãn 65s né rate-limit); `/api/version` live; HSTS + 1 bộ headers;
  healthcheck.sh default v5 + PORT_NGINX; backup.sh/restore.sh/pg_backup.sh v5.
- **Wave C DONE**: AI fallback chain (models[] + cooldown 300s + log SLO, UI nhập
  model dự phòng); watchdog.cmd live (Task 5', HEALTHY/UNHEALTHY streak, ALERT≥3,
  đã test stop web → UNHEALTHY → start → HEALTHY); LICENSE + EULA v1.0 (draft);
  obfuscation DEFER có văn bản (`docs/DECISION_OBFUSCATION.md`).
- **Audit hiện trạng**: 4 vuln (next/postcss high — mitigated/unoptimized + LAN;
  exceljs/uuid moderate — chỉ ghi + transitive); qs đã patch; node 20 trong
  Dockerfile là non-root; standalone 0 `.map`; installer không chứa secret.
- **MCP**: opencode stdio ✓ connected (81 tools); HTTP on-prem Bearer ✓ smoke.
- **Hạ tầng dev**: stack on-prem 4/4 healthy qua `18443`; backup/`UNHEALTHY_STREAK`
  trong `Onpremise/backup/` (gitignored).

## Blockers
- **Wave B (Ubuntu)**: chờ chạy trong WSL Ubuntu (máy dev là dev-space, KHÔNG
  phải nơi triển khai thật — theo yêu cầu; kịch bản máy đích = WSL Ubuntu).
- Next 16 upgrade (2 HIGH CVE fix thật) = dự án riêng.
- EULA cần luật sư duyệt trước khi thương mại hóa.

## Next Actions
1. Wave B qua WSL: bật Docker Desktop WSL integration (Ubuntu) → deploy thư mục
   riêng (ports 8080/8443/25432) → init certs/node20 → init_db → smoke 5 roles
   → cron backup thật trong Ubuntu → rollback drill.
2. Sau Wave B: tag release deploy + cập nhật INTEGRATION_DEPLOY/README.
3. Help F1 chờ duyệt (`docs/PLAN_HELP.md`); Hub máy sạch chờ anh thử.
