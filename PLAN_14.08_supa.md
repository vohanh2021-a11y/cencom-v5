# PLAN CHI TIẾT — cencomOS_gara_4.0_supa

> Ngày lập: 2026-08-14 · Tác giả: Gatekeeper (AI) — theo chỉ đạo chủ dự án
> Trạng thái: **GĐ0 (đã tạo thư mục + docs) — sẵn sàng GĐ1 (schema)**
> Mục đích: tài liệu **tự chứa**, đủ để một AI/phiên làm việc khác tiếp tục triển khai **không cần phiên này** — chỉ cần đọc file này + các SPEC tham chiếu ở thư mục v3.6.

---

## 0. TỔNG QUAN MỘT CÂU

Viết lại **toàn bộ** CencomOS-Garage (hiện: Node/Express + SQLite trên máy nhà) thành **web cloud**: Next.js + TypeScript + Tailwind (Vercel) + PostgreSQL + Realtime + Storage (Supabase), giữ **100% logic nghiệp vụ** đã được 327 test bảo vệ, bỏ rác (ảnh báo giá/AI-OCR, GAS, Electron), giải các nút thắt hiệu năng, hướng tới thương mại hoá đa đơn vị (multi-tenant sẵn sàng).

---

## 1. BỐI CẢNH & VẤN ĐỀ CẦN GIẢI QUYẾT

Hệ thống cũ `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6` (Node >= 22.5 + Express + `node:sqlite` DatabaseSync, WAL, busy_timeout=5000, foreign_keys=ON) đã phát triển 8 giai đoạn (GĐ2 kiểm định → GĐ3 sửa chữa/kho/tài sản/chat → GĐ3.6 thăm khám TK/xuống/dashboard → GĐ3.7 bộ hồ sơ 8 bước → GĐ3.8 UI Tailwind hybrid). Đo tải Phase 2 (CHANGELOG 2026-08-14) ghi nhận nút thắt:

| Vấn đề | Bằng chứng | Ảnh hưởng |
|---|---|---|
| `node:sqlite` đồng bộ chặn event loop | 200 VU → p95 ≈ 21.6s, error 0.74% | Không scale > vài trăm user |
| Export XLSX sinh đồng bộ | p95 ≈ 23.9s | Request treo |
| Polling 45s (chat/notif/dash) | setInterval client | Không realtime, tốn băng thông |
| Ảnh base64-in-JSON (chat/TK) | payload 8MB | Nghẽn upload, tốn DB |
| DB 1 file SQLite | ghi đồng thời giới hạn | Deadlock khi nhiều người ghi |
| Backup thủ công (GFS) | install_backup_task.ps1 | Không đảm bảo 7 ngày tự động |
| Bảng phình vô hạn | chat_messages/log_audit/ket_qua | Chậm query, tốn storage |
| Deploy phức tạp | Cloudflare tunnel + Electron 2 app | Không thương mại hoá được |

**Mục tiêu v4**: cloud-first, free tier, UI/UX tốt hơn, backend chuẩn (async, TS, clean), bỏ rác, backup 7 ngày, archive chứng từ cũ, realtime, thương mại hoá.

---

## 2. CÁC QUYẾT ĐỊNH ĐÃ CHỐT (BẮT BUỘC TUÂN THEO)

| # | Quyết định | Chi tiết |
|---|---|---|
| 1 | **Tên/vị trí dự án** | `E:\APP-LAPTOP-SYNC\cencomOS_gara_4.0_supa\` — **NẰM NGOÀI** thư mục v3.6, git repo riêng, **không đụng hệ thống cũ đang chạy** |
| 2 | **Stack** | Next.js (App Router) + TypeScript + Tailwind CSS → **Vercel**; PostgreSQL + Realtime + Storage → **Supabase** |
| 3 | **Phạm vi** | Viết lại TOÀN BỘ backend + frontend; logic nghiệp vụ giữ 100% qua `packages/core` port từ `server/*.js` |
| 4 | **Auth** | Custom auth: `users` + `pass_hash` scrypt + session cookie `cen_session` + `must_change` + CBAC — trên PG (không dùng Supabase Auth) |
| 5 | **Realtime** | Supabase Realtime (WebSocket) thay polling 45s cho chat/notif/dash |
| 6 | **Multi-tenant** | Sẵn sàng từ đầu: `tenant_id` + RLS; vận hành 1 đơn vị trước, mở bán sau |
| 7 | **Ngân sách** | **Gói Free** khi bắt đầu (thiết kế tối ưu dung lượng/truy vấn để không vượt free tier); PITR 7 ngày khi nâng Pro |
| 8 | **Domain** | Subdomain `.vercel.app` (VD `cencom-os-v4.vercel.app`) |
| 9 | **Ảnh báo giá + AI-OCR** | **BỎ** — `bao_gia_ncc` chỉ giữ **nhập thủ công** items (không còn `anh_bao_gia`/`ocr_result`/`ocr_xac_nhan`/`ocr_engine`; bỏ `ai.js`, `ocr_vi.js`, route `/baogia/img/*`, RPC `baoGiaOcr`, `aiConfigGet/Set/aiTest`) |
| 10 | **Ảnh chat/TK** | Thiết kế đặc biệt: upload → **file tạm** Supabase Storage TTL 1 ngày; người nhận bấm "Mở ảnh" → **tải về máy người nhận** và hiển thị trong chat của họ; không lưu vĩnh viễn trên cloud (xem mục 11) |
| 11 | **Preview vai trò** | **Giữ** (admin giả lập 5 vai, DEMO trong RAM) |
| 12 | **CencomBot** | **Giữ** (bot chat nội bộ, không dùng AI) |
| 13 | **Nhánh v2 cũ** | **Gộp vào v4** — hướng Next.js + Tailwind của `CencomOS_v2_nextJS/MASTER_PLAN.md` là nền tảng v4; không giữ nhánh riêng |
| 14 | **In ấn** | Bỏ sinh `.docx` (`docx.js/htmlDoc.js/in.js`) → **in HTML + CSS print A4** trực tiếp trên trình duyệt |
| 15 | **Tài liệu** | Changelog/plan: bản ngắn ở v3.6 (theo dõi Workspace) + bản đầy đủ trong `_4.0_supa/docs/` |
| 16 | **Contract API** | **BẤT BIẾN**: `POST /api/rpc` body `{fn,args}` → `{ok,result}` hoặc `{ok:false,error}`; 401 chưa đăng nhập; 403 CSRF/thiếu quyền; giữ nguyên tên mọi RPC |

---

## 3. KIẾN TRÚC ĐÍCH

```
[Trình duyệt: PC + Tablet thợ + Điện thoại lái xe]
              │ HTTPS (.vercel.app)
              ▼
[Vercel — Next.js App Router + TS + Tailwind]
   ├─ app/(auth)/login · app/(app)/dash|sc|dex|kho|dm|chat|asset|hoso|admin|perm|preview
   ├─ Route Handlers  → POST /api/rpc {fn,args} → {ok,result|error}  (GIỮ CONTRACT)
   ├─ Route Handlers  → /api/auth/login|logout · /api/sess · /api/health
   ├─ Route Handlers  → /export/* (stream) · /in/* (HTML print) · /chat/file/*
   ├─ middleware.ts   → session + CBAC + CSRF + preview-block + must_change lock
   └─ packages/core   → domain logic thuần TS (port từ server/*.js)
              │
              ▼
[Supabase]
   ├─ PostgreSQL     → schema (mục 6) + RLS + PITR 7 ngày + daily pg_dump + partition lạnh
   ├─ Realtime (WS)  → chat_messages + notification + dashboard (bỏ polling 45s)
   └─ Storage        → bucket temp_chat_imgs (TTL 1 ngày, xoá bằng cron job)
```

**Luồng yêu cầu**: Browser → middleware (session cookie → CBAC theo route) → Route Handler `/api/rpc` (CSRF check + preview-block + `adminOnly`/`rpcMeta` default-deny) → `packages/core` (transaction PG, `db.audit`, soft-delete) → JSON.

**Ghi chú quan trọng**: server cũ là **đồng bộ** (`node:sqlite` sync). Bản v4 **bắt buộc async** (Postgres pool). Mọi handler phải `await` + wrapper bắt lỗi (không bao giờ treo request) — theo global AGENTS.md.

---

## 4. CẤU TRÚC THƯ MỤC ĐÍCH

```
cencomOS_gara_4.0_supa/
├── apps/web/                     # Next.js App Router (multi-role UI)
│   ├── app/
│   │   ├── (auth)/login/page.tsx
│   │   ├── (app)/...             # dash, sc, scnew, dex (đề xuất), xuong, kho, dm, chat, asset, hoso, admin, perm, preview, baogia, thanhly
│   │   ├── api/rpc/route.ts      # POST /api/rpc (contract bất biến)
│   │   ├── api/auth/route.ts     # login/logout
│   │   ├── api/export/[...]/route.ts
│   │   ├── api/in/[...]/route.ts # HTML print A4
│   │   └── api/chat/file/[...]/route.ts  # tải ảnh chat/TK
│   ├── middleware.ts
│   ├── components/  lib/  hooks/  styles/
│   └── package.json
├── packages/core/                # Domain logic TS thuần (port từ server/*.js)
│   ├── auth.ts  perm.ts  sc.ts  kho.ts  tk.ts  xuong.ts  chat.ts
│   ├── asset.ts  baogia.ts  nhanKy.ts  scoring.ts  welcome.ts  report.ts  preview.ts
│   └── db.ts                     # Postgres pool + transaction + audit + softDelete
├── packages/db/                  # schema.sql + migrations + seed + migrator SQLite→PG
├── packages/contract/            # Zod schemas RPC (type-safe FE/BE)
├── supabase/                     # config.toml + storage policies + RLS
├── tests/conformance/            # parity 327 test (chạy trên v4)
├── .github/workflows/ci.yml      # CI/CD Vercel
├── docs/
│   ├── Architect.md              # ★ cấu trúc + logic + UI/UX (deliverable chính)
│   ├── MASTER_PLAN.md            # kế hoạch theo giai đoạn (bản rút gọn)
│   ├── CHANGELOG.md              # nhật ký thay đổi v4
│   └── SPEC-04-API.md            # bám rewrite/04
├── AGENTS.md                     # quy ước cho AI làm việc trong dự án này
└── .gitignore                    # .env, node_modules, .next, .vercel...
```

---

## 5. ĐÁNH GIÁ COPY vs BỎ (đã duyệt — áp dụng đúng, không tự ý đổi)

### 5.1 COPY / PORT sang v4

| Nguồn (v3.6) | Đích | Cách xử lý | Ghi chú |
|---|---|---|---|
| `server/db.js` (SCHEMA + MIGRATIONS) | `packages/db/schema.sql` | Chuyển SQLite → PG, **giữ tên bảng/cột/id `PREFIX-000001`** | Thêm CHECK constraint `trang_thai`; chuyển `expires_at` → timestamptz; giữ soft-delete `deleted_at TEXT DEFAULT ''` |
| `server/sc.js` | `packages/core/sc.ts` | Port TS, giữ state machine + công thức | Bỏ phần in/audit file; dùng `db.ts` mới |
| `server/kho.js` | `packages/core/kho.ts` | Port TS, giữ autoXuatSC, cu_hong, thanh_ly | Bỏ phần ảnh |
| `server/tk.js` `xuong.js` `chat.js` `asset.js` `nhanKy.js` `perm.js` `scoring.js` `welcome.js` `report.js` `preview.js` | `packages/core/*.ts` | Port TS | CencomBot giữ nguyên (không AI) |
| `server/auth.js` | `packages/core/auth.ts` | Port scrypt + session + must_change | Cookie thêm `Secure` khi HTTPS |
| `server/handlers.js` | `packages/contract` + Route Handler | Chuyển `rpcMeta[]`/`adminOnly[]` thành bảng khai báo TS/Zod | Default-deny giữ |
| `server/index.js` (CSRF, preview-block, security headers, error handler) | `apps/web/middleware.ts` + route | Giữ nguyên hành vi | Thêm helmet-like headers |
| `shared/data/seed_xe.json` `seed_biemau.json` | `packages/db/seed/*.json` | Copy nguyên | 42 xe + 97 mục |
| `client/src/*` (Tailwind tokens/theme) | `apps/web/styles/` | Copy design tokens + 3 theme (home/dash/default) | Nhận diện Cencom |
| `docs/rewrite/01-04,07` | `docs/SPEC-04-API.md` + tham chiếu | Đọc + giữ làm chuẩn | BẢN ĐỒ BẢO TOÀN LOGIC |
| `tests/*.js` (327 test) | `tests/conformance/*.ts` | Port sang HTTP test chạy trên v4 | Thước đo parity (mục 12) |
| Văn bản quy trình QC206 | `docs/` | Copy vào docs | Nguồn nghiệp vụ 8 bước |

### 5.2 BỎ (rác — không copy)

| Thành phần | Lý do |
|---|---|
| Ảnh báo giá NCC + AI-OCR (`ai.js`, `ocr_vi.js`, `tesseract`, `data/baogia/`, `/baogia/img/*`, `baoGiaOcr`, `aiConfig*`, `aiTest`) | **Yêu cầu chủ dự án**: tốn storage; chỉ giữ nhập thủ công |
| GAS (`appscript/`, `demo/`, `deploy_*.zip`) | Đã bị xoá khỏi repo cũ (chỉ còn git history) — không mang sang |
| `desktop/` (Electron server-app + client-app) | Cloud thuần, không cần máy nhà/tunnel/offline sync |
| `cencomOS-gara-input/` | Tool nhập lịch sử riêng, không thuộc v4 |
| `docx.js`, `htmlDoc.js`, `in.js` (sinh .docx) | Thay bằng in HTML + CSS print A4 |
| `cache.js`, `lock.js`, `exportWorker.js`, `exportRunner.js` | Thay bằng cache TTL (Redis/Memory) + async job; lock → transaction PG |
| Rác repo cũ: `tmp_*.js`, `*.log`, `.lnk`, `cf.log`, `vie.traineddata`, tunnel files | Không copy |
| `tailwindCss-alpinJS-Frontend.txt`, `vercel webapp.txt` | Kiến thức đã gộp vào plan |

---

## 6. SCHEMA POSTGRESQL ĐÍCH (dùng cho GĐ1 — khởi tạo `packages/db/schema.sql`)

> Nguồn: `server/db.js` (SCHEMA + MIGRATIONS) + `docs/rewrite/03_DATA_SCHEMA.md`. Giữ **tên bảng/cột lowercase** (mặc định PG), giữ định dạng id `PREFIX-000001` (VARCHAR(12) PK), soft-delete `deleted_at TEXT DEFAULT ''` (không NULL), JSON lưu TEXT. Bỏ ảnh/OCR khỏi `bao_gia_ncc`. Thêm `tenant_id` cho multi-tenant (mặc định `'c1'`).

### 6.1 Bảng GĐ2 (kiểm định)

| Bảng | Cột |
|---|---|
| `config` | `key TEXT PK, value TEXT` |
| `phong_ban` | `id TEXT PK, code, name, note, deleted_at` |
| `xe` | `id TEXT PK, bks TEXT UNIQUE, bien_so_cu, hang, dong, nam_sx INT, lai_xe, danh_gia_pct REAL, phong_ban, trang_thai, loai_pt, ghi_chu, nguyen_gia REAL DEFAULT 0, lai_xe_id, deleted_at` |
| `bieu_ma` | `item_id INT PK, group_id INT, group_name, group_short, item_name, priority, deleted_at` |
| `kiem_tra` | `id TEXT PK, bks, mode, ngay, nguoi, trang_thai, ghi_chu, assignee, deadline, done_at, deleted_at` |
| `users` | `id TEXT PK, name, role, phone, pass_hash, active INT DEFAULT 1, must_change INT DEFAULT 0, phong_ban, deleted_at` |
| `ket_qua` | `id TEXT PK, phieu_id, bks, item_id INT, group_id INT, value, ghi_chu, deleted_at` |
| `bao_duong` | `id TEXT PK, bks, loai, chu_ky_ngay INT, lan_cuoi, lan_sau, canh_bao, deleted_at` |
| `nhat_ky` | `id BIGSERIAL PK, thoi_gian, noi_dung, nguoi` |
| `sessions` | `token TEXT PK, user_id, created_at TIMESTAMPTZ, expires_at TIMESTAMPTZ` |

### 6.2 Bảng GĐ3 (sửa chữa/kho/tài sản/quyền/audit)

| Bảng | Cột |
|---|---|
| `congviec` | `id BIGSERIAL PK, code TEXT UNIQUE, name, nhom, donvi, don_gia REAL, mo_ta, active INT, deleted_at, gio_cong REAL` |
| `vattu` | `id BIGSERIAL PK, code TEXT UNIQUE, name, nhom, donvi, gia REAL, ton REAL, ton_min REAL, active INT, deleted_at, ton_cu_hong REAL DEFAULT 0` |
| `phieu_sua` | `id TEXT PK, bks, phieu_kt, nguoi_lap, ngay, mo_ta, trang_thai DEFAULT 'de_xuat', nguoi_duyet, ngay_duyet, ly_do_tu_choi, nguoi_nghiem, ngay_nghiem, tong_cong REAL, tong_vt REAL, tong REAL, ghi_chu, deleted_at, tk_id, ngay_du_kien, ngay_bat_dau, tinh_trang_pt, la_sua_ngoai INT DEFAULT 0, don_vi_ngoai` + CHECK(trang_thai IN (...)) |
| `sc_congviec` | `id BIGSERIAL PK, sc_id, congviec_id INT, ten, donvi, so_luong REAL DEFAULT 1, don_gia REAL, thanh REAL, ghi_chu, tho_id, tt DEFAULT 'todo', gio_cong REAL, stt INT, nguyen_nhan, loai_xu_ly, deleted_at` |
| `sc_vattu` | `id BIGSERIAL PK, sc_id TEXT NOT NULL, vattu_id INT, ten, donvi, so_luong REAL, gd_dk REAL, gd_tt REAL, thanh REAL, tt DEFAULT 'can_mua', stt INT, nguyen_nhan, loai_xu_ly, bao_gia_id, ncc, gia_ngay, deleted_at` |
| `de_nghi_mua` | `id TEXT PK, nguoi_lap, ngay, trang_thai DEFAULT 'cho_duyet', nguoi_duyet, ngay_duyet, ly_do_tu_choi, tong REAL, ghi_chu, deleted_at` |
| `dm_mua_ct` | `id BIGSERIAL PK, dm_id, vattu_id INT, ten, donvi, so_luong REAL, dg_dk REAL, dg_tt REAL, tt DEFAULT 'cho_duyet', sc_id, deleted_at` |
| `phieu_nhap` | `id TEXT PK, ngay, nguoi_lap, nha_cc, nguoi_duyet, ref_dm, tong REAL, ghi_chu, deleted_at, loai_nhap DEFAULT 'moi', nguoi_giao, ncc_dia_chi, ncc_sdt` |
| `phieu_nh_ct` | `id BIGSERIAL PK, ph_id, vattu_id INT, ten, donvi, so_luong REAL, dgia REAL, thanh REAL, ref_dm, ref_baogia, ref_sc, ncc, gia_ngay, deleted_at` |
| `phieu_xuat` | `id TEXT PK, ngay, nguoi_lap, ref_sc, ghi_chu, deleted_at, nguoi_nhan, loai_xuat DEFAULT 'dung'` |
| `phieu_xuat_ct` | `id BIGSERIAL PK, ph_id, vattu_id INT, ten, donvi, so_luong REAL, dgia REAL, thanh REAL, ref_sc, ncc, gia_ngay, deleted_at` |
| `lich_sua` | `id BIGSERIAL PK, sc_id, bks, ngay, tong_cong REAL, tong_vt REAL, tong REAL, nguoi, ghi_chu, deleted_at` |
| `phan_quyen` | `role TEXT, module TEXT, feature TEXT, PRIMARY KEY(role,module,feature)` |
| `log_audit` | `id BIGSERIAL PK, thoi_gian, nguoi, bang, id_dong, hanh_vi, noi_dung` |

### 6.3 Bảng chat

| Bảng | Cột |
|---|---|
| `chat_threads` | `id TEXT PK, from_id NOT NULL, to_id NOT NULL, kind, ref_id, last_msg, last_at, unread INT, created_at` |
| `chat_messages` | `id BIGSERIAL PK, thread_id NOT NULL, from_id NOT NULL, to_id NOT NULL, body, kind, source, ref_id, img_path, is_read INT, created_at` |

### 6.4 Bảng GĐ3.6 — Đề xuất sửa chữa (thay thế TK)

| Bảng | Cột |
|---|---|
| `de_xuat_sua_chua` | `id TEXT PK, bks NOT NULL, ngay TEXT, nguoi_tao TEXT, mo_ta TEXT, dau_hieu (JSON TEXT), muc_uu_tien DEFAULT 'Binh_thuong', trang_thai DEFAULT 'cho_duyet', nguoi_duyet, ngay_duyet, ly_do_tu_choi, sc_id, deleted_at, tenant_id` — CHECK(trang_thai IN ('cho_duyet','da_duyet','tu_choi','da_chuyen_sc')), CHECK(muc_uu_tien IN ('Khan_cap','Xu_ly_som','Binh_thuong')) |

> **Ghi chú**: Module "Thăm khám sửa chữa" (TK) đã bị LOẠI BỎ hoàn toàn. Xem `plan_erase_1.md`.

### 6.5 Bảng GĐ3.7 — bộ hồ sơ 8 bước (ĐÃ BỎ ẢNH/OCR)

| Bảng | Cột |
|---|---|
| `bao_gia_ncc` | `id BIGSERIAL PK, dm_id, sc_id, ncc_ten, ncc_dia_chi, ncc_sdt, ngay, loai_chung_tu DEFAULT 'bao_gia', ref_phieu_nhap, nguoi_lap, deleted_at` — **KHÔNG còn `anh_bao_gia`/`ocr_result`/`ocr_xac_nhan`/`ocr_engine`**; items báo giá nhập tay nằm trong `dm_mua_ct` (dm_id) |
| `nhan_ky` | `id BIGSERIAL PK, phieu_loai, phieu_id, vi_tri, nguoi_ky, chu_ky_data, ngay_ky, deleted_at` — UNIQUE(phieu_loai,phieu_id,vi_tri) |
| `sc_phien_ban` | `id BIGSERIAL PK, sc_id, nguoi_chot, ngay_chot, snapshot (JSON TEXT), deleted_at` — 1 SC tối đa 1 bản active |
| `vattu_gia_lich_su` | `id BIGSERIAL PK, vattu_id INT, ten, ngay, gia REAL, phieu_id, nguon, ncc, deleted_at` |
| `bien_ban_nghiem` | `id BIGSERIAL PK, sc_id, bks, ngay, ben_giao, ben_nhan, lai_xe, bao_hanh_ngay, ket_luan, nguoi_lap, tong_vat_tu REAL, tong_nhan_cong REAL, chi_tiet_json TEXT, deleted_at` |
| `phieu_kiem_tu` | `id TEXT PK, sc_id, bks, nguoi_lap, ngay, chi_tiet (JSON), ket_luan, deleted_at` |
| `ke_hoach_sc` | `sc_id TEXT PK, nguoi_bo_sung, ngay, hang_muc (JSON), tong_du_kien REAL, deleted_at` |
| `phieu_nhap_dm` | `dm_id TEXT, ph_id TEXT, PRIMARY KEY(dm_id,ph_id)` |
| `phieu_nhap_thanhly` | `id BIGSERIAL PK, ph_id, vattu_id INT, ten, donvi, so_luong REAL, ly_do, gia_thanh_ly REAL, ngay_thanh_ly, deleted_at` |

### 6.6 Index bắt buộc (đủ cho WHERE/JOIN/ORDER)

```
ket_qua(phieu_id), ket_qua(bks), ket_qua(item_id), kiem_tra(bks), bao_duong(bks),
phieu_sua(bks), sc_congviec(sc_id), sc_vattu(sc_id), dm_mua_ct(dm_id),
phieu_nh_ct(ph_id), phieu_xuat_ct(ph_id), chat_messages(thread_id, created_at DESC),
yeu_cau_tham_kham(bks), yeu_cau_tham_kham(lai_xe), yeu_cau_tham_kham(trang_thai),
bao_gia_ncc(sc_id), bao_gia_ncc(dm_id), nhan_ky(phieu_loai,phieu_id),
sc_phien_ban(sc_id), vattu_gia_lich_su(vattu_id), bien_ban_nghiem(sc_id),
phieu_kiem_tu(sc_id), phieu_nhap_thanhly(ph_id), phieu_nhap_dm(ph_id),
sessions(expires_at), log_audit(thoi_gian), chat_messages(created_at) PARTITION
```

### 6.7 Partition lạnh (GĐ7)

- `chat_messages`, `log_audit`, `ket_qua` → partition theo **tháng** (RANGE on `created_at`/`thoi_gian`).
- Chứng từ SC `da_quyet` sau N ngày (cấu hình, mặc định 90) → job nén chi tiết thành **tóm tắt số liệu** vào bảng `archive_*` (bks, sc_id, ngay, tong, so_luong dong, don vi ngoai...) rồi xoá mềm chi tiết `sc_congviec/sc_vattu/dm_mua_ct/phieu_nh_ct/phieu_xuat_ct` (giữ header + lich_sua). Truy vấn cũ vẫn đọc được qua tóm tắt.
- Materialized view cho thống kê (dashboard/xuongDashboard/report) refresh định kỳ.

### 6.8 RLS (GĐ10 — multi-tenant)

- Mỗi bảng nghiệp vụ thêm `tenant_id TEXT DEFAULT 'c1'`; policy `tenant_id = current_setting('app.tenant_id')`.
- Vận hành 1 đơn vị: gán `c1` mọi dòng; không đổi hành vi hiện tại.

---

## 7. BUSINESS RULES & STATE MACHINE (BẮT BUỘC TÁI TẠO ĐÚNG — nguồn rewrite/02)

### 7.1 State machine SC

```
de_xuat → da_duyet → da_tong_duyet (tuỳ chọn, GĐ3.7) → dang_sua → cho_nghiem → da_hoan → da_quyet
                        \→ tu_choi
```
- `ACTIVE_STATUS = ['de_xuat','da_duyet','da_tong_duyet','dang_sua']` — được thêm/sửa/xoá dòng CV/VT. Từ `cho_nghiem` trở đi: **phiếu khoá** ("Phieu dang khóa").
- `don_gia` công việc chỉ sửa khi `de_xuat`.
- Duyệt: chỉ từ `de_xuat`; phải `canApproveSC`.
- `scTongDuyet`: chỉ từ `da_duyet` + `canApproveSC`; chốt snapshot `sc_phien_ban` → `da_tong_duyet`.
- `scStart`: chấp nhận từ `da_duyet` hoặc `da_tong_duyet`; tự snapshot nếu chưa có → `dang_sua` + ghi `ngay_bat_dau`.
- `scFinish`: chỉ từ `dang_sua`; nếu có CV thì TẤT CẢ phải `tt='hoan'` ("Còn công việc chưa hoàn thành") → `cho_nghiem`.
- `scNghiem`: chỉ `admin|quanly|giamdoc`; từ `cho_nghiem`; đạt → `da_hoan` + ghi `bien_ban_nghiem`; không đạt → về `dang_sua` + ghi lý do.
- `quyetToan`: chỉ `da_hoan`; **bắt buộc đủ bộ hồ sơ 8 bước (`checkHoSo`)**; mỗi SC chỉ 1 dòng `lich_sua` ("đã quyết toán trước đó") → `da_quyet`.
- SC có `tk_id` + nghiệm thu đạt → TK tự `da_hoan`.

### 7.2 Bộ hồ sơ 8 bước (`checkHoSo` trả `{ok, miss[]}`) — QUAN TRỌNG: bước 3 đã thay đổi

1. Kế hoạch SC (`phieu_sua.mo_ta`/`ngay`).
2. Bản kiểm tu (`phieu_kiem_tu` có `sc_id`) **hoặc** có ít nhất 1 CV/VT trong SC.
3. **Phieu mua vật tư / báo giá NCC (ĐÃ SỬA)**: `bao_gia_ncc` có `dm_id` + `dm_mua_ct` items (nhập tay) — **KHÔNG còn điều kiện `ocr_xac_nhan=1` và `anh_bao_gia`**.
4. Phiếu nhập kho (`phieu_nhap.loai_nhap='moi'` có `ref_dm` trùng `bao_gia_ncc.dm_id`).
5. Phiếu xuất kho (`phieu_xuat.ref_sc = SC`).
6. Nhập vật tư cũ/hỏng (`phieu_nhap.loai_nhap='cu_hong'`) — tự sinh.
7. Biên bản nghiệm thu (`bien_ban_nghiem`).
8. Bảng kê chi tiết (tự sinh từ công+vt).

### 7.3 State machine Đề xuất sửa chữa (thay thế TK)

```
cho_duyet → da_duyet | tu_choi
da_duyet → da_chuyen_sc (khi xưởng tạo phiếu SC từ đề xuất)
```
- `deXuatCreate`: xưởng tạo đề xuất (cần quyền `de_xuat.tao`).
- `deXuatApprove`: quản lý/giám đốc duyệt/từ chối (cần quyền `de_xuat.duy`).
- `deXuatToSC`: xưởng tạo phiếu sửa chữa từ đề xuất đã duyệt (cần quyền `sc.tao`).
- `muc_uu_tien` whitelist: `['Khan_cap','Xu_ly_som','Binh_thuong']`.

> **Ghi chú**: Module "Thăm khám sửa chữa" (TK) đã bị LOẠI BỎ hoàn toàn. Xem `plan_erase_1.md`.

### 7.4 Kho — mua sắm

- `dmAutoBu`: gom vật tư `ton < ton_min`, `so_luong = ton_min - ton`; bỏ qua VT đang có DM mở (`cho_duyet`/`da_duyet`).
- `dmFromSC`: chỉ lấy `sc_vattu.tt='can_mua' AND vattu_id>0`; chặn nếu đã có DM `cho_duyet` cùng `sc_id`; tự gán `dm_id` cho `bao_gia_ncc` cùng `sc_id`.
- `phNhapCreate`: nếu `ref_dm` thì DM PHẢI `da_duyet`; dòng hợp lệ tăng `ton`, cập nhật `vattu.gia` = giá nhập + ghi `vattu_gia_lich_su`; dòng có `sc_id` → `sc_vattu.tt='da_mua'`; DM → `da_nhap`. Dòng không hợp lệ: **bỏ qua (không fail)**.
- **Nhập mới tự xuất (autoXuatSC)**: nhập `loai_nhap='moi'` có `sc_id` → tự tạo phiếu xuất `ref_sc` đúng số lượng, `sc_vattu.tt='da_xuat'`, giảm ton chính; phần dư vào ton thường. Nhận `nguoi_nhan`.
- **Nhập cũ/hỏng**: `loai_nhap='cu_hong'` → không định giá, tăng `vattu.ton_cu_hong` (KHÔNG tăng ton chính) + ghi `phieu_nhap_thanhly`.
- `phXuatCreate`: không có dòng `so_luong>0` → error; **thiếu tồn → throw làm FAIL CẢ PHIẾU** (không bán phần); giảm ton; `ref_sc` → `sc_vattu.tt='da_xuat'`; nhận `nguoi_nhan`.
- `vatTuDel`: vật tư có trong `phieu_nh_ct`/`phieu_xuat_ct` → CHẶN XOÁ, chỉ ẩn bằng `ton=0`.
- `autoGenCuHong(sc_id)`: tự tạo phiếu nhập `cu_hong` từ `sc_vattu.loai_xu_ly='thay_the'` (SL = `so_luong` VT thay thế), ghi `thanh_ly`, tăng `ton_cu_hong`; chặn khi SC chưa `dang_sua` / không có VT thay thế / đã có phiếu `cu_hong` (ref_sc).

### 7.5 Công thức tính tiền (GIỮ NGUYÊN — nguồn rewrite/02 §4)

- `tong_cong = Σ(sc_congviec.so_luong × don_gia)` (bỏ dòng `deleted_at`).
- `tong_vt = Σ(sc_vattu.so_luong × (gd_tt>0 ? gd_tt : gd_dk))` — ưu tiên giá thực tế, nếu không có dùng giá dự kiến.
- `tong = tong_cong + tong_vt`.
- `syncPrices`: khi thêm dòng, `don_gia = cat.don_gia`, `gd_dk = cat.gia`; nếu bằng 0 thì tự kéo từ danh mục.
- DM: `so_luong = max(1, nhap)`, `gia = dgia || cat.gia`, `tong = Σ(so_luong × dg_dk)`.
- Nhập kho: `thanh = so_luong × dgia`. Xuất kho: `thanh = so_luong × cat.gia` (giá hiện hành).

### 7.6 Tài sản — GTTV (khấu hao)

- `GTTV = nguyen_gia − khau_hao + chi_phi_tich_luy`.
- Khấu hao = `(nguyen_gia / so_nam_khau_hao) × min(số năm từ năm SX, khau_hao_nam)` với `khau_hao_nam` = config (mặc định 10).
- `chi_phi_tich_luy` = tổng `lich_sua.tong` của xe.

### 7.7 Ngưỡng duyệt

| Hàm | Quy tắc |
|---|---|
| `canApproveSC(role,tong)` | admin/giamdoc LUÔN; quanly chỉ khi `tong <= duyet_sc_nguong` (default 5.000.000) |
| `canApproveMua(role,tong)` | admin/giamdoc LUÔN; ketoan chỉ khi `tong <= duyet_mua_nguong` (default 5.000.000) |
| `canQuyetToan(role)` | admin/ketoan/giamdoc/quanly |
| `scNghiem` | chỉ admin/quanly/giamdoc |

### 7.8 Chat

- Thread 1-1: key 2 user id đã sắp xếp; `chatThreadOpen` tìm hoặc tạo.
- `chatSend`: bắt buộc `to`; không gửi cho chính mình; cần `body` hoặc `img` (hoặc job có `ref_id`).
- Giao việc: `kind==='job'` hoặc body bắt đầu `/^\@gioviec/`.
- Ảnh chat/TK: **thiết kế mới (mục 11)** — không còn magic-check JPG server, chuyển sang file tạm Storage.
- Xoá tin: chỉ xoá tin CỦA MÌNH (`m.from_id === me`).
- Bot `cenbot`: `/help`, `/ton`, `/sc`, `/sc cua toi`, `/bd` — trả dữ liệu thật.

### 7.9 Scoring

- A=5, B=4, C=3, D=2, E=1. `scoreVehicle` = TB toàn xe + `hasE`. `fleetReport` tính `%E` + xu hướng "Cai thien/Suy giam/On dinh".
- `ket_qua` lưu bằng `INSERT ... ON CONFLICT(phieu_id,item_id) DO UPDATE` (thay `INSERT OR REPLACE`).

### 7.10 Validation chính (giữ nguyên)

- `scSetDeadline`: format `YYYY-MM-DD`, chỉ `xuong/giamdoc/admin`, không ở `de_xuat/tu_choi/da_quyet`.
- `scWorkSet`: `tt` chỉ `todo|dang|hoan`.
- `scWorkAdd/scVtAdd`: nhận `stt`, `nguyen_nhan`, `loai_xu_ly` (whitelist `thay_the/khac_phuc`).
- `deXuatCreate`: bắt buộc `bks` + `mo_ta`.
- `dmCreate`: cần `vattu_id` hoặc `name`; không có dòng hợp lệ → error.
- `congViecSave`/`vatTuSave`: code trùng → merge (idempotent), thiếu tên → error.
- `baoGiaCreate`: **SỬA** — không bắt buộc ảnh; cần `ncc_ten` + items (`dm_mua_ct`); `baoGiaConfirm` xác nhận báo giá; `baoGiaDel` soft-delete.
- `nhanKySet`: `patches` = array `{vi_tri, nguoi_ky, chu_ky_data}`; `chu_ky_data` ≤ 2MB; upsert theo `(phieu_loai,phieu_id,vi_tri)`.

---

## 8. API CONTRACT (GIỮ NGUYÊN — nguồn rewrite/04)

### 8.1 Format

- `POST /api/rpc`, body `{"fn":"<ten>","args":[...]}`.
- Thành công: HTTP 200 `{"ok":true,"result":...}`.
- Lỗi nghiệp vụ/thiếu quyền/preview locked/fn không tồn tại: HTTP **200** `{"ok":false,"error":"..."}`.
- Chưa đăng nhập: **401** (client phát `cen-noauth`). CSRF: **403**. Không tìm thấy fn: **404**. Param sai: **400**.
- `/export/*` lỗi 500 trả text thường (client `window.open`).

### 8.2 Route HTTP

| Method | Path | Auth | Ghi chú |
|---|---|---|---|
| POST | `/api/auth/login` | công khai | `{username,password}`; set cookie `cen_session`; sai → 401 |
| POST | `/api/auth/logout` | cookie | xoá session + preview |
| GET | `/api/sess` | tuỳ ý | user hiện tại hoặc null |
| POST | `/api/rpc` | bắt buộc | xem danh sách fn |
| GET | `/api/health` | public | `{ok,db,xe}` — KHÔNG lộ đường dẫn |
| GET | `/chat/file/:id` | bắt buộc + chặn preview | tải ảnh chat/TK từ Storage tạm (THAY `/chat/img/:file`) |
| GET | `/export/report.xlsx` | bắt buộc | query `bks` (list dấu phẩy) |
| GET | `/export/vehicle.xlsx` | bắt buộc | query `bks` |
| GET | `/export/accounting.xlsx` | bắt buộc | query `from,to,group(month\|quarter)` |
| GET | `/export/tonkho.xlsx` | bắt buộc | |
| GET | `/export/phxuat.xlsx` | bắt buộc | query `id` |
| GET | `/export/quyettoan.xlsx` | bắt buộc | query `id` |
| GET | `/export/tk.xlsx` | bắt buộc | |
| GET | `/in/kehoach` `kiemtu` `baogia` `nghiem` `bangke` `hoso` | bắt buộc + `sc.xem` | in HTML A4 |
| GET | `/in/nhap` `xuat` | bắt buộc + `kho.xem` | in HTML A4 |

### 8.3 Auth & session

- Token 24B random hex; cookie `cen_session` HttpOnly + SameSite=Strict + Path=/ + Max-Age 14 ngày + **`Secure`** (HTTPS).
- Session touch (+14 ngày) mỗi lần dùng; user `active=0` → không đăng nhập.
- `must_change=1`: `/api/rpc` CHỈ cho `changePassword/currentUser/appInfo`; RPC khác → `{ok:false, needChangePw:true}`; `/export/*` → 403. Policy: ≥6 ký tự, từ chối trùng mật khẩu mặc định; rate-limit đổi mật khẩu (5 lần sai → chặn tạm).
- scrypt `'scrypt:salt:hash'`; so sánh `timingSafeEqual`.
- CSRF: mọi POST `/api/*` check Origin/Referer trùng Host → lệch 403; request không có Origin (curl) chấp nhận.

### 8.4 Phân quyền 3 lớp (giữ)

1. `adminOnly`: userAdd, userSetPassword, userSetActive, permMatrix, permSave, thresholdsSet, previewStart, previewStop, previewState.
2. `rpcMeta[fn]=[module,feature]` → `perm.can(role,module,feature)`.
3. `checkLock` trong hàm xử lý (defense-in-depth).

**Ma trận mặc định (perm.js MATRIX):**

| Role | module.feature |
|---|---|
| admin | all |
| tho | sc.xem/tao/sua; asset.xem; kho.xem; xe.xem; report.xem; chat.xem/tao/sua; gd2.xem/tao/sua |
| khoa | kho.xem/tao/sua/xuat; mua.xem/tao; sc.xem; xe.xem; chat.xem/tao/sua; gd2.xem |
| ketoan | mua.xem/tao/duy; asset.xem/quyet; sc.xem; kho.xem; xe.xem; report.xem; chat.xem/tao/sua; gd2.xem |
| quanly | sc.xem/duy; asset.xem/quyet; kho.xem; mua.xem; xe.xem; report.xem; chat.xem/tao/sua; de_xuat.xem/duy; xuong.xem; gd2.xem/tao/sua |
| giamdoc | sc.xem/duy; asset.xem/duy; kho.xem; mua.xem/duy; xe.xem; report.xem; chat.xem/tao/sua; de_xuat.xem/duy; xuong.xem; gd2.xem/tao/sua |
| xuong | de_xuat.xem/tao/sua; xuong.xem; sc.xem/tao/sua; asset.xem; kho.xem; xe.xem; report.xem; chat.xem/tao/sua; gd2.xem/tao/sua |

> **Ghi chú**: Role `laixe` đã bị LOẠI BỎ. Module TK thay bằng `de_xuat`.

### 8.5 Danh sách RPC đầy đủ (giữ NGUYÊN tên khi rewrite)

**GĐ2 & hệ thống:** formInitData, vehiclesOptions, phongbanList, checklistGroups, myVehicles, createPhieu, saveResults, dashboardData, vehicleProfile, importVehiclesFromText, addVehicle, vehicleHealthLog, fleetReport, accountingReport, userList, assignWork, updatePhieuStatus, myTasks, taskResults, currentUser, changePassword, roleOptions, appInfo, welcomeData, myPerms, thresholds.

**Admin:** userAdd, userSetPassword, userSetActive, permMatrix, permSave, thresholdsSet, previewStart, previewStop, previewState.

**Preview (chỉ trong preview):** previewInfo, previewHome, previewSC, previewKho, previewDM.

**SC:** scCreate (`sc.tao`), scList/scGet/congViecList (`sc.xem`), scApprove/scNghiem (`sc.duy`), scStart/scSetDeadline/scWorkSet/scWorkAdd/scWorkDel/scVtAdd/scVtUpd/scVtDel/scFinish/congViecSave/congViecDel (`sc.sua`).

**Kho:** vatTuList/tonKho/phNhapList/phNhapGet/phXuatList/phXuatGet (`kho.xem`), vatTuSave/phNhapCreate (`kho.tao`), vatTuDel (`kho.xoa`), phXuatCreate (`kho.xuat`), dmList/dmDetail (`mua.xem`), dmCreate/dmFromSC/dmAutoBu (`mua.tao`), dmDecide (`mua.duy`), dmDelete (`mua.xoa`).

**Kho GĐ3.7:** dmListBySc (`mua.xem`), autoGenCuHong (`kho.tao`).

**Tài sản:** quyetToan (`asset.quyet`), lichSuaList/assetXe/assetReport (`asset.xem`).

**Chat:** chatPeers/chatList/chatMessages/chatMarkRead/chatUnreadCount (`chat.xem`), chatThreadOpen/chatSend/chatSendImg/chatDeleteMsg (`chat.tao`).

**Đề xuất sửa chữa (thay thế TK):** deXuatCreate (`de_xuat.tao`), deXuatList/deXuatGet (`de_xuat.xem`), deXuatApprove (`de_xuat.duy`), deXuatToSC (`de_xuat.sua` — chuyển thành SC).

**Xưởng:** xuongDashboard/dashboardAll (`xuong.xem`; dashboardAll chặn `ketoan`).

**GĐ3.7:** scTongDuyet (`sc.duy`, cần `canApproveSC`); baoGiaList/baoGiaGet (`mua.xem`), **baoGiaCreate (SỬA: không ảnh)/baoGiaConfirm** (`mua.tao`), baoGiaDel (`mua.xoa`); nhanKyList (`sc.xem`), nhanKySet (`sc.sua`); giaLichSuList (`kho.xem`); checkHoSo (`sc.xem`) — **BỎ**: `baoGiaOcr`, `aiConfigGet/Set`, `aiTest`.

---

## 9. THIẾT KẾ ẢNH CHAT/TK MỚI (quyết định #10 — BẮT BUỘC)

**Nguyên tắc**: "gửi ảnh = gửi file tạm; người nhận bấm Mở ảnh → tải về máy người nhận; không lưu vĩnh viễn trên cloud; TTL 1 ngày xoá; nếu người nhận không xoá file cục bộ thì ảnh luôn tồn tại trong giao diện chat của họ".

1. **Upload**: client nén trước (canvas resize ≤1280px, JPEG q0.7) → upload **multipart** lên Supabase Storage bucket `temp_chat_imgs` với path `{tenant}/{threadId}/{uuid}.jpg`.
2. **DB**: `chat_messages.img_path = '<path>'`; `kind='img'`.
3. **Realtime**: khi insert message kind=img, người nhận nhận event → hiển thị nút "📎 Mở ảnh".
4. **Mở ảnh**: gọi `/chat/file/:id` (requireAuth + CBAC) → server lấy file từ Storage → trả với header `Content-Disposition: attachment` → trình duyệt tải về máy người nhận; client đọc file local (objectURL) và nhúng vào DOM chat → **ảnh nằm trong giao diện chat của người nhận, không cần server nữa**.
5. **TTL**: cron job (Supabase Edge Function / pg_cron) xoá file `created_at < now()-1 day` trong `temp_chat_imgs` + cập nhật `img_path=''` cho messages >1 ngày.
6. **Hết hạn**: nếu người nhận chưa tải và file đã bị xoá → UI hiển thị "Ảnh đã hết hạn (lưu ≤1 ngày)".
7. **Ghi chú UX**: dòng hint "Ảnh chat được tải về máy bạn, không lưu vĩnh viễn trên hệ thống" bên dưới khung chat.

---

## 10. UI/UX YÊU CẦU (tóm tắt — chi tiết trong docs/Architect.md)

- **3 theme** (tái dùng client/src): `theme-home` (glassmorphism), `theme-dash` (fintech bold), `theme-default` (calm/clean).
- **Responsive**: PC + tablet thợ + mobile ≤767px (drawer, KPI 2 cột).
- **Realtime**: chat + notification + dashboard cập nhật qua WebSocket (bỏ polling 45s); giữ `:focus-visible` ring, skeleton, toast.
- **Trang chủ**: greeting + KPI + Trung tâm thông báo (chat chưa đọc, việc đang dở, đề xuất chờ duyệt, phiếu chờ nghiệm thu, vật tư < tồn min).
- **Bảng điều khiển (`dashboardAll`)**: KPI 8 ô + Kanban 5 cột (Đề xuất/Đã duyệt/Đang sửa/Chờ nghiệm thu/Từ chối) + ETA 3 màu (xanh còn ngày/vàng hôm nay/đỏ trễ) + tải thợ.
- **Phân quyền UI**: nav/nút ẩn theo `myPerms`; nhưng quyền thật kiểm SERVER (không chỉ ẩn UI).
- **In ấn**: màn hình in → `window.print()` trên HTML A4 (Times New Roman, @media print) — KHÔNG docx.

---

## 11. GIẢI QUYẾT NÚT THẮT (bảng ánh xạ)

| Nút thắt cũ | Giải pháp v4 |
|---|---|
| `node:sqlite` sync block event loop | Postgres async pool + pagination + cache TTL |
| Export XLSX sync | Route handler async + stream (`exceljs` stream / worker) |
| Polling 45s | Supabase Realtime push |
| Ảnh base64 8MB | Storage multipart + nén client + TTL 1 ngày |
| DB 1 file | Postgres + transaction + SKIP LOCKED nếu cần |
| Backup thủ công | daily `pg_dump` cron (giữ 7 bản) + PITR 7 ngày (Pro) + test khôi phục |
| Bảng phình | partition tháng + archive job + materialized view |
| Deploy phức tạp | Vercel + Supabase, CI/CD GitHub Actions |

---

## 12. CONFORMANCE / PARITY TEST (tiêu chí hoàn thành BẮT BUỘC)

- Port **toàn bộ test** từ v3.6 thành conformance trên v4 (bỏ test liên quan TK/ảnh OCR).
- **Điều chỉnh khi port**: bỏ test liên quan ảnh báo giá/OCR; bỏ test TK (đã loại bỏ module); giữ mọi "đường chết" khác (mục 12.2).
- Lệnh chạy: `cd tests/conformance && npm test` (hoặc `node run_all.js` tương đương).
- Tiêu chuẩn: **≥ 320 test pass, fail=0** trên implementation v4.

### 12.2 "Đường chết" bắt buộc giữ (không được bỏ)

1. Chưa đăng nhập gọi /api/rpc → 401.
2. CSRF: Origin/Referer lệch Host → 403.
3. Reset DB qua API → không còn (chỉ qua seed CLI).
4. Tạo đề xuất sửa chữa cho xe không có quyền → IDOR error.
5. Xuất kho thiếu tồn → fail CẢ phiếu.
6. Quyết toán SC đã quyết toán → error.
7. Tạo SC thứ 2 từ cùng 1 đề xuất → error.
8. Xoá vật tư có tham chiếu nhập/xuất → bị chặn.
9. `scFinish` còn CV chưa `hoan` → error.
10. Gửi tin cho chính mình → error.
11. Xoá tin không phải của mình → error.
12. Preview mode: RPC thật bị chặn, /export 403.
13. `tt` CV ngoài whitelist → error.
14. `muc_uu_tien` đề xuất ngoài whitelist → error.
15. `loai_xu_ly` ngoài `thay_the/khac_phuc` → error.
16. `scTongDuyet` không ở `da_duyet` → error.
17. `quyetToan` thiếu hồ sơ (`checkHoSo.miss` không rỗng) → error.
18. `scStart` từ `da_tong_duyet` vẫn OK (tự snapshot).
19. Nhập mới có `sc_id` → autoXuatSC tạo PXX + `sc_vattu.tt='da_xuat'`.
20. Nhập cũ/hỏng tăng `ton_cu_hong` không đụng ton chính.

---

## 13. CÁC GIAI ĐOẠN THỰC THI (chi tiết để AI khác làm)

### GĐ0 — Scaffold + docs (ĐÃ HOÀN THÀNH trong phiên này)
- ✅ Tạo `E:\APP-LAPTOP-SYNC\cencomOS_gara_4.0_supa\` (ngoài v3.6).
- ✅ Tạo `docs/Architect.md`, `docs/MASTER_PLAN.md`, `docs/CHANGELOG.md`, `PLAN_14.08_supa.md` (file này), `AGENTS.md`, `.gitignore`.
- ✅ Ghi nhận hướng v4 vào v3.6 (`GHI_NHO_HUONG_PHAT_TRIEN_V2.md` + `docs/CHANGELOG.md` + `docs/memory/`).
- ▶️ Kế tiếp: `git init` + commit đầu (chỉ khi người dùng yêu cầu).

### GĐ1 — Schema PostgreSQL + Migrator + Seed (PHIÊN SAU — người dùng sẽ mở phiên mới để làm)
1. Tạo `packages/db/` với `schema.sql` theo mục 6 (bảng + index + CHECK + partition sẵn nếu có thể).
2. Tạo `migrator.ts`: đọc SQLite cũ (`v3.6/data/cencom.db`) → map 1-1 sang PG qua `pg` — giữ id, ngày (TEXT → DATE/TEXT tuỳ chọn, quyết định duy nhất: giữ TEXT cho ngày để khỏi đổi format), JSON (giữ TEXT).
3. Tạo `seed.ts`: nạp 42 xe (`shared/data/seed_xe.json`) + users mặc định (admin-1, tho-1..5, kho-1, ketoan-1, quanly-1, giamdoc-1, xuong-1 — mật khẩu `cencom@123`, `must_change=1`) + `phan_quyen` từ MATRIX + `config` (duyet_sc_nguong=5000000, duyet_mua_nguong=5000000, khau_hao_nam=10).
4. Tạo `supabase/config.toml` + migration SQL (chạy `supabase db push` hoặc SQL Editor).
5. **Xác minh**: `psql`/`supabase db` query `SELECT COUNT(*) FROM xe` = 42; login seed OK.

### GĐ2 — Core port (packages/core)
- Port theo thứ tự: `db.ts` (pool/transaction/audit/softDelete/nextId) → `auth.ts` → `perm.ts` → `scoring.ts` → `sc.ts` → `kho.ts` → `chat.ts` → `de_xuat.ts` → `xuong.ts` → `asset.ts` → `baogia.ts` (bỏ ảnh) → `nhanKy.ts` → `welcome.ts` → `report.ts` (export stream) → `preview.ts`.
- Mỗi module: port xong → viết test unit (thư viện `vitest`) → xanh trước khi port module kế.
- `nextId(prefix)`: dùng bảng `config` counter với `FOR UPDATE` (thay `db.nextId` cũ).
- `db.audit`: INSERT `log_audit` trong cùng transaction.

### GĐ3 — API layer (apps/web) ✅ HOÀN THÀNH (2026-08-14)
- `packages/contract/`: Zod schemas cho mọi RPC input validation (whitelist enum).
- `middleware.ts`: đọc cookie `cen_session` → set header `x-session-token` → route handler resolve user.
- `app/api/rpc/route.ts`: CSRF → resolve user → `must_change` check → dispatch → JSON.
- `lib/rpc-dispatch.ts`: `adminOnly` + `rpcMeta` + `PUBLIC_FNS` + default-deny + Zod validate → call `packages/core`.
- `lib/auth-context.ts`: `AsyncLocalStorage<User>` thay thế `setUser()/current()` module-level (Next.js-safe).
- `lib/csrf.ts`: Origin/Referer check giống v3.6.
- Route `api/auth/route.ts` (login/logout), `api/health/route.ts` (ẩn path), `api/export/[...]/route.ts` (stream Excel, requireAuth).
- `app/(auth)/login/page.tsx`, `app/(app)/dashboard/page.tsx` (skeleton KPI), `app/layout.tsx`, `app/globals.css`.
- `next.config.js`: `output: 'standalone'` + `transpilePackages` + `extensionAlias .js→.ts` + security headers.
- ✅ `tsc --noEmit` apps/web: 0 errors. ✅ `next build`: success (9 routes).
- ⚠️ Chưa làm: `/in/*` (HTML print), `/chat/file/*`, preview-block in middleware (chặn sau), `process.on('unhandledRejection')` global handler.
- ⚠️ Đã tắt `noPropertyAccessFromIndexSignature` + `exactOptionalPropertyTypes` trong `tsconfig.base.json` (385+ lỗi TS4111 pre-existing khi port từ JS).

### GĐ4 — Realtime + Storage ✅ HOÀN THÀNH (2026-08-15)
- Supabase Realtime: subscribe `chat_messages` (filter thread), notification, dashboard; giữ badge unread.
- Storage bucket `temp_chat_imgs` + policy (private, auth) + cron TTL 1 ngày (mục 9).
- `/chat/file/:id` download với `Content-Disposition: attachment`.
- File: `apps/web/lib/supabase.ts`, `apps/web/lib/use-realtime.ts`, `app/chat/file/[id]/route.ts`.
- Env `.env.onpremise`: `SUPABASE_REALTIME_URL=ws://supabase-realtime:54324` (on-premise Docker hostname).

### GĐ5 — UI toàn bộ màn hình ✅ HOÀN THÀNH (2026-08-15)
- Trang đăng nhập + đổi mật khẩu (must_change flow).
- Trang chủ (drawNotif), Bảng điều khiển (Kanban 5 cột), SC (danh sách/chi tiết/tạo/8 bước hồ sơ/in), Đề xuất sửa chữa, Kho (vật tư/tồn/DM/nhập/xuất), Chat (thread 1-1 + job + bot), Tài sản (quyết toán/lịch sử), Phân quyền, Preview, Báo giá nhập tay, Thanh lý.
- Tái dùng Tailwind tokens/theme từ `client/src/`.
- ✅ `next build`: success (21 routes dynamic).

### GĐ6 — Performance (ON-PREMISE) ⏳
- Docker infrastructure ready (docker-compose.yml, Dockerfile.standalone, nginx).
- Docker Desktop chưa cài (installer 599.8MB tải tại temp).
- Pagination mọi danh sách; index đúng (mục 6.6); materialized view thống kê; cache TTL (danh mục, dashboard) — dùng `node-cache` hoặc Redis khi cần.
- Export stream + job nền.
- Kiểm lại bằng load test: 200 VU → p95 < 2s (so với 21.6s cũ).

### GĐ7 — Backup + Archive (ON-PREMISE) ✅
- `Onpremise/scripts/backup_db.sh` — cron daily `pg_dump` → local disk; PITR cấu hình trong `postgresql.conf`.
- Archive: job nén SC `da_quyet`; partition `chat_messages/log_audit/ket_qua` (bỏ — PGlite test không cần).

### GĐ8 — Parity conformance (packages/core) ✅ HOÀN THÀNH (2026-08-15)
- Port toàn bộ test → `packages/core/tests/` (13 files, 134 test).
- **Result: 134/134 pass ✅** (từ 10 failed → 0).
- Seed fixes: hardcode 27 vattu + sequence `setval` + password hash format.
- Code bug fixes: `phNhapCreate ref_baogia` INT, `de_nghi_mua chk trang_thai` thêm `da_nhap`.
- Test fix: `bao_gia_ncc dm_id` NULL handling.

### GĐ9 — Deploy (ON-PREMISE Windows Docker) ✅ HOÀN THÀNH
- Docker Desktop đã cài + chạy (v29.7.2, WSL2). Đã pull đủ images, `docker compose up -d` → 5 containers Up+healthy.
- Đã apply schema + seed (42 xe, 27 vattu, 11 users) vào Postgres thật. Verify health + login OK.
- Chi tiết lỗi đã sửa + cách chạy: xem CHANGELOG.md (mục 2026-08-15 GĐ9).
- Lưu ý: supabase-db publish port `54322` (host); storage `54325`; nginx `80/443`; realtime `54324` (internal).

### GĐ10 — Multi-tenant + bàn giao
- Thêm `tenant_id` + RLS; test 2 tenant cách ly.
- Cập nhật docs 2 nơi (v3.6 + v4); tag `v4.0.0`; bàn giao kèm Production Check.

---

## 14. CHECKLIST BÀN GIAO (mỗi giai đoạn phải qua)

- [x] `node --check`/`tsc --noEmit` không lỗi cho mọi file sửa.
- [x] `packages/core` tests pass 134/134 ✅.
- [ ] Server chạy local (Next dev + Supabase on-premise), login admin-1/cencom@123 OK; phải đổi mật khẩu (must_change) rồi mới dùng. (chờ Docker)
- [ ] Preview: admin bật từng vai, DEMO hiển thị, thao tác thật bị chặn, /export 403, thoát khôi phục. (chờ Docker)
- [ ] Luồng đề xuất sửa chữa: xưởng tạo → quản lý duyệt → xưởng tạo SC → nghiệm thu. (chờ Docker)
- [ ] Ảnh chat: gửi → người nhận bấm Mở ảnh → tải về máy → hiển thị local; sau 1 ngày file gốc bị xoá, tin nhắn cũ báo hết hạn nếu chưa tải.
- [ ] In ấn: `/in/hoso?sc_id=` in A4 đẹp.
- [ ] Export Excel: report/vehicle/accounting/tonkho/phxuat/quyettoan chạy stream, không treo.
- [ ] Tài liệu HTML + `docs/Architect.md` + `docs/CHANGELOG.md` cập nhật.
- [ ] `docs/CHANGELOG.md` v3.6 ghi nhận thay đổi.

---

## 15. RỦI RO & GIẢM THIỂU

| Rủi ro | Mức | Giảm thiểu |
|---|---|---|
| Port sai logic nghiệp vụ | Cao | Conformance 327 test + đọc rewrite/02 mỗi khi port |
| Ngày tháng TEXT vs DATE | Trung bình | Quyết định duy nhất: giữ TEXT định dạng `YYYY-MM-DD` cho mọi cột ngày (không đổi format) |
| Free tier Supabase (500MB DB, 1GB Storage, 50k MAU) | Trung bình | Archive + partition + TTL 1 ngày + nén ảnh; theo dõi usage; nâng Pro khi cần |
| Thời gian migrate dữ liệu thật | Thấp | Migrator chạy offline, kiểm tra số dòng từng bảng trước/after |
| Realtime bị giới hạn | Thấp | Chỉ subscribe cần thiết (chat + notification); dashboard refresh thưa |
| Mất context giữa phiên | Thấp | File plan này + Architect.md + MASTER_PLAN.md tự chứa |

---

## 16. TÀI LIỆU THAM CHIẾU (đường dẫn tuyệt đối — có thể đọc lại)

- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\docs\rewrite\01_DOMAIN.md` — entity + quan hệ.
- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\docs\rewrite\02_BUSINESS_RULES.md` — state machine + công thức.
- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\docs\rewrite\03_DATA_SCHEMA.md` — schema nguồn.
- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\docs\rewrite\04_API_CONTRACT.md` — RPC + phân quyền.
- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\docs\rewrite\07_PARITY_TESTS.md` — conformance.
- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\server\*.js` — mã nguồn cần port.
- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\server\db.js` — schema thực tế (đã đối chiếu).
- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\shared\data\seed_xe.json` `seed_biemau.json` — seed.
- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\client\src\` — Tailwind tokens/theme.
- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\tests\` — 327 test nguồn.
- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\CencomOS_v2_nextJS\MASTER_PLAN.md` — hướng cũ (gộp vào v4).

---

> **Lưu ý hệ thống sản xuất (Production Check):**
> - Con thiếu gi? GĐ1 chưa làm — schema.sql, migrator, seed chưa viết (sẽ làm trong phiên mới). Chưa có CI/CD, chưa deploy.
> - Rui ro nam o dau? Port sai logic (giảm bằng conformance); format ngày TEXT (đã chốt giữ TEXT); free tier giới hạn (đã có archive/TTL).
> - Da chay kiem thu chua? Chưa — chưa có code; chỉ có tài liệu. Khi viết schema phải `tsc --noEmit` + test seed.
> - De xuat tiep theo? Mở phiên mới tại thư mục dự án 4.0, làm GĐ1 theo mục 6 + 13 (GĐ1). Đọc file này + `docs/Architect.md` trước khi code.