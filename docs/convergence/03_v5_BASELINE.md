# v5 Baseline (gara_reconstruction_v5) + MCP v5.1.0

> **Mục đích:** baseline hội tụ — liệt kê CHÍNH XÁC v5 đang có gì + khung MCP sẵn để gắn tiếp.
> **Ngày khảo sát:** 2026-09-01 · **Nguồn đọc:** `gara_reconstruction_v5/` (package.json version = **5.1.0** ✅)
> **Phương pháp:** đọc trực tiếp mã nguồn (`lib/rpc.ts`, `lib/perm.ts`, `lib/core/*.ts`, `lib/contracts.ts`, `mcp-server/*`, `app/(app)/**`, `db/schema.sql`, `tests/**`).KHÔNG chạy test (researcher read-only). Mọi con số là **đếm từ source**, sai lệch so với đề bài được ghi chú minh bạch.

---

## 1. Core RPC — 36 fn (`lib/rpc.ts`)

Registry tập trung: `FN_LIST` (36) + `META` (32 fn có quyền; 4 fn OPEN không cần) + `HANDLERS` + `dispatch(api, fn, args)` **fail-closed** (fn chưa khai báo META → 403). `getRegistry()` expose cho MCP server + test — **đây là trục đồng nhất: tool name ≡ fn name từng ký tự.**

| # | fn | module (file core) | perm (META) | mô tả |
|---|---|---|---|---|
| 1 | `login` | OPEN (rpc.ts) | — | Hướng dẫn gọi `/api/auth` (login thật ở route HTTP, cookie `sid`) |
| 2 | `logout` | OPEN | — | Trả ok; clear cookie do `/api/auth` lo |
| 3 | `currentUser` | OPEN | — | Trả actor từ session (`api.auth.current()`) |
| 4 | `appInfo` | OPEN | — | Tên app, version, danh sách ROLES |
| 5 | `xeList` | `core/xe.ts` | xe.xem | Danh sách xe đang hoạt động (is_test=0) theo biển số |
| 6 | `xeGet` | `core/xe.ts` | xe.xem |_one xe theo id (soft-delete filter) |
| 7 | `xeCreate` | `core/xe.ts` | xe.tao | Tạo xe (validate bien_so/nam_sx 1900–2100/nguyen_gia; admin → gắn is_test) |
| 8 | `scList` | `core/sc.ts` | sc.xem | Danh sách SC, filter `trang_thai` whitelist enum; ẩn `is_test` với role không phải admin/giamdoc |
| 9 | `scGet` | `core/sc.ts` | sc.xem | Một SC; giữ nguyên hành vi v3.6: quyền `sc.xem` là xem được mọi SC (không check sở hữu) |
| 10 | `scCreate` | `core/sc.ts` | sc.tao | Tạo SC `de_xuat`, require xe tồn tại; audit `sc_tao` |
| 11 | `scAddCongViec` | `core/sc.ts` | sc.sua | Thêm dòng công việc `sc_congviec` (whitelist `loai_xu_ly`: thay_moi/sua_chua/bao_duong/khac; STT tự tăng) |
| 12 | `scAddVatTu` | `core/sc.ts` | sc.sua | Gắn vật tư vào SC (`sc_vattu`, so_luong dương) |
| 13 | `scBatDauSua` | `core/sc.ts` | sc.sua | `de_xuat → dang_sua` (chặn trạng thái khác) |
| 14 | `scHoanThanh` | `core/sc.ts` | sc.sua | `dang_sua → da_hoan` |
| 15 | `scTuChoi` | `core/sc.ts` | sc.sua | `de_xuat → tu_choi` + lý do (đóng cửa từ chối theo v3.6) |
| 16 | `scQuyetToan` | `core/sc.ts` | sc.kehoach | `da_hoan → da_quyet`; **hard-gate role ketoan/admin** + **chặn bởi checkHoSo 8 bước**; audit + log WARN khi deny |
| 17 | `vattuList` | `core/kho.ts` | kho.xem | Danh sách vật tư (loc is_test/deleted) |
| 18 | `vattuGet` | `core/kho.ts` | kho.xem | Một vật tư theo id |
| 19 | `vattuCreate` | `core/kho.ts` | kho.tao | Tạo danh mục vật tư (ten/don_vi/gia/ton_min) |
| 20 | `nhapKho` | `core/kho.ts` | kho.tao | Ghi phiếu `nhap_xuat` loai='nhap' + `ton += sl` |
| 21 | `xuatKho` | `core/kho.ts` | kho.xuat | Ghi phiếu 'xuat' + kiểm **Thiếu tồn kho** trước khi `ton -= sl` (tuỳ chọn gắn `sc_id`) |
| 22 | `dmCreate` | `core/kho.ts` | kho.tao | Tạo-demand mua `dm` + `dm_chitiet` (validate từng item TRƯỚC khi ghi; `tong` tự tính; trang_thai='cho_duyet'; gắn sc_id nullable) |
| 23 | `dmNhap` | `core/kho.ts` | kho.tao | Demand → 'da_nhap': cộng ton từng dòng theo items |
| 24 | `baogiaList` | `core/baogia.ts` | baogia.xem | Danh sách báo giá |
| 25 | `baogiaGet` | `core/baogia.ts` | baogia.xem | Một báo giá + chi tiết |
| 26 | `baogiaSave` | `core/baogia.ts` | baogia.tao | Lưu báo giá NCC + items + **tự mirror sang `bao_gia_ncc` (ocr_xac_nhan=1)** để nuôi bước 3 hồ sơ |
| 27 | `hoSoGet` | `core/ho_so.ts` | hoso.xem | Hồ sơ kế toán mới nhất của 1 SC |
| 28 | `hoSoSave` | `core/ho_so.ts` | hoso.tao | Lưu hồ sơ kế toán (so_chung_tu/ngay/ghi_chu) |
| 29 | `hoSoList` | `core/ho_so.ts` | hoso.xem | Liệt kê hồ sơ (lọc sc_id) |
| 30 | `hoSoCheck` | `core/ho_so.ts` (checkHoSo) | hoso.xem | **Kiểm 8 bước QC206** → `{ok, steps[], miss[]}`; chặn 1,2,3,4,5,7,8; bước 6 không bắt buộc |
| 31 | `keHoachSave` | `core/ho_so.ts` | sc.sua | Lưu **Kế hoạch SC (mẫu 01)** — bước 1 |
| 32 | `kiemTuSave` | `core/ho_so.ts` | sc.sua | Lưu **Phiếu kiểm tu** — bước 2 |
| 33 | `nghiemThuSave` | `core/ho_so.ts` | sc.kehoach | Lưu **Biên bản nghiệm thu** (tong_vat_tu/tong_nhan_cong) — bước 7 |
| 34 | `activityFeed` | `core/activity.ts` | activityFeed.xem | Feed audit-log (lọc sc_id/theo ngày; **limit clamp 0–200**) |
| 35 | `dashboard` | **STUB** rpc.ts | dashboard.xem | ⚠️ `Promise.resolve({ok:true})` — **chưa có nghiệp vụ tổng hợp** |
| 36 | `report` | **STUB** rpc.ts | report.xem | ⚠️ `Promise.resolve({ok:true})` — **chưa có báo cáo** |

**Hàm export core ngoài RPC:** `logActivity()` (điểm ghi audit duy nhất, fail-safe không làm sập nghiệp vụ). Enum whitelist: `TT` 5 trạng thái SC, `LOAI_XU_LY` 4 loại. Helpers validate cứng trong từng file (requireStr/optionalStr/requirePositiveNumber/optionalNumber) — chống type-confusion injection.

---

## 4 vai hiện có — **Thực tế là 5 vai** (`lib/perm.ts`)

> Đề bài ghi "4 vai" — **xác nhận từ source: ROLES = 5**: `['admin','giamdoc','xuong','ketoan','kho']`. MATRIX hard-code trong code (không có bảng `phan_quyen` động như v3.6; admin bypass cứng trong `can()`).

| Vai | Quyền chính (module:action) | Ghi chú hội tụ |
|---|---|---|
| `admin` | `all:all` (bypass `can()`) | Data tạo bởi admin gắn `is_test=1` (rule present mọi core fn) |
| `giamdoc` | Xem toàn bộ: xe/sc/kho/baogia/hoso/dashboard/activityFeed/report | **Chỉ đọc** — không tao/sua/duy (khác v3.6: giamdoc từng có `sc.duy`/`mua.duy`/`asset.duy`) |
| `xuong` | sc: xem/tao/sua/**kehoach**; xe/kho/baogia/hoso/dashboard/activityFeed: xem | `sc.kehoach` mở đường cho `nghiemThuSave`; **không** quyết toán (đã siết so với v3.6) |
| `ketoan` | baogia: xem/tao; hoso: xem/tao/sua; sc: xem/**kehoach**; kho/xe/report/dashboard/activityFeed: xem | fn `scQuyetToan` hard-gate thêm `ketoan/admin` ngay trong core (defense-in-depth) |
| `kho` | kho: xem/tao/sua/**xuat**; dm: xem/tao; xe/sc/baogia/hoso/activityFeed: xem | **Không** dashboard/report (rbac.test enforce); không có quyền duyệt DM mức role riêng — `dmNhap` chỉ cần `kho.tao` |

---

## 2. UI v5 — danh sách màn hình (`app/(app)/**` + app/api)

| Route | File (dòng) | Tiêu đề | RPC fn gọi từ màn hình |
|---|---|---|---|
| `/` | `page.tsx` (239) | **Dashboard** | `scList` + `activityFeed` (tổng hợp **client-side** vì RPC `dashboard` còn stub) |
| `/sc` | `sc/page.tsx` (1082) | **Quản lý sửa chữa** | `scList/scGet/scCreate/scAddCongViec/scAddVatTu`, `keHoachSave/kiemTuSave/nghiemThuSave/hoSoSave`, `hoSoCheck` (panel 8 bước), `vattuList/xeList/activityFeed` |
| `/xe` | `xe/page.tsx` (222) | **Bảng xe** | `xeList`, `xeCreate` |
| `/kho` | `kho/page.tsx` (917) | **Quản lý kho** | `vattuList/vattuCreate`, `nhapKho`, `xuatKho`, `dmCreate`, `scList` (⚠️ không có UI đọc/duyệt demand DM) |
| `/baogia` | `baogia/page.tsx` (800) | **Báo giá** | `baogiaList/baogiaGet/baogiaSave`, `scList` |
| `/hoso` | `hoso/page.tsx` (325) | **Hồ sơ kế toán** | `hoSoGet/hoSoSave/hoSoList`, `scList` |
| `/login` | `app/login/` | Đăng nhập | `/api/auth` |
| API | `app/api/` | — | `rpc` (POST {fn,args} — contract chính), `auth`, `health`, `metrics` (Prometheus), `realtime` |
| Shared | `components/nav.tsx` · `lib/hooks/useApi.ts` · `useRealtime.ts` | Điều hướng + hooks | Realtime: channel `sc/vattu/nhap_xuat/sc_vattu/activity` qua pg LISTEN/NOTIFY (`db/realtime_triggers.sql`) — **không polling** ✅ |

**Không có:** trang admin quản lý user/ma trận quyền, trang `/in/*` in A4, màn demand-mua (danh sách DM), màn kanban xưởng, màn tham khám (TK), chat.

---

## 3. MCP server v5.1.0 (`mcp-server/` + `lib/contracts.ts`)

| Thành phần | File | Nội dung thực tế |
|---|---|---|
| Server stdio | `index.ts` | **32 tool = FN_LIST \ 4 OPEN**, auto-sinh từ `getRegistry()` (không khai báo tay → anti-lệch). Version đọc từ package.json = **5.1.0. Docs-completeness gate**: thiếu TOOL_DOCS fn nào → **throw khi khởi động** ✅ |
| Tool docs | `tool-docs.ts` + `part1–3.ts` | **32 mục** (10+11+11): title + mô tả **song ngữ [vi]/[en]** + `perm` (từ META) + `mode` READ/WRITE + example args. Nguồn duy nhất cho description |
| Hợp đồng input (zod) | **`lib/contracts.ts`** (KHONG phải `mcp-server/contracts.ts` — file đó không tồn tại) | **17 zod shape** (đề bài ghi 19 → thực đo 17): đủ cho các fn GHI quan trọng (sc*, kho*, dm*, baogiaSave, hoSoSave, 3 fn hồ sơ). fn còn lại → `z.object({}).passthrough()` (validate nghiệp vụ vẫn do core + rbac.test gánh) |
| Auth | `auth.ts` | **Service-account**: `MCP_USER/MCP_PASS/MCP_ROLE` (mặc định role `giamdoc` = chỉ đọc) qua `.env.mcp` (hỗ trợ UTF-16 LE/BE BOM + fallback `.env.local`). `resolveActor()` login 1 lần, cache + verify role khớp DB. **`READ_TOOLS` = 16** (14 trong 32 tool + currentUser/appInfo). **`MCP_WRITE_TOOLS=''` mặc định → 18 WRITE tool trả `403 write tool disabled`** trước khi chạm core. Audit **mọi call** (kể cả denied) → `activity_log` `hanh_dong='mcp_call'`, `mo_ta` chứa `channel=mcp` |
| HTTP LAN | `http.ts` | **TM8**: Streamable HTTP cùng bộ 32 tool (`MCP_TRANSPORT=http`, default `0.0.0.0:3001`, endpoint `/mcp` duy nhất). **Bearer `MCP_API_KEY` fail-closed** (thiếu key → 401 mọi traffic; `timingSafeEqual` chống timing attack). Session stateful (`Mcp-Session-Id`, 1 McpServer/transport), JSON-response mode (proxy nginx dễ), cap body 8 MiB, keepAlive 65s, graceful shutdown SIGINT/TERM, `unhandledRejection` net. ⚠️ HTTP mode **không đăng ký resources/prompts** (chỉ stdio) |
| Resources | `resources.ts` | **2 template**: `sc://{sc_id}` = `{hoSo: checkHoSo, sc: scGet}` (list ≤20 instance), `xe://{xe_id}` = xeGet. Lỗi → JSON `{"error":...}` không ném trần. **RBAC dùng đúng core handler làm trọng tài** |
| Prompt | `resources.ts` | **1 prompt**: `ho-so-sc-chuan-qc206` — hướng dẫn QC206 8 bước (zero-arg) |
| Test bám MCP | `mcp.test.ts` (7), `mcp_resources.test.ts` (6) |tool list + WRITE guard + audit; resources/prompt discovery |

**Đóng gói:** `MCP_WRITE_TOOLS` allowlist CSV theo fn; docs `mcp-server/README.md` + `mcp.json.example` + `.env.example`; scripts npm `mcp` (stdio). Docker LAN: `Onpremise/docker-compose.mcp.yml` (tham chiếu trong header http.ts).
**Bằng chứng chạy gần nhất:** `tests/ux/evidence_29.08.md` (M1 31.08: 32 tools OK, **296/296 conformance xanh**, smoke 5.0.0). `tests/ux/mcp_adversarial.mjs` + `mcp_security_report.md` tồn tại.
**Conformance hiện có:** 11 suite (`business 28, contract 6, ho_so 14, mcp 7, mcp_resources 6, qc206 13–14, rateLimit 6, rbac 141 động, rpc 35, rpc_hoso 26, security 26`) — 172 khai báo `it/test` tĩnh + ma trận RBAC sinh động 5 vai × 28 fn; **tổng thực tế mỗi lần chạy ≈ 296–310** (lần đo cuối ghi nhận 296/296; con số "324" đề bài nêu chưa khớp bằng chứng đã lưu — nên chạy lại `npm run test:conformance` để chốt).

---

## 4. Schema PG (`db/schema.sql`) — 18 bảng + realtime triggers

Kiến trúc **LEAN plain PostgreSQL** (không Supabase RLS; soft-delete `deleted_at TEXT DEFAULT ''`; flag test `is_test`; id `PREFIX-000001` qua `nextId()` counter trong `config` với `FOR UPDATE`). Ngày tháng **TEXT `YYYY-MM-DD`** (quyết định chốt). SQL parameterized 100%.

| Nhóm | Bảng | Quan hệ chính |
|---|---|---|
| Auth | `users` (role CHECK 5 vai) | `activity_log.actor_id`, `*.nguoi_*` → users(id) |
| Xe | `xe` | `sc.xe_id` → xe(id) |
| SC | `sc` (CHECK 5 trang_thai; `tong_cong/tong_vt/tong`) · `sc_congviec` (CHECK loai_xu_ly; `tt` cho/dang/hoan; `don_gia`) | `sc_congviec.sc_id`, `sc_vattu.sc_id`, `nhap_xuat.sc_id`, `dm.sc_id`, `baogia.sc_id`, `ho_so.sc_id`, `ke_hoach_sc.sc_id`, `phieu_kiem_tu.sc_id`, `bien_ban_nghiem.sc_id`, `bao_gia_ncc.sc_id` → **SC là trục trung tâm (10 bảng con)** |
| Kho | `vattu` (ton, ton_min, gia; CHECK loai nhap/xuat) | `sc_vattu.vattu_id`, `nhap_xuat.vattu_id`, `dm_chitiet.vattu_id` → vattu; `nhap_xuat` (đa dụng cho DM-SC) |
| Mua sắm | `dm` (CHECK 'cho_duyet','da_nhap','tu_choi'; `tong`) · `dm_chitiet` | dm → sc nullable |
| Báo giá | `baogia` + `baogia_chitiet` · `bao_gia_ncc` (`ocr_xac_nhan`, `anh_bao_gia DEFAULT ''`) | baogia/bao_gia_ncc → sc |
| Hồ sơ 8 bước | `ke_hoach_sc` (b1) · `phieu_kiem_tu` (b2) · `bao_gia_ncc` (b3) · `nhap_xuat` (b4/b5) · `bien_ban_nghiem` (b7) | `ho_so` = hồ sơ kế toán riêng (khác 8 bước) |
| Audit | `activity_log` (BIGSERIAL, ts/TZ; idx ts/role/sc) | mọi fn core ghi vào đây |
| Config | `config` (key/value) | giữ counter nextId |
| Realtime | `db/realtime_triggers.sql` | 5 channel LISTEN/NOTIFY |

**Không có bảng** (so v3.6 rewrite docs): `chat_*`, `yeu_cau_tham_kham` (TK), `thanh_ly/phieu_nhap_thanhly`, `vattu_gia_lich_su`, `nhan_ky`, `sc_phien_ban`, `congviec` (danh mục chuẩn), `bieu_ma`, `phan_quyen` (ma trận động), `phieu_nhap/phieu_xuat` 2 tầng (v5 phẳng hoá thành `nhap_xuat` 1 dòng), `de_nghi_mua`, `phong_ban`, `log_audit` riêng (v5 dùng `activity_log`), `sessions` (v5 giữ session trong app).

---

## 5. Lỗ hổng so với 3 trục ưu tiên (đối chiếu v3.6 spec — `04_API_CONTRACT.md`, module exports gốc)

| Trục | v5 CÓ (đã chứng minh trong source) | v5 THIẾU (cần port/xây khi hội tụ) |
|---|---|---|
| **XƯỞNG** (TK tham khám → phân công → SC → theo dõi) | Máy trạng thái SC 5 bước + enum CHECK; gắn công việc/vật tư vào SC; hồ sơ 8 bước (keHoach/kiemTu/nghiemThu + `checkHoSo` chặn quyết toán); audit `hanh_dong` tiếng Việt + realtime `sc_changes`; RBAC `xuong.sc.xem/tao/sua/kehoach` | **Trục TK nguyên khối (10 fn v3.6): `tkCreate/tkList/tkGet/tkApprove/tkWorkshop/tkAssign/tkStart/tkCreateSC/tkFinish/tkSendImg`** — không bảng, không fn, không UI (yêu cầu tham khám → duyệt → giao thợ → nối tiếp INTO SC); `xuongDashboard`/`dashboardAll` **kanban 5 cột**; RPC **`dashboard` + `report` là STUB trả {ok:true}** (UI tổng hợp client-side ⇒ chưa chốt được logic server, chưa tối ưu, chưa vào RBAC thật được); `scApprove` (duyệt)/`scTongDuyet` + snapshot `sc_phien_ban`; `scSetDeadline`; **sửa/xoá** công việc (`scWorkSet/Del`) và vật tư (`scVtUpd/Del`) — v5 chỉ ADD, không cập nhật/xoá dòng; `thoList/assignWork/myTasks` (không có danh sách thợ/phân công/ca); `chitiet` chi phí: **`sc.tong / tong_vt / tong_cong KHÔNG code nào UPDATE** (chỉ test UPDATE tay) ⇒ bước 8 hồ sơ phụ thuộc dữ liệu tay — lỗ hổng logic tính tiền (recalc/syncPrices v3.6 mất tích); `nhanKy` (8 vị trí chữ ký) + `chitiet` lịch sử sửa chữa `lich_sua`; `cache` dashboard (v3.6 có `xuongDashboardCached/dashboardAllCached` — cần tương đương khi realtime đông client) |
| **MUA SẮM DM** (demand → duyệt → nhập → công nợ nhà cung cấp) | `dmCreate` (validate items trước ghi + tong tự tính, gắn `sc_id` nullable, `is_test`); `dmNhap` (chuyển `da_nhap` + **cộng tồn kho từng dòng**); schema `dm/dm_chitiet` đủ trạng thái `tu_choi`; audit `dm_tao/dm_nhap` | **KHÔNG có fn đọc danh sách DM nào: `dmList`/`dmDetail`/`dmListBySc`** (FN_LIST chỉ dmCreate/dmNhap — demand tạo ra rồi là "mù", không UI nào hiển thị DM); **`dmDecide` (duyệt/từ chối mua — `mua.duy`)** — trạng thái `tu_choi` tồn tại trong CHECK nhưng **không fn nào ghi được vào đó**; `dmDelete` soft-delete; **`dmFromSC`** (tự sinh demand từ thiếu hụt vật tư của SC — cầu nối XƯỞNG→MUA SẮM); `dmFromBaoGia`; `dmAutoBu` (bù tồn kho); **bảng giá vật tư theo NCC & lịch sử giá (`vattu_gia_lich_su`, `giaLichSuList`)**; đối sánh nhiều báo giá NCC/`baogiaSave` hiện **tự mirror `ocr_xac_nhan=1`** (bỏ qua bước người dùng xác nhận — cần cân nhắc đổi thành confirm tường minh); bảng `de_nghi_mua` + luồng 2 tầng phiếu; module RBAC `mua.*` của v3.6 (dm gộp vào `kho.*` —粒度 bị thô, ketoan từng có `mua.duy` ⇒ v5 KHÔNG ai duyệt DM được); `is_test` trong dm_create không được `dmNhap` kiểm (coi như bug tiềm tàng test-data lẫn thật) |
| **KHO** (nhập/xuất/tồn/minh bạch phiếu) | Vattu list/get/create; `nhapKho`/`xuatKho` (cộng/trừ tồn); **chặn "Thiếu tồn kho"** khi `ton < so_luong`; audit `kho_nhap/kho_xuat` + realtime 5 kênh; kiểm tra tồn khi xuất | Không có phiếu 2 tầng: `phNhapCreate/Get` + `phNhapList` & `phXuatCreate/Get` + `phXuatList` (mỗi nhập = 1 NHIỀU dòng chung 1 mã? v5 1 dòng = 1 phiếu); `tonKho` (bảng kê **tổng hợp còn thiếu + hết hạn** — chỉ mỗi cột `ton_min` mà chẳng chỗ nào đọc để **cảnh báo tồn kho thấp**); `vatTuSave` (sửa vattu)/`vatTuDel` (xoá mềm); `autoXuatSC` (tự xuất khi SC phát sinh vật tư — xuất tay + `xuatKho(sc_id?)` optional nên **không đồng bộ `sc_vattu ↔ nhap_xuat`**, bước 5 hồ sơ check `nhap_xuat` còn `autoGenCuHong` (VT cũ/hỏng nhập lại + thanh lý — bước 6 hiện chỉ là NOTE không chặn); `thanhLyList`/bảng `thanh_ly`; đơn giá xuất không giữ lại vào `sc_vattu (gd_dk/gd_tt luôn 0 — cột có trong schema nhưng không dùng)` **⇒ chi phí thực tế của SC không tính được**; ⚠️ **`nhapKho/xuatKho/dmNhap` dùng `UPDATE ton = ton + $2` ngoài transaction** — race condition khi nhiều thao tác đồng thời, vi phạm ghi transaction (chuan 3b) — **đây là lỗ hổng hội tụ PHẢI sửa khi port tiếp** |
| **Ch横 cắt** | 36-fn contract đồng nhất cho web HTTP `/api/rpc` + MCP; RBAC fail-closed trong dispatch; validate type-cứng mọi input core; audit `logActivity` bọc try/catch không sập nghiệp vụ | **Admin/User:** không có `userList/userAdd/userSetPassword/userSetActive/permMatrix/permSave/thresholds*` (7 fn v3.6) — không quản trị được tài khoản qua RPC; `changePassword/**must_change=1` cột DB có `must_change=1` mặc định nhưng **không RPC/UI nào chặn buộc đổi mật khẩu lần đầu** (OWASP fail — bàn giao phải nêu ở Production Check); 8→5 vai: gộp `tho`(thợ)→`xuong`, `laixe`(lái xe)→mất quyền tạo TK (vì TK mất luôn), `khoa`→ `kho`, `quanly`→ gộp vào `xuong.sc.kehoach` + `ketoan`; **xuất/in:** `/export/*.xlsx` 7 route (`report/vehicle/accounting/tonkho/phxuat/quyettoan/tk`) + `/in/*` A4 8 route (kế hoạch/kiểm tu/báo giá/nhập/xuất/nghiệm thu/bảng kê/hồ sơ) — **không có bất kỳ file nào trong app v5** ❌ (plan GĐ4–6 mới in A4); `chat` (8 fn + realtime + /chat/img): **không có bảng, không fn, không UI** (đã quyết định giữ lại realtime cho kho/sc nhưng riêng chat thì bị cắt khỏi 36 fn); `preview` admin mode (5 fn) — cắt được (điểm cộng chủ động); `security`: **`nhapKho/xuatKho/dmNhap` có race condition** (đã nêu); **API_KEY Bearer MCP chỉ 1 key chung LAN** — chia quyền theo user chưa có ở tầng HTTP MCP (RBAC vẫn do actor `MCP_ROLE` duy nhất ⇒ audit MCP không phân biệt được người thật đứng sau); rate-limit đã có nhưng cần mở rộng cho MCP HTTP mode. 4 OPEN fn không qua RBAC (login/logout placeholder) — nhất quán doc, đã verify qua `security.test.ts` tồn tại |

**Kết luận đếm được (cho shared-context):**
- Core RPC: **36** fn · **5** vai · **31** fn + handler thật + **2** fn stub + **3** fn validate thêm.
- UI: **6** trang chính (dashboard/sc/xe/kho/baogia/hoso) + login + **5** API route (rpc/auth/health/metrics/realtime).
- MCP: **32** tool + **2** resource template + **1** prompt + stdio + HTTP-Bearer-LAN + **17** zod input + audit-mcp + WRITE allowlist + docs-gate; version **5.1.0**.
- DB: **18** bảng; bằng chứng test: **296/296** conformance + 10/10 UX + tsc 0 lỗi (`tests/ux/evidence_29.08.md`, cập nhật MCP 31.08).
- 3 điểm NÓNG khi hội tụ: (1) TK/trục xưởng chưa port; (2) DM không đọc/duyệt được (thiếu 4–5 fn) + `dm.tu_choi` chết; (3) kho thiếu phiếu 2 tầng + **race condition cộng/trừ tồn** + `sc.tong` không ai tính.
