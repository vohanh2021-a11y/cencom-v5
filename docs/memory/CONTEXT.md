# CONTEXT — CencomOS Gara v5.3.0

> Trạng thái HIỆN TẠI ≤40 dòng. Cập nhật mỗi phiên.

## Status (2026-09-04)
- **Version**: 5.3.0 (chưa tag, commit GĐ6+GĐ9 đang push)
- **Git**: `main` — HEAD GĐ6+GĐ9 (sau `5112401` GĐ polish)
- **GĐ6 HOÀN THÀNH**: phân trang scList/vattuList/xeList/baogiaList/hoSoList +
  ledgerReport cache 5' + pg_trgm GIN + export semaphore/cap.
- **GĐ9 HOÀN THÀNH (Windows/Docker Desktop)**: stack 4/4 healthy qua nginx
  18443; smoke_onpremise.mjs PASS 6/6 (login→MCP tools/call xe:42).
- **Conformance**: 28 suites, **777 pass / 0 FAIL** (CONF_EXIT=0 — isolated
  runner; số 839 cũ là metric khác cách đếm, nguồn hiện tại = 777+3 fail fixed).
- **Docker**: `cencom_v5_pg` (5432 dev) + stack on-prem chạy song song
  `cencom_v5_{db,mcp,web,nginx}` qua 18443.

## Blockers
- Ubuntu THẬT vẫn chưa chạy (mọi thứ verify trên Docker Desktop Windows —
  node:20-slim, overlayfs, cert mount đều chuẩn Linux rồi, rủi ro thấp còn lại
  = firewall + systemd path).
- Electron NSIS CHƯA rebuild sau menu-bar (chỉ cosmetic build-artifact).

## Next Actions
1. Tag v5.3.0 + deploy thử Ubuntu thật: copy repo → `Onpremise/scripts/init_certs*`
   → `bash scripts/init_db.sh` → `node scripts/smoke_onpremise.mjs`.
2. `npm run build:electron` cho installer mới.
3. GĐ7 backup verify (pg_dump container db qua cron thật) — GĐ10 multi-tenant
   chỉ khi có khách thứ 2.
