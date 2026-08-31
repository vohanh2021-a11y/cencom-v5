# CHANGELOG MCP — gara_reconstruction_v5

Theo dõi chuỗi **B → A → D** + hoàn thiện M2 thiếu (TM7/TM8) + đề xuất a/b/c.
Trạng thái: pending | in_progress | done | blocked.

## M1 (đã xong — tag v5.0.0)
- [done] TM1–TM5: buildApi/getRegistry, mcp-server scaffold, parity test 7/7 (296/296), README+AGENTS.

## B — M2 (zod contracts + CI) — DONE
- [done] TM6a/b/c + TM9a/b → Gate B: tsc=0, version-consistency OK, full conformance **318/318**.

## A — Commit — DONE
- [done] bump 5.1.0, commit `65e8722` (25 files), tag `v5.1.0`.

## D — M3 (UAT + adversarial) — DONE
- [done] TM10 demo 5/5; TM11 adversarial 4/4 PASS.

## M2 thiếu — ĐANG LÀM
- [in_progress] TM7 — `mcp-server/resources.ts` + `prompts.ts` (sc://, xe://, prompt QC206), đăng ký trong index.ts, test.
- [in_progress] TM8 — `mcp-server/http.ts` (Streamable HTTP + Bearer auth), `Onpremise/docker-compose.mcp.yml`, `Onpremise/nginx/mcp.conf`, docs LAN.

## Đề xuất a/b/c
- [pending] (a) commit D + M2(tm7/tm8) artifacts (chỉ file MCP, không kéo đống cũ).
- [blocked] (b) push GitHub để CI chạy — **BỊ CHẶN: `git remote -v` rỗng (không có remote)**. Cần user thêm remote hoặc cung cấp URL. Workflow CI (TM9b) đã sẵn sàng chạy khi có remote.
- [pending] (c) tạo `mcp-server/mcp.json.example` (config cho opencode/Claude Desktop) + docs.

## Tổng kết đến nay
- MCP v1: 32 tool trùng tên fn, version 5.1.0, RBAC + audit channel=mcp.
- Conformance **318/318 GREEN**; version-consistency OK; tag v5.1.0.
- Thiếu: remote git (cho b); TM7/TM8 đang làm.
