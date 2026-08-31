# 00 — CẤU TRÚC HỆ THỐNG (tài liệu hội tụ W0.DOC)

> **Ngày:** 2026-09-01 · **Basis:** v5.1.0 (tag `v5.1.0`) · **Phương pháp:** đối chiếu code thật
> `gara_reconstruction_v5/` (mọi số liệu dưới đều kèm đường dẫn file nguồn để kiểm) + 3 báo cáo hội tụ
> `01_v3.6_FEATURES.md` (98 tính năng) · `02_v4_FEATURES.md` (65 hạng mục) · `03_v5_BASELINE.md`
> + `PLAN_HOI_TU_01.09.md` (gốc). Mọi con số đếm từ source tại thời điểm viết.
> **Phạm vi:** chỉ tài liệu — KHÔNG sửa code.

---

## §1 SƠ ĐỒ HỆ THỐNG (ASCII)

```
                        ═══════════════ WEB ═══════════════
┌──────────┐  HTTPS 443 (nginx Onpremise) / HTTP 3003 (dev)   ┌─────────────────────────────┐
│ Browser  │ ───────────────────────────────────────────────► │ Next.js app (v5)  :3003      │
│ (6 trang │  POST /api/rpc  { fn, args }   ← contract BẤT DỊ │  app/api/rpc/route.ts         │
│  + login)│  cookie sid ·同源 isSameOrigin (CSRF) · metrics   │   getCurrentActor → cookie    │
└──────────┘                                                  └──────────────┬────────────────┘
      ▲                                                                      │ buildApi(actor)
      │ Realtime WS (Supabase Realtime / LISTEN-NOTIFY 5 kênh:               ▼
      │ sc_changes · vattu_changes · sc_vattu_changes ·            ┌──────────────────────┐
      └────────── nhap_xuat_changes · activity_log_changes)        │ lib/rpc.ts           │
                                                                   │  FN_LIST 36 fn       │
┌──────────┐  stdio (npm run mcp)      ┌──────────────────────┐    │  META 32 fn perm     │
│ AI host  │ ════════════════════════► │ mcp-server/index.ts  │───►►│  OPEN 4 fn           │
│ (opencode│  MCP_TRANSPORT=http       │ mcp-server/http.ts   │─┘   │  dispatch()          │
│  Cursor… │  :3001 /mcp Bearer        │ (32 tool auto-sinh từ │    │  fail-closed 401/403 │
└──────────┘  MCP_API_KEY (LAN         │  getRegistry, docs-  │    └────────┬─────────────┘
              nginx /mcp, loopback     │  gate throw)         │             │ can(db, role, m, f)
              3001 qua compose mcp)    │ auth.ts service acct │             ▼ lib/perm.ts MATRIX 5 vai
                                       │ WRITE allowlist      │    ┌──────────────────────┐
                                       └──────────────────────┘    │ lib/core/*.ts        │
                                                                   │  sc · kho · baogia   │
                                                                   │  ho_so · activity · xe│
                                                                   └───┬──────────┬───────┘
                                                                       │          │
                                            logActivity() (điểm audit  │          │ SQL parameterized
                                            DUY NHẤT, fail-safe) ◄─────┘          ▼
                                                       ┌──────────────────────────────────────┐
                                                       │ PostgreSQL  (dev/test: container     │
                                                       │  cencom_v5_pg :5432/db `cencom`;     │
                                                       │  on-prem: supabase-db compose)       │
                                                       │ 18 bảng + triggers → pg_notify →     │
                                                       │ Notify→Realtime→Browser (mũi tên     │
                                                       │ ngược lên); config counter nextId    │
                                                       │ FOR UPDATE (PREFIX-000001)           │
                                                       └──────────────────────────────────────┘
```

**Bất biến hội tụ (đọc từ source):**
1. **Mọi cửa vào đều đi qua CÙNG registry:** web `dispatch(api,fn,args)` và MCP tool handler
   đều gọi `getRegistry()` → `lib/rpc.ts` (tool name ≡ fn name từng ký tự —
   `mcp-server/index.ts` §5). KHÔNG có đường vòng.
2. **`buildApi(actor)` là điểm gặp nhau** (`lib/api.ts`): web dựng từ cookie session
   (`app/api/rpc/route.ts:26-28`), MCP dựng từ service-account login
   (`mcp-server/auth.ts::resolveActor`). RBAC thật vẫn do `can()` + hard-gate trong core
   (vd `scQuyetToan` chặn role ≠ ketoan/admin — `lib/core/sc.ts:271`).
3. **Audit hợp nhất:** web → từng fn core gọi `logActivity` →
   `activity_log`; MCP → `auditMcpCall` GỌI LẠI `logActivity` (kể cả call bị từ chối —
   `auth.ts:185-198`), rồi fn core gọi tiếp `logActivity` —
   cùng về một điểm ghi (`lib/core/activity.ts`, INSERT fail-safe bọc try/catch, không sập nghiệp vụ).
   Audit ghi `channel=mcp` + actor + role + `hanh_dong='mcp_call'`.
4. **Realtime:** 5 trigger `*_changes` trên PG (`db/realtime_triggers.sql`
   `pg_notify(TG_TABLE_NAME || '_changes', …)`) → Supabase Realtime → browser badge/paint.
   **Không polling 45s** (cấm theo AGENTS.md).
5. **MCP có HAI mode cùng hành vi tool:** `stdio` (spawn per-client, chỉ `index.ts` đăng ký
   resources+prompts) vs `http` (`http.ts`, `MCP_TRANSPORT=http`, default `0.0.0.0:3001`,
   session stateful `Mcp-Session-Id`, JSON-response, bearer fail-closed) —
   **lệch tính năng hiện ghi ở §3**.

---

## §2 HIỆN TRẠNG v5.1.0 (đo từ code)

| Lớp | Số liệu | Bằng chứng file /Ghi chú |
|---|---|---|
| RPC registry | **36 fn** = 31 handler thật + 2 **stub** (`dashboard`,`report` trả `{ok:true}`) + 4 **OPEN** (login/logout placeholder/currentUser/appInfo); 32 fn có `META` perm | `lib/rpc.ts:10-47` (FN_LIST), `:51-84` (META), `:135-136` (stub), `:148-160` (dispatch fail-closed: fn không có META → 403) |
| Phân quyền | **5 vai** `admin/giamdoc/xuong/ketoan/kho`; MATRIX hard-code trong code (KHÔNG bảng `phan_quyen` động); admin bypass `can()`; `giamdoc` chỉ đọc toàn phần | `lib/perm.ts:3-11`; test rbac 141 case động |
| UI | **6 trang chính**: `/` dashboard (tổng hợp client-side), `/sc`, `/xe`, `/kho`, `/baogia`, `/hoso` + `/login`; API: rpc/auth/health/metrics/realtime | `app/(app)/**/page.tsx`, `app/api/**`; baseline 03 §2 |
| DB | **18 bảng** (users·xe·sc·sc_congviec·vattu·sc_vattu·nhap_xuat·dm·dm_chitiet·baogia·baogia_chitiet·ho_so·activity_log·config·ke_hoach_sc·phieu_kiem_tu·bien_ban_nghiem·bao_gia_ncc); soft-delete TEXT `''`, `is_test`, id `PREFIX-000001` | `db/schema.sql` đếm INSERT TABLE; `db/migrate.ts`, `db/realtime_triggers.sql` |
| MCP tool | **32 tool** = FN_LIST ∖ 4 OPEN, **auto-sinh** từ registry; docs-gate: thiếu `TOOL_DOCS[fn]` → **throw khi boot** | `mcp-server/index.ts:44-55`; docs 32 mục = part1(10)+part2(11)+part3(11), song ngữ [vi]/[en] + perm + mode |
| MCP resources/prompt | **2 resource template** `sc://{sc_id}` (checkHoSo+scGet), `xe://{xe_id}` (xeGet) + **1 prompt** `ho-so-sc-chuan-qc206` — **chỉ stdio** | `mcp-server/resources.ts`; `index.ts:131-132`; `http.ts` KHÔNG gọi |
| MCP auth | service-account `MCP_USER/MCP_PASS/MCP_ROLE` (default `giamdoc`=chỉ đọc) qua `.env.mcp` (detect BOM UTF-16, fallback `.env.local`); **READ_TOOLS=16**, 18 WRITE chặn sau `MCP_WRITE_TOOLS=''` → `403 write tool disabled` TRƯỚC khi chạm core; audit MỌI call kể cả denied | `mcp-server/auth.ts:23-40,121-176,185-198`; `env.ts` |
| MCP HTTP LAN | `StreamableHTTPServerTransport` :3001 `/mcp`; **Bearer `MCP_API_KEY` fail-closed + `timingSafeEqual`**; body cap 8 MiB; keepAlive 65s; graceful SIGINT/TERM; unhandledRejection net | `mcp-server/http.ts:66-82,105-129,272-315`; `Onpremise/docker-compose.mcp.yml` (loopback 127.0.0.1:3001 + nginx) |
| Input contract | **17 zod shape** (`RPC_SCHEMAS`) phủ fn GHI: sc*7, hồ sơ 4, baogiaSave, kho*5+`dmNhap`; fn còn lại `z.object({}).passthrough()` → validate nghiệp vụ do core + rbac.test gánh | `lib/contracts.ts:7-99`; JSON-Schema converter cho MCP inputSchema |
| Test | conformance tự sinh `npm run test:conformance` = mọi `*.test.ts` trong `tests/conformance` (11 suite, mỗi file process jest riêng); bằng chứng gần nhất **296/296 pass** + 10/10 UX + tsc 0 (evidence 31.08) | `scripts/test-conformance.mjs`; baseline 03 §3 cuối |
| Vers / đóng gói | package.json **5.1.0**; script `mcp`; docs `mcp-server/README.md` + `mcp.json.example` + `.env.example` | package.json (đo trực tiếp) |

---

## §3 MCP CHI TIẾT + ĐIỂM CẦN SỬA KHI HỘI TỤ

### Luồng thống nhất (đã đúng — giữ nguyên khi port)

```
AI host ──► tool name ≡ fn (getRegistry) ─► docs-gate boot ─► [WRITE? check MCP_WRITE_TOOLS]
        ─► HANDLERS[fn](buildApi(actor), args) ─► core hàm (perm can() + validate + audit)
        ─► auditMcpCall(fn, actor, ok/denied) ─► logActivity ─► activity_log (channel=mcp)
```
→ **fn mới chỉ cần: core fn + khai META + TOOL_DOCS** — tool zod (tuỳ chọn) là tự có MCP
tool, tự vào RBAC, tự audit. ĐÚNG nguyên tắc số 2 của PLAN ("MCP registry-driven").

### Điểm cần-sửa-khi-hội-tụ (chưa sửa — ghi nhận W0)

| # | Vấn đề (đọc source `http.ts`) | Hệ quả khi thêm trục W1–W4 | Cần làm (wave) |
|---|---|---|---|
| 3.1 | `http.ts` **KHÔNG đăng ký resources/prompts** (tự ghi comment dòng 10-11: "those belong to index.ts (other worker)") — `index.ts` có gọi `registerResources/registerPrompts` | AI host LAN (mode http) thấy 32 tool nhưng **không tiếp cận được** resource `sc://{}` `xe://{}` và các prompt quy trình mà W1.8/W2.7/W3.7/W4.6 bổ sung | W1.8: gọi cùng hàm `resources.ts` trong `http.ts` (tái dùng, không fork logic) + test parity 2 mode |
| 3.2| HTTP bearer **một `MCP_API_KEY` dùng chung cả LAN** + actor là MỘT service-account (`MCP_USER`) duy nhất | Audit MCP không phân biệt được người thật sau key; ai giữ key cũng đội xác role `giamdoc` | PLAN Phần 7 chốt *tình thế*: sếp dùng stdio với user riêng; LAN giữ role giamdoc. **Mở khi W4 phân quyền user MCP thật (quyết định per-user key/actor — chưa wave nào nhận)** |
| 3.3 | **Rate-limit HTTP mode chưa có** — web có `lib/rateLimit.ts` + `middleware.ts` (5 lần /api/auth) nhưng `http.ts` chỉ cap body 8 MiB | MCP :3001 mở trong LAN có thể bị spam tool-call (đặc biệt sau khi WRITE allowlist bật) | W4 (cross-cutting): port rate-limit vào `http.ts` theo IP+session + test (tương tự `rateLimit.test.ts` web) |
| 3.4 | `createServerInstance` (http.ts) **đăng ký lại vòng tool** y hệt index.ts §5 | Hai nơi trùng logic → sửa một quên một (docs-gate, WRITE-guard…) | W1.8: tách hàm register chung (1 source) — refactor nhỏ, KHÔNG đổi hành vi |

*(Phần tool-docs part4-7 cho fn mới: wave nào thêm fn wave đó thêm docs — docs-gate bảo đảm.)*

---

## §4 DATA MODEL

### 4a. 18 bảng hiện tại + khoá chính (schema.sql)

```
users ──┬─ sc ──┬── sc_congviec ──(sc_id→sc)   ├── sc_vattu ──(sc_id→sc, vattu_id→vattu)
        │       ├── nhap_xuat ──(vattu_id→vattu, sc_id→sc NULL)     ★ trục SC = 10 bảng con
        │       ├── dm ──(sc_id→sc NULL) ── dm_chitiet ──(vattu_id→vattu)
        │       ├── baogia ── baogia_chitiet ; bao_gia_ncc (ocr_xac_nhan, anh_bao_gia)
        │       ├── ho_so ; ke_hoach_sc (b1) ; phieu_kiem_tu (b2) ; bien_ban_nghiem (b7)
        │       └── activity_log ──(actor_id→users, sc_id→sc NULL)  ← MỌI audit đổ về đây
        ├── xe (bien_so, nguyen_gia) ←── sc.xe_id
        └── config (counter nextId 'PX' → PREFIX-000001, FOR UPDATE)
vattu (ton, ton_min, gia) ←── sc_vattu, nhap_xuat, dm_chitiet
```
Quy ước bất biến: `deleted_at TEXT DEFAULT ''` (soft-delete), `is_test SMALLINT`, ngày
TEXT `YYYY-MM-DD` (quyết định CHỐT — không đổi), SQL 100% parameterized.

### 4b. BẢNG MỚI THEO WAVE (chưa tạo — W0 chỉ vẽ)

| Wave | Bảng mới | Cột chính (phác thảo) | Nguồn port |
|---|---|---|---|
| **W1** | `phieu_nhap` + `phieu_nhap_ct` · `phieu_xuat` + `phieu_xuat_ct` (phiếu **2 tầng** — thay `nhap_xuat` phẳng; giữ `nhap_xuat` hay migrate? chốt tại migration W1.1) | header{id,PXN/PXX-…,loai,ref_dm,ref_sc,ncc,diachi,sdt,ngay,tong}; ct{id,phieu_id,vattu_id,sl,don_gia,thanh} | v3.6 #58-65 |
| W1 | `thanh_ly` |{id,phieu_nhap_id,vattu_id,ten,sl,ly_do,gia_thanh_ly,ngay} | v3.6 #61 |
| W1 | `vattu_gia_lich_su` | {id,vattu_id,gia,phieu_id,nguon='nhap_kho',ncc,ngay} | v3.6 #52 |
| W1 | (cột thêm) `vattu.ton_cu_hong`, `sc_vattu.da_xuat`/trạng thái, `sc_congviec.tho_id`+`nguyen_nhan` | — | v3.6 #60-64, #15 |
| **W3** | `sc_phien_ban` (snapshot **bất biến** tổng duyệt) | {id,sc_id,phan_loai,ghi_chu,data_json(serialize {sc,cong,vat,baoGia,chot}),tao_boi,ngay} | v3.6 #13 |
| W3 | (cột thêm) `sc.han_tra_xe`, `sc.ly_do_tu_choi`, `sc.ngay_duyet`… | — | v3.6 #14, #11 |
| **W3.9 (optional — chờ chủ dự án)** | `yeu_cau_tham_kham` | {id,xe_id,mo_ta,uu_tien,img_paths,trang_thai 9 nhãn,…} + cột `sc.tk_id` quay lại | v3.6 #6-10 |
| **W4 (danh sách — thiết kế mở)** | `phan_quyen` động? · `user`/`users` mở rộng (login, active, `must_change` **đã có cột nhưng chưa enforce**) · `thresholds` đưa vào `config` | v3.6 #34-35, #81-82 | ⚠️ **MỞ**: v5 đang hard-code MATRIX (`perm.ts`) — chuyển sang bảng động hay KHÔNG chưa chốt trong PLAN; W4.1 ít nhất phải đủ `userList/userAdd/...` + `permMatrix/permSave/thresholdsSet` operate trên nền chọn |

### 4c. Không port (quyết định CHỐT — AGENTS.md + PLAN Phần 4)

`bao_gia_anh/ocr_result/ai_config` (AI-OCR), bảng sinh `.docx` (in HTML A4 thay),
`bieu_ma/kiem_tra/ket_qua` (check-sheet GĐ2 — ngoài 3 trục), `chat_*` (cắt khỏi scope
hội tụ lần này, không wave nào nhận — ghi nhận để chủ dự án rõ).

---

## §5 GAP → WAVE MAP (≤30 dòng)

| # | Tính năng (ngắn) | v3.6 / v4 ở đâu | v5 thiếu gì | Target | Trạng thái |
|---|---|---|---|---|---|
| 1 | **Race condition tồn kho** | v3.6 concurrency test | `nhapKho/xuatKho/dmNhap` UPDATE `ton=ton±$2` **ngoài transaction** (`lib/core/kho.ts:85,104-111,162-165`) | **W0.1** | `[W0 đang làm: race fix]` |
| 2 | **sc.tong/tong_vt/tong_cong** tự tính | v3.6 `recalc/syncPrices` | không code nào UPDATE 3 cột (`sc.ts` chỉ INSERT) | **W0.2 (recalcScTotals)** | `[W0 đang làm: sc totals]` |
| 3 | Rà FN_LIST vs core exports | kho 0.1/0.3 | `congViecSave/congViecDel` chưa có RPC; `dmFromBaoGia` KHÔNG port (tài liệu hoá) | **W0.3** | `[ ]` |
| 4 | Phiếu nhập/xuất **2 tầng** | v3.6 #58-65 | chỉ `nhap_xuat` phẳng 1 dòng | W1.1 | `[ ]` |
| 5 | `tonKho` tổng hợp + cờ low + giá trị tồn | v3.6 #57 | fn không tồn tại; `ton_min` chẳng chỗ nào đọc | W1.2 | `[ ]` |
| 6 | Kho hư hỏng + autoGenCuHong + thanh lý | v3.6 #60-62 | không cột `ton_cu_hong`, không fn, không bảng `thanh_ly` | W1.3 | `[ ]` |
| 7 | `autoXuatSC` liên thông nhập→PXX | v3.6 #64 | không fn; `sc_vattu` ↔ `nhap_xuat` không đồng bộ | W1.4 | `[ ]` |
| 8 | Lịch sử giá NCC | v3.6 #52 | không bảng `vattu_gia_lich_su`, không fn | W1.5 | `[ ]` |
| 9 | GTTV khấu hao (assetXe/Report) | v3.6 #67 | không `lib/core/asset.ts` | W1.6 | `[ ]` |
| 10 | UI kho (tab tồn đỏ/phiếu/thanh lý/GTTV) | v3.6 #10-13 UI · v4 C2 | `/kho` chưa có | W1.7 | `[ ]` |
| 11 | MCP kho: tools+tài nguyên `kho://tai-san/{xe_id}` part4 | PLAN W1.8 | http.ts chưa res (sửa điểm 3.1) | W1.8 | `[ ]` |
| 12 | DM đọc: `dmList/dmDetail/dmListBySc/dmDelete` | v3.6 #37,42,43 | FN_LIST chỉ `dmCreate/dmNhap` → demand "mù" | W2.1 | `[ ]` |
| 13 | `dmDecide` + ngưỡng `duyet_mua_nguong` + quyền `mua.duy` | v3.6 #41 + perm | không fn duyệt; CHECK `tu_choi` chết (không fn ghi) | W2.2 | `[ ]` |
| 14 | `dmFromSC` gom `can_mua`→DM (2 chiều SC↔DM) | v3.6 #38 | không fn, không nối 2 chiều | W2.3 | `[ ]` |
| 15 | `dmAutoBu` bù tồn min | v3.6 #40 | không fn | W2.4 | `[ ]` |
| 16 | UI DM + chọn giá NCC cũ (top 8) | v3.6 #52 UI | `/kho/dm` không tồn tại | W2.5–2.6 | `[ ]` |
| 17 | MCP DM: `dm://{dm_id}` + prompt + part5 | PLAN W2.7 | thiếu res/prompt (cả 2 mode) | W2.7 | `[ ]` |
| 18 | **Kanban 5 cột 1-xe-1-thẻ** | v3.6 #3 (dashboardAll) · v4 UI-21 | không route/fn kanban | W3.1 | `[ ]` |
| 19 | KPI xưởng 11 + cache role 60s | v3.6 #1,2,5 · v4 UI-22 | `dashboard` là stub; không cache | W3.2 | `[ ]` |
| 20 | Phân công thợ `thoList/myTasks/tho_id` | v3.6 #27,33 | không cột/fn/UI | W3.3 | `[ ]` |
| 21 | Sửa/xoá dòng CV/VT (state-gate `de_xuat`) | v3.6 #15-16 | v5 chỉ ADD (scAddCongViec/VatTu), không Set/Del | W3.4 | `[ ]` |
| 22 | Tổng duyệt + snapshot `sc_phien_ban` | v3.6 #13 | không fn/bảng | W3.5 | `[ ]` |
| 23 | `scSetDeadline` hẹn trả xe + audit | v3.6 #14 | không fn, không cột | W3.6 | `[ ]` |
| 24 | MCP xưởng+sếp: `xuong://kanban`+part6 · `boss://dashboard`+3 prompt part7 | PLAN W3.7/W4.6 | mới có res/prompt QC206 (stdio) | W3.7/W4.6 | `[ ]` |
| 25 | **TK thăm khám 9-trạng-thái** (10 fn+bảng+2 portal) | v3.6 #6-10 · đã BỎ có chủ đích (`migrate-tk-removal`) | nguyên khối; **cần chủ dự án chốt §7.2-a** | W3.9? | `[chờ duyệt]` |
| 26 | Admin 7 fn + **must_change enforce** (OWASP) | v3.6 #81-82 | cột `must_change` có nhưng không RPC/UI chặn | W4.1 | `[ ]` |
| 27 | GlobalSearch + CommandPalette Ctrl+K | v4 UI-08/09 | không `search.ts`/fn/UI | W4.2 | `[ ]` |
| 28 | `/in/*` A4 8 mẫu + export xlsx 7 workbook | v3.6 #54,70-71 · v4 UI-26 | `app/in` không tồn tại, export không route | W4.3 | `[ ]` |
| 29 | Đa workspace 4 trục + ReadOnlyGuard PA1 + 3 theme | v4 UI-01..06 | components Workspace*/ReadOnlyGuard không có | W4.4 | `[ ]` |
| 30 | PWA + NotificationCenter realtime | v4 UI-19/10 | manifest/sw không có; notif chưa realtime-hoá UI | W4.5 | `[ ]` |

*(Ghi ngoài bảng: v4.2/4.3 ketoan+ledger+khachhang+baoduong v.v.v. 211 tập tin nháp KHÔNG
thuộc 3 trục — xử lý theo quyết định mở §7.2-b, không nằm trong W0–W5.)*

---

## §6 GATE TỪNG WAVE

| Gate áp dụng MỌI wave | Lệnh | Ngưỡng |
|---|---|---|
| Typecheck | `npx tsc --noEmit` (cwd `gara_reconstruction_v5`) | = 0 |
| Conformance | `npm run test:conformance` (runner tự nạp mọi `tests/conformance/*.test.ts` — test mới TỰ ĐỘNG vào gate) | ≥ số dự kiến dưới |
| Commit từng wave | commit riêng + message "Wn.x …" | bắt buộc |

| Wave | Nội dung | Pass dự kiến (`test:conformance`) |
|---|---|---|
| W0 | fix race + recalc totals + rà registry | ≥ **300** (baseline đã đo **296** + `kho_race.test.ts` mới + test totals) |
| W1 | kho 2 tầng/tonKho/cu_hong/thanhly/autoXuat/giaLichSu/GTTV | ≥ **330** |
| W2 | DM đủ vòng đời + RBAC `mua.duy` | ≥ **345** |
| W3 | xưởng kanban/KPI/cache/sửa-dòng/snapshot/deadline | ≥ **365** · (W3.9 nếu duyệt: + state-machine/IDOR) |
| W4 | admin+must_change/search/in+export/workspace/PWA/boss-pack | ≥ **380** |
| **W5** | verify tổng → **tag `v5.2.0`** | **ALL GREEN** ~380+ (PLAN: "324 + test mới ~60"; **lưu ý lệch:** bằng chứng chốt hiện ghi **296/296** — chạy lại ở W0 để chốt baseline trước khi tính cửa 380) |

Kết W5: bump 5.2.0 + `scripts/version-consistency.mjs` OK + cập nhật `docs/MASTER_PLAN.md` +
`docs/CHANGELOG.md` + Production Check 4 câu bàn giao (AGENTS.md mục 5).

---

## §7 ONPREMISE / CI / DEPLOY + QUYẾT ĐỊNH MỞ

### 7.1 Hạ tầng đã có (đọc source)

| Hạng mục | Thực tế |
|---|---|
| `Onpremise/docker-compose.yml` | `supabase-db` (supabase/postgres:15.8) + `supabase-realtime` + `supabase-storage` + `cencom-web` (standalone, port nội bộ 3000, env override DATABASE_URL → service DNS) + `cencom-nginx` (80/443 self-signed, IPv4-forced) |
| `Onpremise/docker-compose.mcp.yml` | override TM8: service `cencom-mcp` chạy `mcp-server/http.ts` qua tsx, bind **loopback 127.0.0.1:3001** (bên ngoài chỉ qua nginx `/mcp` — `nginx/mcp.conf`), bearer bắt buộc |
| Scripts | `init_certs.sh`, `init_db.sh`, `deploy_local.sh`, `backup_db.sh`/`restore_db.sh`/`rollback.sh` (đều chỉ vào container PG `cencom_v5_pg` khi chạy standalone dev/test; trên compose on-prem là `supabase-db`) |
| CI workflow | **2 file:** repo-root `.github/workflows/ci.yml` = gate đầy đủ (postgres:16 → npm ci → `tsc --noEmit` → `npm run lint` → `npm run test:conformance` → `npm run build` → docker build+audit); `gara_reconstruction_v5/.github/workflows/ci.yml` = mcp-gate nhẹ (postgres:15 + version-consistency + mcp.test.ts). Phụ thêm: `deploy.yml`, `k6-nightly.yml`, `uat-video.yml` |
| Local dev/test PG | container **`cencom_v5_pg`** (DATABASE_URL `…@localhost:5432/cencom` theo `.env.local`) — web :3003, MCP http :3001 |

**⚠️ Chưa có: `git remote`** — `git remote -v` → rỗng. Hệ quả: CI/CD chưa từng chạy thật trên
GitHub; W5.5 "push khi có remote" bị chặn tới khi chủ dự án cấp URL (PLAN Phần 7 đã ghi nhận).

### 7.2 HAI QUYẾT ĐỊNH MỞ — ĐỂ TRỐNG CHO CHỦ DỰ ÁN CHỌN (nguyên văn PLAN_HOI_TU_01.09 Phần 5)

> 1. ☐ **TK thăm khám: LÀM / KHÔNG** (mặc định KHÔNG — xem Wave 3.9)
> 2. ☐ **211 file draft GĐ4/GĐ5** (ketoan/ledger/khachhang/baoduong/UI v4): commit trước hay hội tụ trước? *(Khuyến nghị: commit draft trước để không mất code — đó là nguồn để port Wave 4)*

---

*W0.DOC chấm dứt tại đây. File này là bản đồ dẫn đường cho W0→W5; cập nhật mỗi cuối wave
(đặc biệt §2 số liệu và §5 trạng thái `[ ]` → `[x]`).*
