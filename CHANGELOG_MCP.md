# CHANGELOG MCP — gara_reconstruction_v5

Theo dõi chuỗi **B → A → D** (kế thừa M1). Trạng thái: pending | in_progress | done | blocked.

## M1 (đã xong — tham chiếu)
- [done] TM1 — `lib/api.ts` (buildApi) + `lib/rpc.ts` (getRegistry) + route refactor → 289/289
- [done] TM2/TM3 — `mcp-server/` scaffold (index/auth/env/tool-docs) → tsc=0, smoke 32 tools
- [done] TM4 — `tests/conformance/mcp.test.ts` → 7/7, conformance **296/296**
- [done] TM5 — `mcp-server/README.md` + `AGENTS.md` note + evidence

## B — M2 (zod contracts + CI) — DONE
- [done] TM6a — `lib/contracts.ts` (RPC_SCHEMAS 19 fn + converter + getToolInputSchema)
- [done] TM9a — `scripts/version-consistency.mjs` (pkg.version == git tag)
- [done] TM6b — `mcp-server/index.ts` dùng `getToolInputSchema` (Zod strict input)
- [done] TM9b — `.github/workflows/ci.yml` (postgres service + version-consistency + mcp parity)
- [done] TM6c — `tests/conformance/contract.test.ts` (22 test: zod unit + MCP bad-arg rejection)
- [done] **Gate B**: tsc=0; `version-consistency` OK; full conformance **318/318 GREEN**

## A — Commit — IN PROGRESS
- [done] bump version 5.0.0 → 5.1.0
- [in_progress] git commit (chỉ file MCP/M2) + tag `v5.1.0`

## D — M3 (UAT + adversarial) — PENDING
- [pending] TM10 — demo 5 câu tiếng Việt qua AI host thật + video
- [pending] TM11 — adversarial security report (SQLi / RBAC bypass / prompt-injection)
- [pending] Gate D (demo chạy được + báo cáo PASS)
