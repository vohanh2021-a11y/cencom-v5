# PLAN 4.9 — Hub-and-Spoke + Offline SQLite + AI Nhúng (04.09.2026)

> **Mục tiêu**: Ra **sản phẩm chạy được ngay** trên 1 HUB Win 10/11 64-bit + 3-5 Spoke LAN, không cần Internet ở Spoke, đồng bộ có xác nhận, MCP LAN cho trưởng phòng, AI nhúng tại HUB (đọc data nội bộ + vision hóa đơn viết tay). Cloudflare Tunnel để sau.

---

## 1. Mô hình chốt

```
Spoke (Thin, SQLite tạm) ── LAN (192.168.1.x, offline OK) ──► HUB (All-in-One)
  Electron nhẹ ~45MB                                    Electron Hub ~280MB
  - Không có PG                                         - Portable PG 16 (data %APPDATA%/CencomOS/data)
  - SQLite %APPDATA%/CencomOS/spoke.db                  - Next.js standalone + Nginx LAN 80/443
  - Queue: sc_draft, vattu_draft, sync_queue            - MCP HTTP :3001 (LAN) + stdio (opencode dev)
  - Khi offline: ghi vào SQLite, badge "Chưa đồng bộ"   - AI Settings + Chat + Vision OCR
  - Khi online: nút "Đồng bộ" → xác nhận từng dòng     - Backup 1-click, tunnel client (tắt mặc định)
                                                        - Là nguồn duy nhất (Spoke không tự quyết)
```

**Luồng dữ liệu**: Spoke nhập → SQLite `sync_queue(status='pending')` → khi online `POST /api/sync/push` → HUB validate (Zod + RBAC) → trả `conflicts[]` → Spoke hiển thị dialog xác nhận → `POST /api/sync/confirm` → HUB `withTransaction` ghi PG → Spoke `status='synced'` + `pull` delta.

**MCP**: Trưởng phòng chạy AI trên máy khác trong LAN → `MCP_TRANSPORT=http` trỏ `http://HUB_IP:3001/mcp` + Bearer `MCP_API_KEY` → đọc toàn bộ 81 tools từ HUB PG (không cần DB riêng).

---

## 2. Cần bổ sung gì? (Gap Analysis)

| # | Hạng mục | Hiện có | Thiếu | Mức độ |
|---|---|---|---|---|
| **A** | **HUB all-in-one** | Electron wrap + standalone bundle, nhưng `DATABASE_URL` phải có sẵn PG ngoài | Portable PG 16 win-x64 + `initdb` lần đầu + `pg_ctl` lifecycle trong `main.js` + `%APPDATA%` data dir + backup/restore UI | **BẮT BUỘC** |
| **B** | **Spoke thin client** | Chưa có — chỉ có 1 Electron app duy nhất | Project `electron-spoke/` riêng (hoặc cùng repo với flag `HUB_MODE=0/1`), config `hubUrl` (input IP), không bundle PG/standalone | **BẮT BUỘC** |
| **C** | **SQLite offline** | Chưa có | `better-sqlite3` trong Spoke, schema mirror tối thiểu (`sc_draft`, `sync_queue`), DAO + migration | **BẮT BUỘC** |
| **D** | **Sync engine** | Chưa có | HUB: `app/api/sync/*` (push/confirm/pull + Zod + `withTransaction` + audit), Spoke: queue + retry + dialog xác nhận | **BẮT BUỘC** |
| **E** | **AI Settings tại HUB** | Chưa có UI | Trang `app/(app)/settings/ai/page.tsx` — form `provider / model / baseURL / apiKey` (openAI compatible), `testConnection` (fetch `/v1/models`), lưu mã hóa `config` table (`key='ai_provider'`, value encrypt AES-256-GCM với `SESSION_SECRET`) | **BẮT BUỘC** |
| **F** | **AI nhúng (chat trong phạm vi data)** | Chưa có — chỉ có MCP tools | `lib/ai.ts` + `app/api/ai/chat/route.ts` — system prompt khóa phạm vi (“chỉ trả lời từ tồn kho/công nợ/SC… nếu ngoài phạm vi thì từ chối”), tool-calling qua MCP registry hoặc direct `q()` với RAG hạn chế; UI chat dock tại HUB | **BẮT BUỘC** |
| **G** | **Vision hóa đơn viết tay (báo giá)** | `baogia` chỉ nhập tay, chưa có OCR | Nút “Upload ảnh hóa đơn” tại `app/(app)/baogia` → `POST /api/ai/vision` → gọi provider vision (mimo-v2.5-flash-free / Muse Spark 1.2) với `image_url` + prompt extract JSON → điền form `baogiaSave` để user xác nhận | **BẮT BUỘC** |
| **H** | **MCP LAN** | Đã xong (stdio + HTTP 81 tools, smoke 6/6 qua nginx) | Chỉ cần đảm bảo HUB `MCP_API_KEY` được Spoke/trưởng phòng dùng đúng IP `HUB_IP:3001` | Đã xong |
| **I** | **Cloudflare Tunnel** | `init_certs.sh` + `mcp.json.example` có, chưa cấu hình | **Để sau** — HUB chạy `cloudflared tunnel --url http://localhost:3000` khi anh cấp token, không block release 4.9 | Hoãn |
| **J** | **RBAC** | 450+ rules, 5 vai đã có | Dùng nguyên, Spoke gửi kèm `actor` như HUB (không tự phân quyền) | Đã xong |

**Kết luận**: Làm xong A-G là **hoàn chỉnh và chạy được ngay** trên LAN không Internet. I để sau không ảnh hưởng.

---

## 3. Kiến trúc chi tiết

### 3.1 HUB (electron-hub)

```
electron-hub/
  main.js          — before app.whenReady(): ensureDataDir() → initdb nếu chưa có → pg_ctl start -D %APPDATA%/CencomOS/hub-data -l hub-pg.log
                   — spawn Next standalone với env DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/cencom (port PG portable mặc định 5432, tránh xung đột với dev PG thì dùng 5433 + config)
                   — on quit: pg_ctl stop
  package.json     — extraResources: [standalone, pg-portable/win-x64, cloudflared.exe (optional)]
  build.nsis       — oneClick false, perMachine false, data dir ngoài installer
```

**DB**: Portable PG tải từ `https://get.enterprisedb.com/postgresql/postgresql-16.x-win64-binaries.zip` (~35MB nén, ~120MB giải nén) — đặt `electron/pg-portable/`. Lần đầu: `initdb -U postgres -D <dataDir> --no-locale --encoding=UTF8`. Mỗi lần mở app: `pg_isready` → nếu chưa chạy thì `pg_ctl start`.

**Backup**: Nút HUB `Cài đặt → Sao lưu` → `pg_dump -Fc -f %APPDATA%/CencomOS/backup/cencom-YYYYMMDD.dump` + `Chọn nơi lưu`.

### 3.2 Spoke (electron-spoke)

```
electron-spoke/
  main.js          — KHÔNG spawn PG/Next, chỉ tạo BrowserWindow trỏ http://HUB_IP (đọc từ %APPDATA%/CencomOS/spoke-config.json)
  preload.js       — expose `spokeAPI`: { getHubUrl, setHubUrl, dbAll, dbRun, queuePush, queueList, syncNow }
  db/sqlite.ts     — better-sqlite3, file %APPDATA%/CencomOS/spoke.db
    tables: sync_queue(id, type, payload JSON, status pending/confirmed/synced/failed, created_at, synced_at)
            sc_draft, vattu_draft (cache read-only từ HUB pull)
  sync/push.ts     — POST /api/sync/push {items} → HUB trả {accepted[], conflicts[]}
  sync/confirm.tsx — Dialog: “3 dòng xung đột — HUB đã có SC-000123 mới hơn, ghi đè?” [Đồng ý]/[Bỏ]
```

**Offline UX**: Header badge `● Offline (3 chưa đồng bộ)` (navigator.onLine + fetch HEAD /api/health qua LAN). Nút `Đồng bộ` chỉ enable khi online.

### 3.3 Sync API (HUB)

```
POST /api/sync/push   — body {items: {id, type, payload, client_ts}[]} → validate Zod → check RBAC → trả {accepted, conflicts: {id, reason, serverRow}}
POST /api/sync/confirm — body {ids[]} → withTransaction ghi PG + audit → trả {ok}
GET  /api/sync/pull?since=<ts> — delta pull cho Spoke làm mới cache (optional, v1 có thể chỉ push)
```

**Xung đột**: HUB luôn thắng nếu `serverRow.updated_at > client_ts` → Spoke phải xác nhận. Không auto-merge.

### 3.4 AI nhúng (HUB only)

```
Settings: app/(app)/settings/ai/page.tsx — fields: provider (select: openai/anthropic/custom), baseURL, apiKey (password), model (text + dropdown fetch /v1/models), test button
Storage: config(key='ai_provider', value=encrypt(JSON.stringify({provider,baseURL,model}), SESSION_SECRET)) — giải mã khi gọi AI
Chat: app/api/ai/chat/route.ts — system prompt:
  "Bạn là trợ lý garage CencomOS, CHỈ trả lời dựa trên dữ liệu tồn kho/công nợ/SC/DM trong DB. Nếu câu hỏi ngoài phạm vi, từ chối. Khi cần số liệu, gọi tool dashboardAll/tonKho/ledgerReport."
  Tools: reuse getRegistry() như MCP (81 tools) nhưng gọi trực tiếp buildApi(actor) — không qua MCP transport.
UI: HUB sidebar “AI Trợ lý” — chat box + gợi ý “Tồn kho thiếu gì? Công nợ quá hạn?”
Vision: app/api/ai/vision/route.ts — nhận multipart image → base64 → gọi provider vision model (mimo-v2.5-flash-free / Muse Spark) với prompt:
  "Extract JSON {ncc, ngay, items:[{ten, don_vi, so_luong, don_gia}]} from this handwritten invoice image. Return ONLY JSON."
  → client điền form baogia, user sửa rồi mới Save.
```

**Lưu ý model free**: `2009/mimo-v2.5` và `opencode/muse-spark-1.2-contributor-free` đã có trong `opencode.jsonc` — HUB Settings cho phép nhập baseURL của B.AI (`https://api.b.ai/v1`) để dùng luôn key opencode.

### 3.5 Schema bổ sung (6 bảng mới — đã chốt, không đụng core)

> **Nguyên tắc**: Mọi bảng mới đều `IF NOT EXISTS`, `deleted_at TEXT DEFAULT ''` thống nhất, FK `ON DELETE SET NULL` để không block xóa mềm. Chạy qua `db/migrate.ts` (pipeline 3 file đã có).

#### HUB PG — 3 bảng trên `cencom` (thêm vào `db/schema.sql` + `db/migrate.ts`)

```sql
-- sync_devices: đăng ký Spoke lần đầu (HUB cấp ID)
CREATE TABLE IF NOT EXISTS sync_devices (
  id         VARCHAR(12) PRIMARY KEY,  -- SPK-000001 via db.nextId('SPK')
  ten_may    TEXT NOT NULL,            -- "May Le Tan 1"
  ip_last    TEXT DEFAULT '',
  last_seen  TEXT,                     -- YYYY-MM-DD HH:mm:ss
  trang_thai VARCHAR(10) DEFAULT 'online' CHECK (trang_thai IN ('online','offline')),
  deleted_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_syncdev_status ON sync_devices(trang_thai) WHERE deleted_at='';

-- sync_log: audit đồng bộ (debug xung đột)
CREATE TABLE IF NOT EXISTS sync_log (
  id         BIGSERIAL PRIMARY KEY,
  device_id  VARCHAR(12) REFERENCES sync_devices(id),
  huong      VARCHAR(10) CHECK (huong IN ('push','pull','confirm')),
  loai       TEXT,                     -- 'sc'|'vattu'|'dm'|'sc_congviec'
  ref_id     VARCHAR(12),              -- id bản ghi liên quan
  trang_thai VARCHAR(10) CHECK (trang_thai IN ('ok','conflict','failed')),
  chi_tiet   TEXT,                     -- JSON {reason, serverRow}
  ts         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_synclog_device ON sync_log(device_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_synclog_ref ON sync_log(ref_id);

-- ai_conversations + ai_messages + ai_vision_jobs: lịch sử AI tại HUB
CREATE TABLE IF NOT EXISTS ai_conversations (
  id         VARCHAR(12) PRIMARY KEY,  -- AIC-000001
  user_id    VARCHAR(12) REFERENCES users(id),
  tieu_de    TEXT DEFAULT '',
  created_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_aiconv_user ON ai_conversations(user_id);

CREATE TABLE IF NOT EXISTS ai_messages (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id VARCHAR(12) REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            VARCHAR(10) CHECK (role IN ('user','assistant','system')),
  content         TEXT,
  tool_calls      TEXT,                -- JSON [{tool, args, result}]
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aimsg_conv ON ai_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS ai_vision_jobs (
  id         VARCHAR(12) PRIMARY KEY,  -- AIV-000001
  baogia_id  VARCHAR(12) REFERENCES baogia(id),
  anh_path   TEXT,                     -- %APPDATA%/CencomOS/vision/<id>.jpg (HUB local)
  extracted  TEXT,                     -- JSON {ncc, ngay, items:[{ten, don_vi, so_luong, don_gia}]}
  trang_thai VARCHAR(10) DEFAULT 'cho' CHECK (trang_thai IN ('cho','xong','loi')),
  created_at TEXT DEFAULT ''
);
-- config(key='ai_provider') ĐÃ CÓ SẴN (schema.sql line 318) — value = encrypt({provider,baseURL,model,apiKey})
```

#### SPOKE SQLite — file `%APPDATA%/CencomOS/spoke.db` (better-sqlite3)

```sql
-- Hàng đợi offline — nguồn duy nhất khi mất mạng
CREATE TABLE IF NOT EXISTS sync_queue (
  id         TEXT PRIMARY KEY,         -- uuid v4 client
  loai       TEXT NOT NULL,            -- 'scCreate'|'scAddVatTu'|'nhapKho'|'dmCreate'
  payload    TEXT NOT NULL,            -- JSON args gốc (đã Zod validate ở Spoke)
  status     TEXT DEFAULT 'pending' CHECK (status IN ('pending','conflict','synced','failed')),
  retry      INTEGER DEFAULT 0,
  created_at TEXT,
  synced_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_sq_status ON sync_queue(status);

-- Cache đọc (pull từ HUB, read-only, làm mới khi online)
CREATE TABLE IF NOT EXISTS cache_vattu (id TEXT PRIMARY KEY, ten TEXT, ton REAL, gia REAL, don_vi TEXT);
CREATE TABLE IF NOT EXISTS cache_xe    (id TEXT PRIMARY KEY, bien_so TEXT, chu_xe TEXT);
CREATE TABLE IF NOT EXISTS cache_sc    (id TEXT PRIMARY KEY, xe_id TEXT, trang_thai TEXT, ngay_tao TEXT, tong REAL);
-- Spoke không có ledger/ton_lot — mọi tính tiền ở HUB
```

**Tổng**: HUB +6 bảng PG (thực chất 5 bảng + dùng lại `config`), Spoke 4 bảng SQLite. Không đụng 22 bảng core.

---

## 4. Phân rã công việc (Granular, mỗi task 1 agent làm ngay)

> Mỗi subtask ghi file sở hữu (không đè nhau) — coordinator giữ `allocation.json` trước khi spawn.

| Wave | ID | Task | File sở hữu (ghi) | Ước lượng |
|---|---|---|---|---|
| **1** | A1 | Portable PG bundle + lifecycle trong electron-hub/main.js | `electron-hub/main.js`, `electron-hub/pg-portable/` | 3h |
| **1** | B1 | Tạo project electron-spoke (thin, config hubUrl) | `electron-spoke/**` (mới) | 2h |
| **1** | E1 | Trang Settings AI (form + encrypt + testConnection) | `app/(app)/settings/ai/page.tsx`, `lib/ai-config.ts` | 2h |
| **2** | C1 | Spoke SQLite schema + DAO | `electron-spoke/db/**` | 2h |
| **2** | D1 | HUB Sync API (push/confirm/pull + Zod) | `app/api/sync/**`, `lib/sync.ts` | 3h |
| **2** | F1 | AI chat API (system prompt khóa phạm vi + tool-calling) | `app/api/ai/chat/route.ts`, `lib/ai.ts` | 3h |
| **3** | C2 | Spoke queue + offline badge + sync dialog | `electron-spoke/sync/**`, `electron-spoke/preload.js` | 3h |
| **3** | G1 | Vision OCR báo giá (upload → vision model → điền form) | `app/api/ai/vision/route.ts`, `app/(app)/baogia/page.tsx` (section) | 3h |
| **3** | F2 | AI chat UI dock tại HUB | `components/AiChat.tsx`, `app/(app)/layout.tsx` (slot) | 2h |
| **4** | A2 | Backup/restore UI tại HUB | `app/(app)/settings/backup/page.tsx`, `electron-hub/backup.js` | 2h |
| **4** | INT | Tích hợp + E2E LAN 1 HUB + 2 Spoke + MCP LAN | `tests/e2e/hub-spoke.test.ts`, `Onpremise/scripts/smoke_hub_spoke.mjs` | 3h |
| **4** | DOC | Tài liệu + NSIS Hub/Spoke + README LAN | `docs/PLAN_4.9.md`, `Onpremise/README.md` | 1h |

**Tổng**: ~29h agent-time, chạy swarm 3-4 agent song song → **1.5–2 ngày** (2 wave lớn).

---

## 5. Tiêu chí hoàn thành (Definition of Done) — PHẢI ra sản phẩm

- [ ] `CencomOS Gara Hub Setup 5.4.0.exe` (~280MB) cài trên Win 10/11 sạch (chưa có PG) → mở app → tự `initdb` → login `admin/cencom@123` → tạo SC → tồn kho hiện → **không cần Internet/Docker**.
- [ ] `CencomOS Gara Spoke Setup 5.4.0.exe` (~45MB) cài trên 2 máy LAN → nhập IP HUB → login → tạo SC khi **rút dây mạng** → badge “3 chưa đồng bộ” → cắm lại → “Đồng bộ” → dialog xác nhận → HUB thấy đủ 3 SC.
- [ ] Trưởng phòng trên máy thứ 3 (không cài Hub) → `MCP_API_KEY` trỏ `http://HUB_IP:3001/mcp` → `tools/call dashboardAll` trả `xe:42` qua LAN.
- [ ] HUB → `Cài đặt → AI` → nhập `baseURL https://api.b.ai/v1` + key + model `mimo-v2.5` → `Test` OK → Chat “Tồn kho thiếu gì?” trả lời từ data thật (không hallucinate).
- [ ] HUB → Báo giá → Upload ảnh hóa đơn viết tay → Vision trả JSON điền form → user Save thành công.
- [ ] `tsc --noEmit` 0, `conformance 777/777`, `smoke_hub_spoke` PASS.

---

## 6. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Portable PG chiếm port 5432 trùng dev PG | HUB dùng **5433** + `DATABASE_URL` riêng, Spoke không mở PG nên không xung đột |
| better-sqlite3 build native trên Windows | Dùng `better-sqlite3` prebuild hoặc `sqlite3` + `electron-rebuild` trong `postinstall` |
| Ảnh hóa đơn viết tay xấu → vision sai | Luôn điền form để user **sửa trước khi Save**, không auto-save |
| Sync xung đột mất dữ liệu | HUB không auto-ghi đè — dialog xác nhận từng dòng, audit `sync_confirm` |
| AI hallucinate ngoài data | System prompt khóa phạm vi + tool-calling bắt buộc, không cho AI tự bịa số |

---

## 7. Lộ trình thực hiện

**Wave 1** (song song): A1 + B1 + E1 → HUB có DB, Spoke có vỏ, Settings có chỗ nhập key.
**Wave 2** (song song): C1 + D1 + F1 → offline lưu được, sync API sống, chat API sống.
**Wave 3** (song song): C2 + G1 + F2 → UX đồng bộ + vision + chat UI.
**Wave 4** (tích hợp): A2 + INT + DOC → backup + E2E 2 máy + NSIS Hub/Spoke + bàn giao.

> **Không làm Cloudflare Tunnel trong 4.9** — để lại `Onpremise/cloudflared/` placeholder + hướng dẫn token, anh tự bật khi cần.

---

## 8. Quyết định cần anh chốt trước khi build

1. **Port HUB PG**: 5433 (tránh dev) hay 5432 (chuẩn)? Em đề xuất **5433**.
2. **Tên file Spoke**: `CencomOS Gara Spoke Setup 5.4.0.exe` OK?
3. **Model mặc định HUB**: `mimo-v2.5` qua **opencode zen** (`https://api.opencode.ai/zen/v1`) — api.b.ai không có model phù hợp (đã chuyển `settings/ai` + `lib/ai-config.ts` sang provider `zen`).

Chốt 3 điểm trên là em cho swarm chạy ngay.

---

## 9. Checklist 100% — Từng bước ra sản phẩm (bổ sung 04.09, chốt Hub-and-Spoke)

> Mỗi bước có **Task ID, việc cụ thể, file, cách kiểm thử, tiêu chí PASS**. Làm tuần tự 9.1→9.9, mỗi bước xong phải PASS mới sang bước sau.

### 9.1 Tải Portable PG cho HUB (30 phút)
- **Task A1.1**: Chạy `electron-hub/scripts/fetch-pg.ps1` — tải `postgresql-16.8-win64-binaries.zip` từ enterprisedb, giải nén vào `electron-hub/pg-portable/` (bin/lib/share)
- **Verify**: `Test-Path electron-hub/pg-portable/bin/pg_ctl.exe` → True, `dir pg-portable` ~120MB
- **PASS**: `ls pg-portable/bin` có 15 exe

### 9.2 Build & test Hub all-in-one trên máy sạch (1h)
- **Task A1.2**: `cd gara_reconstruction_v5; npm run build` → `cd ../electron-hub; npm install; npm run build` → ra `CencomOS Gara Hub Setup 5.4.0.exe` (~280MB khi có pg-portable, hiện 80MB khi chưa)
- **Task A1.3**: Cài Hub trên Win 10/11 VM sạch (chưa có PG) → mở app → kiểm tra `%APPDATA%/CencomOS/hub-data/PG_VERSION` tồn tại → login `admin/cencom@123` → tạo 1 SC → `tonKho` hiện
- **Verify**: `curl http://127.0.0.1:3000/api/health` → `{"ok":true,"version":"5.4.0"}` + `pg_isready -p 5433` OK
- **PASS**: Hub chạy độc lập không cần Docker/Internet

### 9.3 Spoke thin + offline queue (1h)
- **Task B1/C1**: `electron-spoke` đã build `76.4MB` — kiểm tra `spoke-queue.json` tại `%APPDATA%/CencomOS/spoke-queue.json` sau khi Spoke nhập 1 SC offline
- **Task C2**: Test rút dây mạng → nhập SC → badge `● Offline (1 chưa đồng bộ)` hiện (SyncStatus.tsx + spokeAPI.queueList)
- **Verify**: `cat %APPDATA%/CencomOS/spoke-queue.json` → 1 item `status:pending`
- **PASS**: Spoke nhập được khi offline

### 9.4 Sync 2 chiều có xác nhận (1.5h)
- **Task D1**: HUB `app/api/sync/push` + `confirm` + `pull` đã code — test bằng 2 Spoke mock
- **Verify**:
  ```powershell
  # Spoke 1 push
  curl -b sid http://HUB:3000/api/sync/push -d '{"items":[{"id":"SC-TEST001","loai":"scCreate","payload":{"xe_id":"XE-000001"}}]}'
  # → {accepted:1, conflicts:0} → confirm → HUB SELECT * FROM sc WHERE id='SC-TEST001' → có
  # Spoke 2 push trùng ID → conflicts:1 → dialog “ID đã tồn tại” → user Bỏ
  ```
- **PASS**: HUB thấy đủ SC, Spoke `status:synced`, `sync_log` có 2 dòng

### 9.5 AI Settings + Chat trong phạm vi data (1h)
- **Task E1/F1/F2**: `settings/ai` + `api/ai/chat` + `AiChatDock` đã code
- **Verify**: HUB → Cài đặt → AI → nhập `baseURL https://api.b.ai/v1` + key + `mimo-v2.5-flash-free` → Test → `OK` → Chat “Tồn kho thiếu gì?” → trả lời có số `ton < ton_min` thật (không hallucinate), check `ai_conversations` có 1 dòng
- **PASS**: Chat chỉ trả lời từ data, ngoài phạm vi thì từ chối

### 9.6 Vision hóa đơn viết tay (45 phút)
- **Task G1**: `VisionUpload` đã gắn `baogia/page.tsx` case 1 + `api/ai/vision`
- **Verify**: Upload ảnh hóa đơn viết tay (chụp bằng đt) → `extracted: {ncc, items:[{ten, so_luong, don_gia}]}` → form tự điền → Save → `baogia` + `baogia_chitiet` có dòng mới
- **PASS**: Vision JSON đúng, user sửa được trước khi Save

### 9.7 MCP LAN cho trưởng phòng (30 phút)
- **Verify**: Máy trưởng phòng (không cài Hub) → `MCP_API_KEY` trỏ `http://HUB_IP:3001/mcp` → `opencode mcp list` hoặc `curl -H "Authorization: Bearer $key" http://HUB:3001/mcp` → `tools/call dashboardAll` → `xe:42`
- **PASS**: MCP đọc data HUB qua LAN, Spoke không cần DB riêng

### 9.8 Backup/Restore (30 phút)
- **Task A2**: `settings/backup` + `app/api/backup` đã code — test nút Sao lưu
- **Verify**: HUB → Sao lưu → file `%APPDATA%/CencomOS/backup/cencom-YYYYMMDD.dump` tồn tại → Xóa 1 SC → Khôi phục → SC quay lại
- **PASS**: Backup/restore 1-click

### 9.9 Kiểm thử tổng + bàn giao (1.5h)
- **Verify**:
  1. `cd gara_reconstruction_v5; npx tsc --noEmit` → 0
  2. `npm run test:conformance` → 777/777 (isolated, DB 5432)
  3. `Onpremise/scripts/smoke_onpremise.mjs` (HUB Docker) → 6/6 PASS
  4. `Onpremise/scripts/smoke_hub_spoke.mjs` (mới) → Hub+Spoke LAN 2 máy PASS
  5. 2 installer `Hub 280MB` + `Spoke 76MB` + `README LAN` + `CHANGELOG 5.4.0` + tag `v5.4.0`
- **PASS**: Đủ 5 tiêu chí Definition of Done (section 5) → **100% ra sản phẩm**

---

## 10. Phân công & thứ tự triển khai (để đạt 100%)

| Thứ tự | Task ID | Người làm | Ước lượng | Blocker |
|---|---|---|---|---|
| 1 | A1.1 fetch-pg | Hub builder | 30m | Không |
| 2 | A1.2 build Hub | Hub builder | 1h | Cần 1 |
| 3 | C1+D1 song song | Sync team | 1.5h | Cần 2 |
| 4 | E1+F1 song song | AI team | 1h | Không |
| 5 | G1 Vision | AI team | 45m | Cần 4 |
| 6 | C2 Spoke UI | Spoke team | 1h | Cần 3 |
| 7 | A2 Backup | Hub builder | 30m | Cần 2 |
| 8 | 9.4-9.8 test LAN | QA (1 Hub + 2 Spoke vật lý) | 1.5h | Cần 2-7 |
| 9 | 9.9 tổng + tag | Release | 1h | Cần 8 |

**Tổng còn lại**: ~8h thực thi (đã trừ 29h đã làm Wave1-3). Chạy swarm 2-3 agent song song → **1 ngày** là xong.

> **Báo cáo triển khai**: Sau khi xong 9.1→9.9, em sẽ gửi anh **báo cáo 1 trang** gồm: 2 link installer, video LAN 2 máy, log `conformance + smoke`, và `git tag v5.4.0`.
