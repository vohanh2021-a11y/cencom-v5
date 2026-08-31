# PLAN_MCP_31.08 — Bọc gara_reconstruction_v5 thành MCP Server (Web ↔ Core ↔ MCP đồng nhất)

> Người duyệt: chủ dự án. Orchestrator thực thi theo từng Wave.
> Ngày lập: 2026-08-31. Basis: v5.0.0 (tag `v5.0.0`, commit `6bc321a`).

---

## PHẦN 1 — NGUYÊN NHÂN & MỤC ĐÍCH

### 1.1 Nguyên nhân (tại sao làm)
1. **Con người không kịp kiểm soát hết thao tác** (ý người dùng): cần AI hỗ trợ tra soát/vận hành, nhưng AI phải đi qua **cùng cửa phân quyền** như người, không后门 riêng.
2. App đã có **RPC registry thuần** (`FN_LIST` 36 fn + `META` quyền + `HANDLERS`) →包住 thành MCP cực rẻ, không cần viết API mới.
3. Nếu MCP định nghĩa tool **xà lách** (tự đặt tên riêng), về sau người/AI sẽ **nhầm tool, hiểu nhầm ý nhau** giữa web và AI. → Bắt buộc **đồng nhất tên + version** ngay từ đầu.

### 1.2 Mục đích (thành đo được)
- GĐ1: `mcp-server` (stdio) expose **đúng 36 tool trùng tên fn RPC**, version `serverInfo` == `package.json` == `appInfo.result.version`.
- GĐ2: AI (opencode/Claude Desktop) hỏi "SC-000003 thiếu bước gì?" → gọi `hoSoCheck` → trả lời đúng, **vẫn bị RBAC chặn** nếu token role không đủ quyền.
- GĐ3: Test **parity** WEB-vs-MCP chạy trong `npm run test:conformance` (xanh trước khi merge); sửa core không phải làm lại MCP.
- Ràng buộc: **không sửa logic nghiệp vụ**, không phá 289 test hiện có, không hardcode secret.

### 1.3 Nguyên tắc đồng nhất (ANTI-CONFUSION CONTRACT)
| Loại | Nguồn duy nhất | Bắt buộc |
|---|---|---|
| Tool name | chuỗi key trong `FN_LIST` / `META` | MCP tool name === RPC fn name **từng ký tự** (`hoSoCheck`, không phải `hoso_check`) |
| Quyền | `META` → `requirePerm/can` | MCP đi qua cùng `Api.perm`, default-deny |
| Phiên bản | `package.json: 5.0.0` | 3 chỗ đọc từ đây: appInfo, `serverInfo.version`, banner log; CI grep đối chiếu |
| Tài liệu tool | `mcp-server/tool-docs.ts` (mới) | description song ngữ; mỗi fn PHẢI có, thiếu là test đỏ (test `docs-completeness`) |
| Tên test | `tests/conformance/mcp_*.test.ts` | tên test khớp fn được test |

---

## PHẦN 2 — KIẾN TRÚC TRIỂN KHAI

```
                ┌──────────────────────────────┐
   Browser ────▶│ Next.js  :3003               │
                │  app/api/rpc/route.ts ──┐    │
                └─────────────────────────┼────┘
                                          ▼
                          ┌────────────────────────────┐
                          │ lib/api.ts (MỚI) buildApi() │
                          │ lib/rpc.ts  FN_LIST/META/   │
                          │             HANDLERS (export│
                          │             getRegistry())  │
                          └──────────────┬─────────────┘
                                         ▼
              ┌──────────────────────────────────────────┐
              │ lib/core/* (KHÔNG ĐỔI) ──── PG :5432      │
              └──────────────▲───────────────────────────┘
                             │ import trực tiếp (không qua HTTP)
                ┌────────────┴─────────────┐
                │ mcp-server/ (stdio, tsx)  │◀── AI client (opencode/Claude)
                │  index.ts  tools từ registry
                │  auth.ts   service-account (.env.mcp)
                │  tool-docs.ts descriptions
                └──────────────────────────┘
```

**Quyết định thiết kế:**
- MCP **import core trực tiếp** (process `tsx` riêng) — KHÔNG fetch `localhost:3003/api/rpc` → frontend có đổi, MCP vẫn sống (đã论证 trong nghiên cứu).
- Auth: **service-account** đăng nhập bằng `login()` sẵn có, token session ký bằng `signSession`, actor lưu trong process MCP. Credential ở `mcp-server/.env.mcp` (**gitignored**). Role khởi đầu đề xuất `giamdoc` (chỉ xem + activityFeed) → nâng dần khi duyệt. env `MCP_WRITE_TOOLS=scCreate,keHoachSave,...` làm allowlist tool GHI (mặc định rỗng = chỉ đọc).
- 4 fn OPEN (login/logout/currentUser/appInfo): loại khỏi MCP tool list (vô nghĩa với AI) — ghi rõ trong docs + test.
- Audit: mọi call MCP prepend `channel=mcp` vào `logActivity` → người truy vết được AI làm gì.

---

## PHẦN 3 — WAVE & TASK CHI TIẾT (ai spawn, file nào, gate nào)

> ⚠️ **QUY TẮC MODEL (cập nhật 31.08 — chỉ thị người dùng):** TOÀN BỘ worker-a..h đã đồng nhất `model: 2009/qwen3.8-flash` = đúng model cửa sổ phiên chính (sửa frontmatter `agent/worker-*.md`; backup: `agent_backup_31.08/` + `opencode-swarm.json.bak-31.08`). Lý do: model free cũ chết lẻ tung (worker-a/deepseek-v4-flash-free, worker-b/qwen3.6-plus-free — lỗi "Model not found" thực đo).
> **CHẾ ĐỘ auto-kill/respawn (orchestrator thực hiện — opencode 1.18 không có automaticModelFallback):** nếu task trả `Model not found` / quota 429 / 5xx / kết quả rỗng / timeout >45s → coi agent CHẾT → kill, cooldown 10s, respawn cùng worker-type (tối đa 2 lần/task); vẫn đỏ → DỪNG, escalate người dùng kèm log. Không "sửa nóng" gate đỏ.
> **File reservation**: 2 agent không sửa chung 1 file; chung `package.json` → serialize.

### WAVE M1 — Lõi (registry → scaffold → auth → parity test)

**TM1 — Refactor dùng chung registry/buildApi** *(đầu tiên, serialize)*
- Subagent: `worker-c`. Files: `lib/api.ts`(MỚI), `lib/rpc.ts`(thêm `export getRegistry()`), `app/api/rpc/route.ts`(dùng buildApi).
- Step:
  1. Đọc route.ts hiện tại → tách hàm tạo `Api{db,auth,perm}` vào `lib/api.ts: buildApi(actor)`.
  2. `rpc.ts`: export `getRegistry(): {FN_LIST, META, HANDLERS}`.
  3. Route.ts gọi buildApi — hành vi HTTP y hệt.
- Gate verify: `npx tsc --noEmit`=0, `npm run lint`=0, `npm run test:conformance`=289/289. Lattice đỏ → KHÔNG cho TM2 chạy.

**TM2 — Scaffold mcp-server + auto-generate tools + docs** *(sau TM1)*
- Subagent: `worker-c`. Files: `mcp-server/index.ts`, `mcp-server/tool-docs.ts`, `package.json`(thêm deps `@modelcontextprotocol/sdk` + script `"mcp": "tsx mcp-server/index.ts"`).
- Step:
  1. `npm i @modelcontextprotocol/sdk`.
  2. `tool-docs.ts`: `Record<fnName, {vi,en,params}>` cho 32 fn (trừ 4 OPEN) — đủ để test completeness đỏ nếu thiếu.
  3. `index.ts`: Server MCP (stdio) — `tools/list` sinh từ `getRegistry().FN_LIST` ∩ `tool-docs` ∖ OPEN; `serverInfo{name:"cencom-gara-v5", version: pkg.version}`.
  4. `tools/call` tạm gọi thẳng HANDLERS với actor placeholder (TM3 thay auth thật).
- Gate: `npx tsx mcp-server/index.ts` sống 5s không crash (echo test qua SDK client trong TM4 check); tsc=0.

**TM3 — Auth service-account + write-allowlist + audit channel** *(song song TM2, file không chồng)*
- Subagent: `worker-e`. Files: `mcp-server/auth.ts`, `mcp-server/.env.example`, `.gitignore`(thêm `mcp-server/.env.mcp`).
- Step:
  1. `.env.example`: `MCP_USER=mcp-bot MCP_PASS=... MCP_ROLE=giamdoc MCP_WRITE_TOOLS=`.
  2. `auth.ts`: `login()` core tạo actor; build `Api` bằng `buildApi` (TM1); check user tồn tại/đúng role, không thì exit 1.
  3. Gate ghi: fn不在 `MCP_WRITE_TOOLS` → trả lỗi `403 write tool disabled` TRƯỚC khi vào HANDLERS (RBAC core vẫn là lớp 2).
  4. Mọi call: `logActivity('INFO','mcp_call',{fn, actor, channel:'mcp'})`.
- Gate: tsc=0; login fail → process exit rõ message.
- ⚠ Chung `.gitignore`/`package.json` với agent khác → orchestrator serialize: chạy sau TM2 xong mới merge.

**TM4 — Test đồng nhất + parity (TRÁI TIM chống "nhầm tool")**
- Subagent: `worker-e`. File: `tests/conformance/mcp.test.ts` (MỚI — runner `test:conformance` tự pick).
- Step (spawn MCP qua `StdioClientTransport` trong test):
  1. `tools/list` → assert: names == sorted(`FN_LIST` trừ OPEN) — **đồng nhất tên**; KHÔNG có tool thừa/thiếu.
  2. `serverInfo.version` == `package.json.version` — **đồng nhất version**.
  3. docs-completeness: mỗi tool có description vi+en.
  4. Parity: cùng SC is_test → `hoSoCheck` qua MCP === goi truc tiep core (deep-equal JSON).
  5. RBAC qua MCP: service-account role `giamdoc` go `scCreate` → 403 (write allowlist + core perm), go `scList` → 200.
  6. Edge: go tool ten `hoso_check` (sai kieu) → unknown tool.
- Gate: `npx jest tests/conformance/mcp.test.ts --runInBand --forceExit` xanh (can PG + env).

**TM5 — Docs + hướng dẫn kết nối AI host**
- Subagent: `worker-g`. Files: `mcp-server/README.md`, cập nhật `AGENTS.md`(thêm mục MCP ngắn), `tests/ux/evidence_29.08.md`(append mục MCP).
- Nội dung README: bảng 36 fn ↔ tool ↔ perm ↔ write/read; config `mcp.json` cho opencode/Claude Desktop; quy trình "them ham moi = 3 buoc rpc.ts + tool-docs + test, khong code MCP moi".

### WAVE M2 — Nâng cao (SAU KHI M1 XANH + người duyệt)
- **TM6** `lib/contracts.ts`: zod schema CHUNG cho args các fn hay dùng (scCreate, keHoachSave...) — web validate TRƯỚC khi gọi rpc + MCP `inputSchema` sinh từ cùng zod. (worker-c, TDD trước.)
- **TM7** MCP Resources (`sc://<id>`, `cooperation://...`) + Prompts ("Hồ sơ SC chuẩn QC206"). (worker-e)
- **TM8** Chế độ SSE/HTTP trên LAN (nginx auth bằng session cookie) cho AI chạy máy khác + `Onpremise` compose service optional. (worker-c)
- **TM9** CI gate: step 4 trong `ci.yml` thêm `npx jest tests/conformance/mcp.test.ts`; thêm bước `version-consistency.sh` (grep tag==package.json==appInfo). (worker-d)

### WAVE M3 — Vận hành thử (UAT bằng AI)
- **TM10** Kịch bản demo: 5 câu lệnh tiếng Việt qua AI host → video/ảnh chụp bằng chứng (skill `scenario-video-tutorial`). (worker-c)
- **TM11** Đánh giá bảo mật đối thủ (adversarial): thử ép MCP `scQuyetToan` trái quyền, chèn SQL qua args, prompt-injection ⇒ báo cáo. (worker-f)

---

## PHẦN 4 — MA TRẬN FILE RESERVATION (tranh đè khi song song)

| File | Chủ |
|---|---|
| `lib/api.ts`(new), `app/api/rpc/route.ts`, `lib/rpc.ts` | TM1 |
| `mcp-server/index.ts`, `tool-docs.ts`(new), `package.json`+lock | TM2 |
| `mcp-server/auth.ts`, `.env.example`, `.gitignore` | TM3 |
| `tests/conformance/mcp.test.ts` | TM4 |
| `mcp-server/README.md`, `AGENTS.md`, evidence | TM5 |

## PHẦN 5 — RỦI RO & PHÒNG
1. **Đổi fn name sau này** = breaking cho AI đã "học" → quy trình: thêm alias tool + deprecate 2 version, bump minor (5.1→5.2), ghi CHANGELOG. Test đồng nhất sẽ báo đỏ ngay khi tên lệch.
2. **AI gọi tool ghi bừa** → mặc định `MCP_WRITE_TOOLS` rỗng (read-only); viết từng tool theo duyệt của người; RBAC core lớp 2; audit `channel=mcp` lớp 3; log không chứa pass/token.
3. **MCP import core chạy ngoài Next** → cần env (`DATABASE_URL, SESSION_SECRET`) qua `.env.mcp`; nếu tsx không resolve alias `@/` → import tương đối `../lib/...`.
4. **Không phá bàn giao**: sau mỗi Task, 289/289 vẫn là gate; vỡ → revert Task đó, không "sửa nóng".

## PHẦN 6 — ĐỊNH NGHĨA HOÀN THÀNH
- M1 xong khi: `npm run mcp` sống + `mcp.test.ts` xanh trong runner + README + người đã duyệt allowlist write.
- Toàn plan xong khi: TM11 adversarial PASS + AI host thật (opencode) demo được 5 câu hỏi tiếng Việt.
