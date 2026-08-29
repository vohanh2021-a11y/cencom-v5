# PLAN 29.08 — Hoàn thiện chuẩn KIỂM THỬ & GPS cho tính năng Hồ sơ 8 bước (v5.0)

> Mục tiêu: đưa tính năng **Hồ sơ 8 bước sửa chữa** (đã code xong, UX 10/10 PASS) từ trạng thái "chạy được" → **đạt chuẩn GPS + Git compliant** và **chuẩn kiểm thử** (theo `SWARM_PLAN.md`, `MASTER_PLAN.md`, `AGENTS.md`).
> Cách dùng: Orchestrator đọc plan này, spawn subagent theo từng Task (Wave 1 song song, Wave 2 tuần tự), mỗi agent 1 file riêng (file reservation), verify từng bước rồi mới commit.

---

## 0. Trạng thái hiện tại (tóm tắt audit 28.08)
| Hạng mục | TT | Ghi chú |
|---|---|---|
| `tsc --noEmit` = 0 | ✅ | đã chạy |
| UX 10-scenario | ✅ | 10/10 PASS |
| Unit test `checkHoSo`/4 RPC | ❌ | chưa có |
| Conformance QC206 8-bước | ❌ | chưa có |
| ESLint + Prettier | ❌ | không config |
| `npm audit` | ❌ | chưa chạy |
| OWASP review RPC mới | ⚠️ | SQLi/RBAC ok, thiếu XSS/CSRF/IDOR chính thức |
| Edge-case tests | ⚠️ | chưa có |
| Logging (INFO/WARN/ERROR) | ✅ | `logActivity` có sẵn, cần chuẩn hoá |
| **Git gate** (commit/CHANGELOG/tag) | ❌ | 10 file v5 CHƯA commit, chưa tag |

---

## 1. NGUYÊN TẮC THỰC THI (bắt buộc)

1. **Swarm song song theo Wave** — mỗi Task = 1 subagent, file riêng (xem §4). Orchestrator KHÔNG tự viết code, chỉ phân phối + theo dõi + gộp.
2. **File reservation** — trước khi spawn, orchestrator gọi `swarmmail_reserve(paths)` khoá file; agent chỉ sửa file đã reserve. Không 2 agent cùng sửa 1 file.
3. **Verify gate mỗi Task** — agent trả kết quả kèm BẰNG CHỨNG (test chạy thực, log). Chỉ close task khi: `tsc=0` (với task code) + test/script chạy PASS.
4. **Git gate (GPS)** — sau mỗi Wave: `git add` đúng file → `git status` soát (KHÔNG `.env`/`*.log`) → `git commit -m "gd2: ..."` → cập nhật `CHANGELOG.md` → tag milestone (`v5.0.0-beta`).
5. **Production Check 4 câu** áp dụng cho mọi task code (con thiếu gì / rủi ro / đã test chưa / đề xuất tiếp).

### 1.1 QUY TẮC ĐỔI MODEL AI CHO AGENT (quan trọng)
Áp dụng khi agent **im lặng / không phản hồi / treo / trả lỗi API / rate-limit / timeout**:
- **Ngưỡng:** không thấy phản hồi sau **~45s** (hoặc bắt lỗi `timeout`/`429`/`5xx` từ model) → coi như agent "chết".
- **Hành động:** spawn LẠI subtask đó bằng **worker model khác** (theo `fallbackModels` trong `opencode-swarm.json`), ưu tiên model nhanh/rẻ trước.
- **Giới hạn:** tối đa **2 lần đổi model** cho 1 subtask. Nếu vẫn fail sau 2 lần → báo coordinator/human, KHÔNG lặp vô hạn.
- **Ghi nhận:** mỗi lần đổi model → ghi vào memory (`hivemind_store`): subtask nào, model cũ→mới, lý do, kết quả. Dùng để tối ưu lần sau.
- **Competitive mode (tuỳ chọn):** với task rủi ro cao (security review), giao CÙNG 1 subtask cho 2–3 model khác nhau, chọn kết quả tốt nhất (KHÔNG gộp).

---

## 2. LỘ TRÌNH 2 WAVE

### WAVE 1 — Viết test + Security/Logging (song song, file-isolated)
| Task | Agent | File reserve | Output | GPS-map |
|---|---|---|---|---|
| **T1** Unit test TDD `checkHoSo` + 4 save-RPC | worker-c | `gara_reconstruction_v5/tests/conformance/ho_so.test.ts` | file test, `jest ho_so` PASS (≥12 case) | GĐ1 TDD, GĐ2 testing |
| **T2** Integration `/api/rpc` từng vai + edge-case | worker-e | `gara_reconstruction_v5/tests/conformance/rpc_hoso.test.ts` | test role (admin/xuong/ketoan) + input rỗng/dài/`' OR 1=1`/sc_id lạ → 403/400/404 | GĐ2 edge/RBAC/async |
| **T5** OWASP + Logging hardening | worker-f (+worker-a implement) | `lib/rpc.ts`, `middleware.ts`, `lib/core/ho_so.ts`, `lib/core/baogia.ts`, `lib/core/sc.ts` | XSS escape export HTML; CSRF Origin check; IDOR `sc_id`; RBAC default-deny; logActivity INFO/WARN/ERROR + redact secret | GĐ2 OWASP + logging |
| **T6** Conformance QC206 8-bước parity | worker-c | `gara_reconstruction_v5/tests/conformance/qc206_hoso.test.ts` | map 8 bước QC206 ↔ `checkHoSo`, assert đúng gate (theo `plan_dieuchinh_18.08/02-traceability.md`) | GĐ1 conformance, QC206 |

### WAVE 1b — Config & Audit (serialize trên package.json)
| Task | Agent | File reserve | Output | GPS-map |
|---|---|---|---|
| **T3** ESLint + Prettier | worker-d | `.eslintrc.json`, `.prettierrc.json`, `package.json` (script `lint`) | `npx eslint . --ext .ts` = 0 error | GĐ2 ESLint |
| **T4** `npm audit` + fix | worker-b | `package.json`, `package-lock.json` | `npm audit` còn ≤ moderate (không high/critical) | GĐ2 npm audit |

> T3 chạy trước T4; cả hai reserve `package.json`/`package-lock.json` (serialize, không song song trên 2 file này).

### WAVE 2 — Verify + Git gate + GĐ3 (tuần tự)
| Task | Agent | File reserve | Output | GPS-map |
|---|---|---|---|
| **T8** Full verification sweep | coordinator | (read-only) | báo cáo: `tsc=0`, `eslint=0`, `audit≤moderate`, `jest` all PASS, Playwright 10/10; evidence file `tests/ux/evidence_29.08.md` | all gates |
| **T9** Git gate | worker-a | 10 file v5 + `CHANGELOG.md` | commit `gd2: hoso8 + GPS/Git compliant`; update CHANGELOG; tag `v5.0.0-beta` | Git gate |
| **T10** CI/CD + Obs + Rollback (GĐ3) | worker-g | `.github/workflows/ci.yml`, `Onpremise/scripts/*` | CI chạy lint+test cho `gara_reconstruction_v5`; verify rollback/backup script; docs | GĐ3 |

---

## 3. CHI TIẾT TỪNG TASK (output contract)

### T1 — Unit test TDD `checkHoSo` + 4 save-RPC
- **Objective:** viết test đơn vị cho logic cốt lõi hồ sơ 8 bước.
- **Output:** `tests/conformance/ho_so.test.ts` với các case:
  - `checkHoSo` trả 8 bước đúng thứ tự, `ok=false` khi thiếu KT/KH/bao_gia/nhap/xuat/nghiem_thu/tong.
  - `keHoachSave`/`kiemTuSave`/`nghiemThuSave` insert đúng bảng `ke_hoach_sc`/`phieu_kiem_tu`/`bien_ban_nghiem` (dùng SC `is_test=1`).
  - `baogiaSave` có `sc_id` → mirror `bao_gia_ncc` (`ocr_xac_nhan=1`).
  - Sai perm → 403.
- **Tools:** `jest` (hoặc `vitest`), DB test (pg Pool local, rollback sau mỗi test).
- **Boundary:** KHÔNG sửa `lib/core/ho_so.ts` (chỉ test); nếu phát hiện bug → báo coordinator, không tự sửa.

### T2 — Integration `/api/rpc` per role + edge-case
- **Objective:** kiểm chứng RBAC + input xấu qua route thật.
- **Output:** `tests/conformance/rpc_hoso.test.ts`:
  - Login 3 vai (admin/xuong/ketoan) → gọi `keHoachSave`/`kiemTuSave`/`nghiemThuSave`/`hoSoCheck` → assert quyền đúng.
  - Edge: `sc_id=''` / `'a'.repeat(200)` / `"'; DROP TABLE--"` / `sc_id='SC-KHONG-TON-TAI'` → 400/404, KHÔNG crash.
  - User A tạo SC → User B (cùng role) gọi `keHoachSave` SC của A → 403 (IDOR).
- **Boundary:** chỉ test; không sửa route/middleware (sửa thuộc T5).

### T5 — OWASP + Logging hardening (QUAN TRỌNG)
- **Objective:** đóng lỗ hổng theo GĐ2 trước khi deploy.
- **Output (code + test):**
  - `middleware.ts`: đảm bảo POST `/api/rpc` check `Origin`/`Referer` khớp (CSRF).
  - `lib/core/ho_so.ts` + `baogia.ts` + `sc.ts`: escape mọi output HTML (`exportHoso`) — KHÔNG `innerHTML` với data user; dùng `textContent`/`escape()`.
  - `keHoachSave`/`kiemTuSave`/`nghiemThuSave`: validate `sc_id` tồn tại + thuộc quyền (IDOR); từ chối nếu thiếu perm (default-deny).
  - Thêm `logActivity('INFO', 'ho_so_save', {sc_id, step})` khi thành công; `WARN` khi validate fail; `ERROR`+stack khi exception; redact password/token.
- **Verify:** `tsc=0` + chạy lại T1/T2 vẫn PASS + 1 test XSS (`<script>` trong note → escaped).

### T6 — Conformance QC206 8-bước parity
- **Objective:** chứng minh hồ sơ 8 bước khớp Quy chế QC206.
- **Output:** `tests/conformance/qc206_hoso.test.ts` ánh xạ từng bước QC206 (theo `plan_dieuchinh_18.08/02-traceability.md`) ↔ `checkHoSo`, assert gate đúng.
- **Verify:** jest PASS.

### T3 — ESLint + Prettier
- **Objective:** thêm công cụ lint (GĐ2).
- **Output:** `.eslintrc.json` (extends next/core-web-vitals + ts), `.prettierrc.json`, script `"lint": "eslint . --ext .ts --max-warnings=0"` trong `package.json`. Chạy `npx eslint . --ext .ts` → 0 error (fix thủ công các warning nghiêm trọng).
- **Boundary:** không đổi logic; chỉ format/sửa lỗi lint.

### T4 — `npm audit` + fix
- **Objective:** không lỗ hổng critical/high.
- **Output:** `npm audit` ≤ moderate. Dùng `npm audit fix` (hoặc manual) cho high/critical; ghi log các còn lại.
- **Boundary:** reserve `package.json`/`package-lock.json` (serialize sau T3).

### T8 — Full verification sweep
- **Objective:** thu thập bằng chứng GPS.
- **Output:** `tests/ux/evidence_29.08.md` ghi: `tsc`, `eslint`, `npm audit`, `jest` (conformance + T1/T2/T6), Playwright 10/10. Mọi lệnh chạy thực, paste output.
- **Verify:** tất cả xanh → mới qua cổng.

### T9 — Git gate
- **Objective:** GPS Git compliant.
- **Output:** commit 10 file v5 (`app/(app)/sc/page.tsx`, `db/schema.sql`, `db/migrate_hoso_v4.ts`, `lib/core/{ho_so,baogia,sc,rpc}.ts`, `tests/ux/*`); update `CHANGELOG.md` entry `v5.0.0-beta — Hồ sơ 8 bước + GPS/Git compliant`; `git tag -a v5.0.0-beta`.
- **Red flag:** KHÔNG commit `.env`; KHÔNG tag khi test chưa pass.

### T10 — CI/CD + Obs + Rollback (GĐ3)
- **Objective:** production-ready.
- **Output:** `.github/workflows/ci.yml` có job chạy `npm ci && npm run lint && npx tsc --noEmit && npx jest` cho `gara_reconstruction_v5`; verify `Onpremise/scripts/backup.sh`+`rollback.sh` chạy được; docs.

---

## 4. MA TRẬN FILE RESERVATION (chống ghi đè)
| Agent | Reserve (tuyệt đối) | Không được sửa |
|---|---|---|
| T1 | `tests/conformance/ho_so.test.ts` | mọi file `lib/` |
| T2 | `tests/conformance/rpc_hoso.test.ts` | route/middleware |
| T5 | `lib/rpc.ts`, `middleware.ts`, `lib/core/ho_so.ts`, `lib/core/baogia.ts`, `lib/core/sc.ts` | test file (thuộc T1/T2/T6) |
| T6 | `tests/conformance/qc206_hoso.test.ts` | lib |
| T3 | `.eslintrc.json`, `.prettierrc.json`, `package.json` (script) | lib/test |
| T4 | `package.json`, `package-lock.json` | source |
| T8 | (read-only) | — |
| T9 | 10 file v5 + `CHANGELOG.md` | — |
| T10 | `.github/workflows/ci.yml`, `Onpremise/scripts/*` | app source |

> Xung đột tiềm tàng: T3 & T4 cùng đụng `package.json` → **serialize** (T3 trước, T4 sau). T5 & (T1/T2/T6) đụng `lib/core/ho_so.ts`? → T5 sở hữu `lib/core/*`; T1/T2/T6 CHỈ test (không sửa lib) → an toàn.

---

## 5. RỦI RO & XỬ LÝ
| Rủi ro | Xử lý |
|---|---|
| Agent im lặng/timeout | Đổi model (§1.1), max 2 lần, ghi memory |
| 2 agent đụng file | `swarmmail_reserve` / serialize (§4) |
| Test DB làm bẩn dữ liệu thật | dùng SC `is_test=1`, cleanup sau mỗi test |
| `npm audit fix` gãy build | chỉ fix high/critical; moderate ghi log, đưa human |
| Quên commit `.env` | `git check-ignore -v .env` bắt buộc trước T9 |
| Tag khi test chưa pass | Git gate T9 DỪNG, báo user |

---

## 6. DEFINITION OF DONE (đạt chuẩn)
- [ ] `npx tsc --noEmit` = 0
- [ ] `npx eslint . --ext .ts` = 0 error
- [ ] `npm audit` còn ≤ moderate
- [ ] `jest` (conformance + T1/T2/T6) PASS, ≥ mục tiêu (T1≥12, T2≥8, T6≥8 case)
- [ ] Playwright 10/10 vẫn PASS
- [ ] OWASP: XSS/CSRF/IDOR/RBAC default-deny đã review + test
- [ ] Logging INFO/WARN/ERROR + redact secret
- [ ] Git: 10 file commit + `CHANGELOG.md` update + tag `v5.0.0-beta`
- [ ] `evidence_29.08.md` có đủ output thực tế

---

## 7. GỢI Ý LỆNH ORCHESTRATOR (thực thi)
```
swarm_init(isolation="reservation")
# Wave 1
swarmmail_reserve(paths T1/T2/T5/T6)  # theo §4
task(worker-c, "T1 ...")  || task(worker-e,"T2 ...") || task(worker-f,"T5 ...") || task(worker-c,"T6 ...")
# Wave 1b (serialize T3->T4)
task(worker-d,"T3 ...")  -> task(worker-b,"T4 ...")
# Wave 2
task(coordinator,"T8 verify") -> task(worker-a,"T9 git gate") -> task(worker-g,"T10 GĐ3")
# model rotation: nếu agent timeout/429 -> spawn lại với model fallback (<=2 lần)
```

> Khi mọi task xanh → dự án **đạt chuẩn GPS + Git compliant**, sẵn sàng gộp codebase (MASTER_PLAN mục 6) và deploy LAN.
