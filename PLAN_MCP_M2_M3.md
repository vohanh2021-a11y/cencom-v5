# PLAN_MCP_M2_M3 — Chuỗi thực thi B → A → D

> Basis: M1 hoàn tất (`PLAN_MCP_31.08.md`), conformance **296/296** (289 cũ + 7 MCP mới).
> MCP server: `gara_reconstruction_v5/mcp-server/` (stdio, 32 tool trùng tên fn RPC, version = package.json 5.0.0).
> Chỉ dùng worker-c / worker-d / worker-e (worker-a/b/f/g/h bị kẹt model free chết, không sửa được giữa phiên).

## Mục tiêu chuỗi
1. **B (M2):** TM6 (zod contracts + MCP strict input) + TM9 (CI gate version-consistency).
2. **A (Commit):** stage CHỈ file MCP/M2, bump version, commit, tag theo version-consistency.
3. **D (M3):** TM10 (UAT AI host thật, 5 câu tiếng Việt, video) + TM11 (adversarial security).

## Wave B (M2)
- **TM6a** (worker-e): `lib/contracts.ts` — `RPC_SCHEMAS` (zod ZodRawShape) cho các fn hay dùng + `zodShapeToJsonSchema()` + `getToolInputSchema(fn)`.
- **TM9a** (worker-c): `gara_reconstruction_v5/scripts/version-consistency.mjs` (pkg.version == git tag `vX.Y.Z`).
- **TM6b** (worker-c): `mcp-server/index.ts` dùng `getToolInputSchema(fn)` thay `z.record(z.unknown())` (strict validate arg).
- **TM9b** (worker-e): `.github/workflows/ci.yml` thêm step chạy `test:conformance` + `version-consistency`.
- **TM6c** (worker-e): `tests/conformance/contract.test.ts` (zod unit + MCP bad-arg rejection).
- **Gate B:** `tsc --noEmit`=0; `npm run test:conformance` xanh (thêm contract test); version-consistency pass.

## Wave A (Commit)
- Stage CHỈ: `gara_reconstruction_v5/mcp-server/*`, `lib/api.ts`, `lib/rpc.ts`, `app/api/rpc/route.ts`, `tests/conformance/mcp.test.ts`, `lib/contracts.ts`, `scripts/version-consistency.mjs`, `package.json`+lock, `AGENTS.md`, `tests/ux/evidence_29.08.md`, `PLAN_MCP_*.md`, `CHANGELOG_MCP.md`.
- Bump `package.json` version → `5.1.0` (khớp tag `v5.1.0`), re-run version-consistency.
- Commit message chuẩn; tag `v5.1.0`.

## Wave D (M3)
- **TM10** (worker-c): script client MCP hỏi 5 câu tiếng Việt (vd "SC-000003 thiếu bước gì?", "Liệt kê xe biển 51C-12345") → capture output + quay video (skill scenario-video-tutorial).
- **TM11** (worker-e): script adversarial: thử `scQuyetToan` trái quyền (role giamdoc), chèn SQL qua args (`sc_id:"SC-1'; DROP..."`), prompt-injection → assert bị chặn (isError / RBAC). Viết báo cáo `tests/ux/mcp_security_report.md`.
- **Gate D:** demo chạy được; báo cáo adversarial PASS.

## Ma trận file reservation
| File | Chủ |
|---|---|
| `lib/contracts.ts` | TM6a |
| `mcp-server/index.ts` | TM6b |
| `scripts/version-consistency.mjs` | TM9a |
| `.github/workflows/ci.yml` | TM9b |
| `tests/conformance/contract.test.ts` | TM6c |
| `package.json`(+lock) | A (bump version) |
