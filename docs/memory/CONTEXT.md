# CONTEXT — CencomOS Gara v5.2.0

> Trạng thái HIỆN TẠI ≤40 dòng. Cập nhật mỗi phiên.

## Status (2026-09-03)
- **Version**: 5.2.0 (tag `v5.2.0` trên GitHub `vohanh2021-a11y/cencom-v5`)
- **Git**: `main` branch, working tree CLEAN
- **Docker**: `cencom_v5_pg` Up 2+ ngày
- **CI**: `ci.yml` xanh trên `ab9fcfa`; 3 workflow phụ đã fix (ci-cd→legacy, deploy.yml, uat-video.yml)
- **Electron**: Desktop wrapper hoàn thành (NSIS 84MB)
- **Conformance**: 714/714 (27 suites), e2e 13/13

## Blockers
- On-premise: `nginx.conf` upstream cũ (`cencom-web:3000`) cần sửa thành `web:3000`
- Chưa test `docker compose up` thật trên Ubuntu (cần cert self-signed)
- Chưa code-signed installer (cần EV cert)

## Next Actions
1. Fix `Onpremise/nginx/nginx.conf` upstream → `web:3000` + `mcp:3001`
2. Test on-premise deploy: `docker compose up -d` → verify `/api/health` + `/mcp`
3. Chốt 3 quyết định: TK thăm khám (W3.9), gộp monorepo v4, export CSV→Excel
