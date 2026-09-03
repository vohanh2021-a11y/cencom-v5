# Patterns — CencomOS Gara v5.2.0

> Design patterns đã áp dụng, anti-patterns tránh.

## ✅ Patterns đã dùng

### WithTransaction (Race Condition Fix)
- `lib/db.ts` — `withTransaction(fn)` đảm bảo atomic + row-guard
- `ton >= sl RETURNING` trong `nhapKho/xuatKho/dmNhap` — atomic check+act
- **WHY**: v3.6 có race condition khi 2 user xuất cùng lúc → âm tồn kho

### FN_LIST Registry
- `lib/rpc.ts` — mỗi fn đăng ký `{name, module, action, handler}`
- Tên fn = tên MCP tool = tên API endpoint
- **WHY**: single source of truth, tránh mismatch giữa RPC/MCP/API

### Zod Contracts (getToolInputSchema)
- `lib/contracts.ts` — mỗi shape trả về **Zod object** (không phải JSON schema)
- `z.object({...}).passthrough()` cho unknown fields
- **BUG PATTERN**: ban đầu trả JSON → runtime error `inputSchema must be Zod`

### Single-Flight Cache
- `lib/cache.ts` — `cacheGet(key, ttl, fetchFn)` = dedupe concurrent requests
- TTL 60s cho KPI xưởng
- **WHY**: tránh N+1 queries + thundering herd

### Snapshot Pattern (sc_phien_ban)
- `sc_phien_ban` — snapshot bất biến sau `scTongDuyet`
- Chặn sửa SC sau khi chốt
- **WHY**: audit trail, không mất dữ liệu lịch sử

### Registry-Dynamic MCP Tools
- `server-core.ts` — loop `TOOL_DOCS` → `registerTool()` tự động
- Không hardcode count (test assertion: `toBeGreaterThan(50)`)
- **WHY**: thêm fn mới → MCP auto-mirror, không cần sửa MCP code

## ❌ Anti-patterns cần tránh

- **Check-then-act**: `SELECT ton` → `UPDATE ton = ton - sl` (race!) → Dùng `WHERE ton >= sl RETURNING`
- **Fire-and-forget**: goi async mà không await → treo, mất lỗi
- **Hardcode secrets**: API key trong code → dùng `.env` + `.gitignore`
- **N+1 queries**: loop goi query từng record → dùng JOIN/batch
