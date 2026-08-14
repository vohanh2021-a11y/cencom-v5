# ARCHITECT — Cấu trúc phần mềm, Logic tính toán & Điều kiện UI/UX

> Dự án: **cencomOS_gara_4.0_supa** · Ngày: 2026-08-14 · Trạng thái: GĐ0/GĐ1 (schema sắp khởi tạo)
> Tài liệu này mô tả **toàn bộ** phần mềm v4: kiến trúc, module, luồng dữ liệu, logic tính toán, state machine, phân quyền, và điều kiện UI/UX. AI làm việc trong dự án **phải đọc tài liệu này** trước khi code. Bản đồ nghiệp vụ gốc: `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\docs\rewrite\01-04`.

---

## 1. TẦNG KIẾN TRÚC (3 tầng)

| Tầng | Thư mục | Vai trò |
|---|---|---|
| 1. Giao diện | `apps/web/` — Next.js App Router + TS + Tailwind | UI multi-role (PC/tablet/ĐT), gọi RPC, realtime |
| 2. Xử lý | `apps/web/api/` (Route Handlers) + `packages/core/` (logic thuần TS) | HTTP entry, auth/CBAC/CSRF, nghiệp vụ |
| 3. Lưu trữ | Supabase: PostgreSQL + Realtime + Storage | Data, push, file tạm |

**Luồng yêu cầu**: Browser → `middleware.ts` (session cookie + CBAC sơ bộ + must_change) → Route Handler `POST /api/rpc` (CSRF + preview-block + adminOnly/rpcMeta default-deny) → `packages/core` (transaction PG, audit, soft-delete) → JSON `{ok, result|error}`.

---

## 2. CẤU TRÚC THƯ MỤC & TRÁCH NHIỆM TỪNG MODULE

```
cencomOS_gara_4.0_supa/
├── apps/web/                    # Next.js App Router
│   ├── app/(auth)/login/        # Đăng nhập + đổi mật khẩu (must_change)
│   ├── app/(app)/               # Trang nghiệp vụ (xem mục 8)
│   ├── api/rpc/route.ts         # POST /api/rpc — router RPC duy nhất
│   ├── api/auth/route.ts        # login/logout
│   ├── api/export/[...]/route.ts  # Xuất Excel (stream)
│   ├── api/in/[...]/route.ts    # In HTML A4
│   └── api/chat/file/[...]/route.ts  # Tải ảnh chat/TK từ Storage tạm
├── packages/core/               # Domain logic thuần TS (KHÔNG phụ thuộc Next/Supabase)
│   ├── db.ts                    # Postgres pool, transaction, audit, softDelete, nextId
│   ├── auth.ts                  # scrypt, session, login/logout, must_change
│   ├── perm.ts                  # CBAC: can(role,module,feature), MATRIX, ngưỡng duyệt
│   ├── sc.ts                    # Phiếu sửa chữa + state machine + 8 bước hồ sơ
│   ├── kho.ts                   # Vật tư, tồn kho, DM, nhập/xuất, cu_hong, thanh_lý
│   ├── tk.ts                    # Yêu cầu thăm khám (lái xe → xưởng → thợ)
│   ├── xuong.ts                 # Dashboard xưởng, dashboardAll (Kanban 4 cột)
│   ├── chat.ts                  # Thread 1-1, giao việc job, CencomBot, file ảnh tạm
│   ├── asset.ts                 # Quyết toán, lịch sử sửa chữa, khấu hao GTTV
│   ├── baogia.ts                # Báo giá NCC (nhập tay — KHÔNG ảnh/OCR)
│   ├── nhanKy.ts                # Chữ ký 8 vị trí
│   ├── scoring.ts               # Điểm A-E xe
│   ├── welcome.ts               # Trang chủ + trung tâm thông báo
│   ├── report.ts                # Báo cáo + export Excel (stream)
│   └── preview.ts               # Xem thử vai trò (DEMO RAM, admin)
├── packages/db/                 # schema.sql, migrations, seed, migrator SQLite→PG
├── packages/contract/           # Zod schemas cho mọi RPC (type-safe)
├── supabase/                    # config.toml, storage policies, RLS, cron TTL
├── tests/conformance/           # 327 test parity (HTTP thật trên v4)
└── docs/                        # Architect.md, MASTER_PLAN.md, CHANGELOG.md, SPEC-04-API.md
```

---

## 3. LOGIC TÍNH TOÁN (BẮT BUỘC GIỮ NGUYÊN — nguồn rewrite/02 §4)

### 3.1 Phiếu sửa chữa (SC)

| Công thức | Mô tả |
|---|---|
| `tong_cong = Σ(sc_congviec.so_luong × don_gia)` | Bỏ dòng `deleted_at<>''` |
| `tong_vt = Σ(sc_vattu.so_luong × (gd_tt>0 ? gd_tt : gd_dk))` | Ưu tiên giá thực tế; nếu không có dùng giá dự kiến |
| `tong = tong_cong + tong_vt` | Tổng phiếu |
| `syncPrices` | Khi thêm dòng: `don_gia = cat.don_gia`, `gd_dk = cat.gia`; nếu 0 thì kéo từ danh mục |

### 3.2 Đề nghị mua (DM)

- `so_luong = max(1, nhap)`, `gia = dgia || cat.gia`, `tong = Σ(so_luong × dg_dk)`.

### 3.3 Kho

- Nhập: `thanh = so_luong × dgia`; tăng `vattu.ton`; cập nhật `vattu.gia` + ghi `vattu_gia_lich_su`.
- Xuất: `thanh = so_luong × cat.gia` (giá hiện hành); giảm `ton`; **thiếu tồn → fail CẢ phiếu**.
- Nhập cũ/hỏng: tăng `vattu.ton_cu_hong` (KHÔNG đụng ton chính).

### 3.4 Tài sản — GTTV (khấu hao)

- `GTTV = nguyen_gia − khau_hao + chi_phi_tich_luy`.
- `khau_hao = (nguyen_gia / so_nam_khau_hao) × min(số năm từ năm SX, khau_hao_nam)`.
- `chi_phi_tich_luy = Σ lich_sua.tong` của xe.

### 3.5 Scoring A-E

- A=5, B=4, C=3, D=2, E=1. `scoreVehicle` = TB toàn xe + `hasE` (điểm nguy hiểm).
- `fleetReport` = `%E` + xu hướng "Cai thien/Suy giam/On dinh".

### 3.6 Ngưỡng duyệt

| Hàm | Quy tắc |
|---|---|
| `canApproveSC(role,tong)` | admin/giamdoc LUÔN; quanly nếu `tong <= duyet_sc_nguong` (default 5.000.000) |
| `canApproveMua(role,tong)` | admin/giamdoc LUÔN; ketoan nếu `tong <= duyet_mua_nguong` (default 5.000.000) |
| `canQuyetToan(role)` | admin/ketoan/giamdoc/quanly |
| `scNghiem` | admin/quanly/giamdoc |

---

## 4. STATE MACHINE (BẮT BUỘC TÁI TẠO ĐÚNG)

### 4.1 Phiếu sửa chữa SC

```
de_xuat → da_duyet → da_tong_duyet (tuỳ chọn) → dang_sua → cho_nghiem → da_hoan → da_quyet
                        \→ tu_choi
```

- `ACTIVE_STATUS = ['de_xuat','da_duyet','da_tong_duyet','dang_sua']` — được sửa dòng CV/VT. Từ `cho_nghiem`: **khoá**.
- `don_gia` CV chỉ sửa khi `de_xuat`.
- Duyệt: chỉ từ `de_xuat`, cần `canApproveSC`.
- Tổng duyệt: chỉ từ `da_duyet`, chốt snapshot `sc_phien_ban` → `da_tong_duyet`.
- Bắt đầu sửa: từ `da_duyet` hoặc `da_tong_duyet`, tự snapshot nếu chưa có → `dang_sua`.
- Hoàn thành: từ `dang_sua`, mọi CV phải `tt='hoan'` → `cho_nghiem`.
- Nghiệm thu: admin/quanly/giamdoc; đạt → `da_hoan` + ghi `bien_ban_nghiem`; không đạt → về `dang_sua`.
- Quyết toán: chỉ `da_hoan`, đủ 8 bước hồ sơ, 1 SC chỉ 1 lần → `da_quyet`.

### 4.2 Yêu cầu thăm khám TK

```
cho_duyet → da_duyet | tu_choi
da_duyet → xuong_nhan | xuong_tu_choi
xuong_nhan → da_giao_tho
da_giao_tho/xuong_nhan → dang_thuc_hien
dang_thuc_hien/da_giao_tho/xuong_nhan → tkFinish (da_hoan|da_huy) / tkCreateSC
```

### 4.3 Đề nghị mua DM

```
cho_duyet → da_duyet | tu_choi → (phNhapCreate) → da_nhap
```

---

## 5. BẢO MẬT (KHÔNG THƯƠNG LƯỢNG)

- **Auth**: custom `users.pass_hash = 'scrypt:salt:hash'` (timingSafeEqual); cookie `cen_session` HttpOnly + SameSite=Strict + **Secure** (HTTPS) + Max-Age 14 ngày; session touch.
- **must_change**: user dùng mật khẩu mặc định chỉ gọi `changePassword/currentUser/appInfo`; export 403.
- **CSRF**: mọi POST `/api/*` check Origin/Referer trùng Host → lệch 403.
- **CBAC 3 lớp**: `adminOnly` → `rpcMeta[fn]=[module,feature]` → `checkLock` trong hàm xử lý. Default-deny: fn không khai báo → từ chối.
- **IDOR**: `tkGet`/`tkCreate` kiểm tra `xe.lai_xe_id`/`xe.lai_xe` — lái xe chỉ chạm xe của mình.
- **Input**: validate + sanitize mọi đầu vào; whitelist trạng thái (`trang_thai`, `tt`, `loai_xu_ly`, `muc_uu_tien`); không nhận chuỗi tự do cho enum.
- **Header**: X-Content-Type-Options, X-Frame-Options, CSP, HSTS.
- **Log**: không ghi mật khẩu/token; `db.audit` cho hành vi ghi; log lỗi kèm stack chỉ khi DEBUG.
- **Không hardcode** secret — `.env` + `.gitignore`.

---

## 6. PHÂN QUYỀN CBAC (9 vai)

| Role | Quyền chính |
|---|---|
| admin | Toàn quyền (không cần dòng phan_quyen) |
| tho | sc.xem/tao/sua; asset.xem; kho.xem; xe.xem; report.xem; chat.xem/tao/sua; tk.xem/sua |
| khoa | kho.xem/tao/sua/xuat; mua.xem/tao; sc.xem; xe.xem; chat.xem/tao/sua |
| ketoan | mua.xem/tao/duy; asset.xem/quyet; sc.xem; kho.xem; xe.xem; report.xem; chat.xem/tao/sua; tk.xem |
| quanly | sc.xem/duy; asset.xem/quyet; kho.xem; mua.xem; xe.xem; report.xem; chat.xem/tao/sua; tk.xem/duy; xuong.xem |
| giamdoc | sc.xem/duy; asset.xem/duy; kho.xem; mua.xem/duy; xe.xem; report.xem; chat.xem/tao/sua; tk.xem/duy; xuong.xem |
| xuong | tk.xem/duy/sua; xuong.xem; sc.xem/tao/sua; asset.xem; kho.xem; xe.xem; report.xem; chat.xem/tao/sua |
| laixe | tk.xem/tao/sua; xe.xem; chat.xem/tao |
| bot | CencomBot (không đăng nhập trực tiếp) |

---

## 7. API CONTRACT (bất biến)

- `POST /api/rpc` body `{"fn":"...","args":[...]}` → `{ok:true,result}` / `{ok:false,error}`.
- 401 chưa đăng nhập; 403 CSRF/thiếu quyền; 404 fn không tồn tại; 400 param sai.
- `/export/*` lỗi 500 trả text (client `window.open`).
- Danh sách RPC đầy đủ + bảng quyền: xem `PLAN_14.08_supa.md` mục 8 (file cùng thư mục docs).

---

## 8. ĐIỀU KIỆN UI/UX (bản v4 — tốt hơn bản cũ)

### 8.1 Nguyên tắc chung

- **3 theme** (kế thừa `client/src/` v3.8): `theme-home` (glassmorphism xanh→amber), `theme-dash` (fintech bold gradient), `theme-default` (calm/clean). Body nhận class `theme-*` + `data-theme`.
- **Responsive**: PC đa cột · tablet 768–1023px sidebar icon 68px · mobile ≤767px drawer + KPI 2 cột + kanban 1 cột + nút ≥40px.
- **Accessibility**: `:focus-visible` ring mọi nút/link; đủ contrast; `tabular-nums` cho số tiền.
- **Phản hồi**: toast slide-in, skeleton loading, fade-in view 240ms, không mất scroll khi polling/realtime update.
- **Phân quyền UI**: nav/nút ẩn theo `myPerms`; **quyền thật vẫn kiểm server** (UI chỉ là thuận tiện).

### 8.2 Màn hình & điều kiện hiển thị

| Màn hình | Vai trò | Điều kiện chính |
|---|---|---|
| Đăng nhập + đổi mật khẩu | mọi role | must_change → chỉ cho 2 việc |
| Trang chủ | mọi role | greeting + KPI + Trung tâm thông báo (chat chưa đọc, việc dở, TK chờ duyệt, yêu cầu chờ xưởng, phiếu chờ nghiệm thu, VT < tồn min) |
| Bảng điều khiển | admin/giamdoc/quanly/xuong (chặn ketoan) | KPI 8 ô + Kanban 4 cột + ETA 3 màu + tải thợ |
| Danh sách SC | sc.xem | bộ lọc trạng thái, thanh % CV hoàn thành, tổng tiền, thợ chính, ETA |
| Chi tiết SC | sc.xem | 8 bước hồ sơ, nút theo trạng thái, in hồ sơ, chữ ký |
| Tạo SC | sc.tao | chọn xe, thêm CV/VT (stt/nguyên nhân/loại xử lý), hẹn trả xe (xuong) |
| TK | tk.xem | 4 vai nhìn khác nhau; lái xe chỉ thấy của mình |
| Kho | kho.xem | vật tư, tồn, DM, nhập/xuất, cu_hong, thanh lý |
| Chat | chat.xem | thread 1-1, job, bot; ảnh = nút Mở ảnh (tải về máy) |
| Tài sản | asset.xem | quyết toán, lịch sử, khấu hao |
| Phân quyền | admin | permMatrix, thresholds |
| Preview | admin | role picker 5 chip, banner DEMO, tab Home/SC/DM/Kho, khoá điều hướng |
| Báo giá NCC | mua.xem/tao | **nhập tay** items (bỏ ảnh/OCR) |
| Cổng lái xe | laixe | Xe của tôi / Gửi TK / Yêu cầu của tôi |
| Cổng tablet thợ | tho/xuong | 4 tab, cảm ứng, ảnh TK |

### 8.3 Realtime (thay polling 45s)

- Chat: subscribe `chat_messages` (filter theo thread) → cập nhật badge unread.
- Trang chủ: notification mới (TK mới, SC chờ duyệt, phiếu chờ nghiệm thu) → refresh đúng vùng.
- Dashboard: cập nhật Kanban khi SC/TK đổi trạng thái.
- **Không re-render toàn trang** — giữ scroll/trạng thái input.

### 8.4 In ấn (A4)

- `/in/hoso?sc_id=` và các `/in/*` trả HTML @media print, font Times New Roman, `window.print()` từ client. Không dùng docx.

### 8.5 Ảnh chat/TK (thiết kế file tạm)

- Nút "📎 Mở ảnh" → `/chat/file/:id` (requireAuth) → tải về máy người nhận (`Content-Disposition: attachment`) → nhúng objectURL vào DOM chat của người nhận.
- Tin nhắn cũ sau 1 ngày (file đã xoá) → hiển thị "Ảnh đã hết hạn (lưu ≤1 ngày)".
- Hint trong khung chat: "Ảnh được tải về máy bạn, không lưu vĩnh viễn trên hệ thống".

---

## 9. DATABASE (PostgreSQL — sơ đồ đầy đủ trong PLAN mục 6)

- Giữ tên bảng/cột/id `PREFIX-000001` (VARCHAR(12) PK); soft-delete `deleted_at TEXT DEFAULT ''`; JSON TEXT.
- Ngày tháng: **giữ TEXT `YYYY-MM-DD`** (quyết định duy nhất — không đổi format khi migrate).
- `sessions.expires_at` → TIMESTAMPTZ; `config` lưu counter + ngưỡng + khấu hao.
- Index + partition + materialized view + RLS: xem PLAN mục 6.6–6.8.

---

## 10. QUY ƯỚC CODE (dự án v4)

- **TypeScript strict**; mọi hàm nghiệp vụ **async** (Postgres pool) — `await` đủ; wrapper bắt lỗi; không fire-and-forget.
- **Zod** ở `packages/contract` cho input RPC (validate + sanitize).
- Nghiệp vụ: thêm hàm trong `packages/core` → khai báo quyền trong bảng RPC → viết test → cập nhật docs.
- Ghi nghiệp vụ: transaction PG + `db.audit` (log_audit) + soft-delete; không DELETE cứng.
- SQL: dùng parameterized query (pg `$1,$2`); không nối chuỗi.
- Mọi enum: whitelist hằng số (KHÔNG nhận chuỗi tự do).
- Commit theo từng GĐ; giữ `tests/conformance` xanh trước khi bàn giao.
- Bàn giao kèm "⚠️ Lưu ý hệ thống sản xuất (Production Check)" — 4 câu: thiếu gì / rủi ro đâu / đã test chưa / đề xuất tiếp theo.

---

> **Lưu ý hệ thống sản xuất (Production Check):**
> - Con thieu gi? Mọi code chưa viết — tài liệu này là kiến trúc đích. GĐ1 (schema/migrator/seed) là việc kế tiếp.
> - Rui ro nam o dau? Sai lệch logic khi port (chống bằng conformance 327 test); quên khai báo quyền RPC (default-deny + test auth); format ngày TEXT (đã chốt).
> - Da chay kiem thu chua? Chưa có code nên chưa chạy. Khi viết schema: `tsc --noEmit` + test seed.
> - De xuat tiep theo? Phiên mới tại thư mục dự án 4.0: làm GĐ1 theo `PLAN_14.08_supa.md` mục 13 (GĐ1).