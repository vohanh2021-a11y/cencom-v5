# PLAN_HOI_TU_01.09 — HỘI TỤ v3.6 + v4 + v5 → BẢN HOÀN CHỈNH + MCP NHÚNG

> Ngày lập: 2026-09-01. Basis: v5.1.0 (tag `v5.1.0`, commits `65e8722`→`08996b4`).
> Nguồn nghiên cứu: `docs/convergence/01_v3.6_FEATURES.md` (98 tính năng), `02_v4_FEATURES.md` (65 hạng mục), `03_v5_BASELINE.md` (36 fn + MCP v5.1.0).
> **Nguyên tắc số 1:** giữ v5 làm baseline (Next.js + PG thuần, conformance xanh, MCP v5.1.0) — port NGUYÊN hành vi v3.6/v4, "Preserve, don't improve". Không đổi contract `POST /api/rpc {fn,args}`, không đổi tên fn đã có.
> **Nguyên tắc số 2:** mọi fn mới port về = tự động có MCP tool (registry-driven) + zod contract + test parity — KHÔNG viết MCP riêng cho từng tính năng.

---

## PHẦN 1 — MỤC TIÊU 3 TRỤC (theo chủ dự án)

| Trục | Mục tiêu hội tụ | KPI thành công |
|---|---|---|
| ① **Quản trị hoạt động xưởng** | Kanban 5 cột 1-xe-1-thẻ · KPI 11 chỉ số · phân công thợ · Tổng duyệt + snapshot · sửa/xóa dòng CV/VT · `sc.tong` tự tính | Sếp mở 1 màn hình thấy TOÀN BỘ xưởng đang làm gì |
| ② **Hồ sơ mua sắm (DM)** | dmList/dmDetail/dmDecide/dmFromSC/dmAutoBu/dmDelete · ngưỡng duyệt `duyet_mua_nguong` · lịch sử giá NCC · so sánh báo giá đa NCC | DM từ SC→duyệt→nhập→tồn, truy vết 2 chiều SC↔DM |
| ③ **Kho tàng xưởng** | Phiếu nhập/xuất 2 tầng · tonKho cảnh báo ton_min · kho hư hỏng `ton_cu_hong` + autoGenCuHong + thanh lý · GTTV khấu hao · autoXuatSC · lịch sử giá · **fix race condition tồn kho** | Tồn kho chính xác realtime, cảnh báo thiếu, thu hồi VT cũ tự động |

**Cross-cutting:** Admin user-mgmt (7 fn) · must_change enforce · `/in/*` A4 + export xlsx · GlobalSearch · đa workspace 4 trục + ReadOnlyGuard PA1 · PWA · **AI cho sếp: MCP resources/prompts mở rộng cho 3 trục — sếp hỏi tiếng Việt qua MCP**

---

## PHẦN 2 — PHÁT HIỆN NÓNG PHẢI XỬ LÝ NGAY (Wave 0)

| # | Phát hiện | Vị trí | Hành động |
|---|---|---|---|
| 0.1 | GAP TĨNH v4 (không ảnh hưởng v5 — v5 đã có `keHoachSave/kiemTuSave` ✅); chỉ thiếu `congViecSave/congViecDel` (danh mục công việc chuẩn) | `lib/rpc.ts` | W0.3: verify + đăng ký nếu thiếu |
| 0.2 | **Race condition tồn kho**: `nhapKho/xuatKho/dmNhap` dùng `UPDATE ton = ton ± $2` ngoài transaction | `lib/core/kho.ts` | **W0.1: bọc transaction + `SELECT ... FOR UPDATE`** (Chuan 3b) |
| 0.3 | **`sc.tong/tong_vt/tong_cong` không code nào UPDATE** → bước 8 QC206 phụ thuộc data tay | `lib/core/sc.ts` | W0.2: hàm `recalcScTotals()` gọi sau mọi ghi CV/VT |
| 0.4 | `dmFromBaoGia` còn dang dở v4 (stub lỗi) — AI-OCR đã chốt BỎ | v4 `kho.ts` | W0.3: KHÔNG port, tài liệu hóa quyết định |

## PHẦN 3 — WAVE KẾ HOẠCH (5 wave, mỗi wave có Gate verify + commit riêng)

### WAVE 0 — Fix nóng nền móng — ✅ HOÀN THÀNH (01.09, gate 336/336)
| Task | Việc | Files | Gate |
|---|---|---|---|
| [x] W0.1 | **Fix race condition kho**: `withTransaction` vào `db.ts`; row-guard `ton>=$2 RETURNING` (bỏ check-then-act); dmNhap 1 tx atomic | `lib/core/kho.ts`, `lib/db.ts` | ✅ `kho_race.test.ts` 4/4 (10×xuat sl6 ton40 → đúng 6 ok, ton cuối=4) |
| [x] W0.2 | **recalcScTotals()**: 1 statement atomic, `tong_vt = CASE(gd_tt>0,gd_tt,gd_dk)` đúng schema v5 | `lib/core/sc.ts` | ✅ `sc_totals.test.ts` 8/8; bước 8 QC206 hết phụ thuộc data tay |
| [x] W0.3 | Rà FN_LIST: v5 registry ĐỦ phạm vi v5 (GAP TĨNH ktSave/chỉ là của v4); `dmFromBaoGia` xác nhận KHÔNG port | `lib/rpc.ts` (không đổi) | ✅ |
| ➕ BACKLOG phat-sinh-tu-W0 | (a) `scAddVatTu` không nhận đơn giá → `gd_dk=0` → RPC **scVtUpd** vào W3.4; (b) CRUD danh mục công việc (v3.6 `congViec*`) vào W3.3; (c) pool max=10: theo dõi W4 nếu batch >10 tx; (d) audit trong tx (fail→rollback cả thao tác — an toàn hơn); (e) deadlock dmNhap 2 DM chéo: PG tự abort + client retry (chấp nhận) | W1/W3/W4 | (ghi nhận 01.09) |

### WAVE 1 — TRỤC ③ KHO — ✅ HOÀN THÀNH (01.09; gate tsc=0, conformance 378/378 18 suites, Playwright kho 4/4)
| Task | Việc | Files | Gate |
|---|---|---|---|
| [x] W1.1 | **Phiếu 2 tầng**: `nhap_xuat.phieu_id` + group-by-eff (COALESCE), `phieuList/phieuGet` (filter whiltelist + phân trang + legacy tương thích) | `schema.sql`, `kho.ts`, rpc/meta/contracts/part4 + docs | kho_phieu2tang 5/5; sửa luôn mcp.test→động |
| [x] W1.2 | **tonKho** (low/thieu/ton_cu_hong/giaTriTonKho aggregate + limit ≤200) + [x] W1.5 **vattu_gia_lich_su** + `ghiGiaLichSu` hook `nhapKho/dmNhap` (tx) + `giaLichSuList` | `schema.sql`, `kho.ts`, rpc | kho_tonkho 7/7; dedupe liên tiếp |
| [x] W1.3 | **cu_hong**: `ton_cu_hong` + `thanh_ly` + row-guard 'Không đủ tồn hư hỏng' + `autoGenCuHong` (chống trùng theo cap sc/vattu) + `thanhLyList`; [x] W1.4 **autoXuatSC** (1 PXX khi đủ; FIX BUG kế thừa v3.6 đếm cả phiếu thu hồi) | `schema.sql`, `kho.ts`, meta | kho_cuhong 6/6. Auto* chưa expose RPC — hook vào scHoanThanh W3 |
| [x] W1.6 | **GTTV asset**: `assetXe/assetReport` (KH không N+1; fallback khau_hao_nam=10) | `lib/core/asset.ts` mới + rpc META `['xe','xem']` (module asset chưa có trong MATRIX → dùng xe.xem) | asset_gttv 12/12 (6 core + 6 HTTP RBAC) |
| [x] W1.7 | **UI Kho** tab 2 tầng (Phiếu group/expandable, Tồn-kho badge đỏ+famili fallback, form nhap/xuat loai cu_hong+thanly, realtime EventSource inline — FIX `useRealtime` import pg→500) | `app/(app)/kho/page.tsx` | Playwright 4/4 |
| [x] W1.8 | **MCP**: docs part4 + `server-core.ts` (tách loop trùng) + HTTP resources/prompts parity + `mcp_http.test` 5/5; READ_TOOLS cập nhật | `mcp-server/*` | mcp stdio regression 18/18, tools=40 động |
→ Backlog W1→W3: hook autoGen/autoXuat vào scHoanThanh; RBAC_FNS coverage mới (11+ fn); e2e comment/định kỳ; UI cột toán lý raw keys.

### WAVE 2 — TRỤC ② MUA SẮM DM (3–4 ngày, sau W1)
| Task | Việc | Files | Gate |
|---|---|---|---|
| W2.1 | `dmList/dmDetail/dmListBySc/dmDelete` (đọc + soft-delete có ràng buộc) | `lib/core/kho.ts` | test |
| W2.2 | **`dmDecide`** duyệt/từ chối + ngưỡng `duyet_mua_nguong` (config) + audit | `kho.ts` + `lib/perm.ts` (`mua.duy` cho giamdoc/admin) | test RBAC: kho duyệt ≤ ngưỡng, giamdoc duyệt > ngưỡng |
| W2.3 | **`dmFromSC`**: gom `sc_vattu tt='can_mua'` → 1 DM, chặn trùng DM đang mở | `kho.ts` | test: 2 SC cần cùng VT → gộp dòng |
| W2.4 | `dmAutoBu` (quét ton<ton_min → tự tạo DM bù) | `kho.ts` | test |
| W2.5 | UI chọn giá NCC cũ (top 8) khi thêm VT vào SC | `kho/page.tsx` | smoke |
| W2.6 | **UI Mua sắm**: trang `/kho/dm` (list + filter trạng thái + nút duyệt/từ chối theo quyền) + nút "Tạo DM từ SC" trong `/sc` | `app/(app)/kho/dm/page.tsx` (mới) + `sc/page.tsx` | Playwright |
| W2.7 | **MCP**: resource `dm://{dm_id}` + tool-docs part5 + prompt `quy-trinh-mua-sam` | `resources.ts`, tool-docs | docs-gate |

### WAVE 3 — TRỤC ① XƯỞNG (3–4 ngày)
| Task | Việc | Files | Gate |
|---|---|---|---|
| W3.1 | **Kanban 5 cột 1-xe-1-thẻ** (port `dashboardAll` kanban: gộp SC theo xe, ETA gần nhất trước, % completion) | `lib/core/xuong.ts` (mới) + `app/(app)/sc/kanban/page.tsx` (mới) | test data-shape kanban |
| W3.2 | **KPI xưởng 11 chỉ số** (`xuongDashboard` + `dashboardAll` + cache TTL theo role 60s, clear-on-write) | `lib/core/xuong.ts` + `lib/cache.ts` | test KPI + cache |
| W3.3 | **Phân công thợ**: `thoList` (users role xuong) + gán `tho_id` dòng CV + `myTasks` (việc của tôi + overdue) | `xuong.ts` + `sc.ts` | test RBAC |
| W3.4 | **sửa/xóa dòng CV/VT** (`scWorkSet/scWorkDel/scVtUpd/scVtDel`) — gate: chỉ sửa khi SC `de_xuat` | `sc.ts` | test state-gate |
| W3.5 | **Tổng duyệt + snapshot bất biến** (`scTongDuyet` + bảng `sc_phien_ban`) | `sc.ts` + schema | test: snapshot 1 lần/phiếu, chặn sửa sau chốt |
| W3.6 | **scSetDeadline** (hẹn trả xe + audit) | `sc.ts` | test |
| W3.7 | **MCP cho sếp**: resource `xuong://kanban` (snapshot kanban + KPI) + prompt `quy-trinh-xuong` + tool-docs part6 | `resources.ts`, tool-docs | sếp hỏi "hôm nay xưởng đang làm gì?" → 1 câu KPI + kanban |
| W3.8 | **UI kanban + KPI xưởng** | `sc/kanban/page.tsx` + `sc/dashboard/page.tsx` | Playwright |

### WAVE 3.9 (OPTIONAL — chờ chủ dự án chốt) — TK Thăm khám 9-trạng-thái (3 ngày)
> Trái tim vận hành v3.6 (lái xe báo → QLY duyệt → xưởng nhận → giao thợ → tạo SC → hoàn → SC nghiệm thu tự đóng TK). v5 đã chốt BỎ qua `migrate-tk-removal`. Port lại = thêm bảng + 10 fn + UI + vai lái xe.
| Task | Việc | Gate |
|---|---|---|
| W3.9.1 | Bảng `yeu_cau_tham_kham` + 10 fn (`tkCreate...tkFinish`) + IDOR-guard lái–xe + chặn nhảy trạng thái/duyệt 2 lần | test state machine + IDOR |
| W3.9.2 | UI `/tk` + portal lái xe `/tk/laixe` (gửi yêu cầu + ảnh + ưu tiên) | smoke |
| W3.9.3 | MCP resource `tk://{tk_id}` + tool-docs part7 | docs-gate |

### WAVE 4 — Cross-cutting + AI cho sếp (2–3 ngày)
| Task | Việc | Files | Gate |
|---|---|---|---|
| W4.1 | Admin user-mgmt 7 fn (userList/Add/SetPassword/SetActive + permMatrix/permSave + thresholdsSet) + **`must_change` enforce** (chặn RPC khi chưa đổi MK mặc định) | `lib/core/admin.ts` (mới) + `auth.ts` | test: must_change=1 → mọi fn ngoài changePassword 403 |
| W4.2 | GlobalSearch (`globalSearch` fn + UI) + CommandPalette Ctrl+K | `search.ts` + components | test |
| W4.3 | `/in/*` A4 8 mẫu + export xlsx 7 workbook | `app/in/[type]/[id]/page.tsx` + export route | in HTML A4 (KHÔNG .docx — đã chốt) |
| W4.4 | Đa workspace 4 trục + ReadOnlyGuard PA1 (giám đốc view-only) + 3 theme Glass/Bold/Calm | Workspace* components (port v4) | smoke |
| W4.5 | PWA + NotificationCenter realtime | manifest/sw + components | smoke |
| W4.6 | **Gói AI cho sếp**: resource `boss://dashboard` (KPI tổng 11 + VT thiếu + DM chờ duyệt + SC trễ deadline) + prompts `xuong-hom-nay`, `dm-cho-duyet`, `ton-kho-canh-bao` | `resources.ts` | sếp hỏi "tình hình?" → KPI + khuyến nghị |

### WAVE 5 — Verify tổng + Release v5.2.0 (1–2 ngày)
| Task | Việc | Gate |
|---|---|---|
| W5.1 | Full conformance (324 + test mới ~60) | ALL GREEN 380+ |
| W5.2 | Bump 5.2.0 + version-consistency | OK |
| W5.3 | Cập nhật `docs/MASTER_PLAN.md` + `docs/CHANGELOG.md` + evidence | docs |
| W5.4 | Commit + tag `v5.2.0` | commit riêng mỗi wave |
| W5.5 | Push khi có remote | CI GitHub chạy thật |

---

## PHẦN 4 — QUYẾT ĐỊNH THIẾT KẾ CHỐT

| # | Quyết định | Lý do |
|---|---|---|
| 1 | **v5 làm baseline, port NGUYÊN hành vi v3.6** | v5 có conformance xanh + MCP v5.1.0 + RBAC fail-closed — nền vững nhất |
| 2 | **MCP registry-driven, không viết tay tool** | 100% fn mới tự thành tool; AI đi qua cùng cửa phân quyền |
| 3 | **KHÔNG port AI-OCR / AI provider config** | AGENTS.md chốt BỎ; AI của ta = MCP |
| 4 | **KHÔNG port .docx** | Đã chốt in HTML A4 |
| 5 | **5 vai giữ nguyên** (admin/giamdoc/xuong/ketoan/kho) | v5 đã chốt; chỉ thêm quyền `mua.duy` |
| 6 | **Race condition fix TRƯỚC khi port kho mới** | Không fix trước = khuếch đại bug |
| 7 | **TK thăm khám = OPTIONAL mặc định KHÔNG** | Cần chủ dự án chốt riêng |

## PHẦN 5 — CHỦ DỰ ÁN CẦN CHỐT 2 QUYẾT ĐỊNH TRƯỚC KHI EXECUTE
1. ☐ **TK thăm khám: LÀM / KHÔNG** (mặc định KHÔNG — xem Wave 3.9)
2. ☐ **211 file draft GĐ4/GĐ5** (ketoan/ledger/khachhang/baoduong/UI v4): commit trước hay hội tụ trước? *(Khuyến nghị: commit draft trước để không mất code — đó là nguồn để port Wave 4)*

## PHẦN 6 — ĐỊNH NGHĨA HOÀN THÀNH (DoD)
- W0→W5 mỗi wave: tsc=0 + conformance ALL GREEN + commit riêng
- 3 trục đạt KPI Phần 1
- MCP: mọi fn mới = tool tự sinh + docs vi/en + resource/prompt cho 3 trục
- Tag `v5.2.0` + MASTER_PLAN + CHANGELOG update + Production Check 4 câu

## PHẦN 7 — RỦI RO & PHÒNG
| Rủi ro | Phòng |
|---|---|
| Port JS→TS (callback→async) lệch hành vi | Mỗi fn port = test parity khóa hành vi v3.6 |
| Migration SQLite→PG | Script riêng + verify số liệu |
| 211 file draft chưa commit — mất code | Chốt Phần 5-2 trước, commit draft |
| Không remote git | User cấp URL → push (chỉ việc còn treo của MCP) |
| MCP HTTP 1 Bearer chung | Sếp dùng stdio với user riêng; LAN giữ role giamdoc |
| 2 agent ghi cùng file | Ma trận file reservation per-wave, orchestration plan trước mỗi wave |

---
*Thứ tự execute: **W0 → W1 (Kho) → W2 (DM) → W3 (Xưởng) → [3.9 nếu chốt] → W4 (Cross+AI) → W5 (v5.2.0)**. Plan được lập từ 3 báo cáo `docs/convergence/01-03` (98 + 65 + 142 hạng mục). CHỜ DUYỆT trước khi execute.*
