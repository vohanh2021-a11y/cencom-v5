# changelog_testfix — E2E thực tế khép kín (Playwright + video)

> Mục tiêu: mô phỏng chạy E2E thực tế trên hệ thống đang chạy (web `next dev` + Postgres live
> trên Supabase local stack, port 54322), quay video từng luồng, và bắt các lỗ hổng "đường chết"
> mà unit test không phủ tới. Mỗi đợt kiểm tra đều ghi vào file này.

## Môi trường kiểm tra (thực tế, không giả lập)
- Web: `http://localhost:3000` (Next.js `next dev`, PID khởi từ `cmd /c npx next dev -p 3000`).
- DB live: Supabase local stack (Docker container `supabase-db`), publish `54322`.
  - `postgresql://postgres:cencom_pass_2026_prod_2026@127.0.0.1:54322/cencom_os`
  - Lấy mật khẩu từ `docker inspect supabase-db` (biến `POSTGRES_PASSWORD`).
- Env web: `DATABASE_URL` (trỏ 54322), `SESSION_SECRET`, `SECURE_COOKIE=0` (chạy localhost HTTP).
- Auth E2E: admin-1; mật khẩu ban đầu `cencom@123` (must_change=1) → lần login đầu đổi thành `Cencom@2026`.
- Video: `apps/web/e2e/playwright.config.ts` set `video: 'on'` → lưu tại
  `apps/web/test-results/<test>/video.webm`.

## Đợt kiểm tra & các lỗi tìm thấy / fix

### Lần 1-5: lỗi cấu hình E2E (chưa chạm tới logic nghiệp vụ)
1. **Trailing-space trong `DATABASE_URL`** — lệnh `set DATABASE_URL=... &&` của `cmd` gán cả
   khoảng trắng đuôi → web kết nối DB tên `"cencom_os "` (có dấu cách) → API login 500
   `database "cencom_os " does not exist`. **Fix:** khởi web bằng PowerShell `$env:DATABASE_URL=...`
   (không qua `set`), tránh khoảng trắng đuôi. Đây là bài học: env truyền qua `cmd /c set` dễ nhiễm
   khoảng trắng → phải trim hoặc set từ shell cha.
2. **Playwright không đọc config** — chạy `npx playwright test` từ `apps/web` trong khi
   `playwright.config.ts` nằm trong `apps/web/e2e/` → Playwright dùng config mặc định (bỏ qua
   projects `setup`/`chromium`, storageState không được ghi). **Fix:** luôn chỉ định
   `--config e2e/playwright.config.ts`.
3. **`__dirname` không tồn tại trong ESM** — config dùng `__dirname` → ReferenceError. **Fix:** tính
   `dirname(fileURLToPath(import.meta.url))`.
4. **`testDir: './e2e'` sai** — config đã nằm trong `e2e/`, thành `e2e/e2e`. **Fix:** `testDir: __dirname`.
5. **storageState path tương đối bị giải quyết khác nhau** giữa project `setup` (theo CWD) và
   `chromium` (theo thư mục config) → chromium không có session → redirect /login. **Fix:** dùng
   đường dẫn tuyệt đối `AUTH_FILE = path.resolve(__dirname, '.auth/admin.json')` ở cả config và
   `auth.setup.ts`.

### Lần 6-8: phát hiện BUG THẬT trong logic nghiệp vụ
6. **Mật khẩu admin-1 không khớp seed** — DB live được init bởi on-premise stack với mật khẩu khác
   `cencom@123`, `must_change=0`. API login 401 với mọi mật khẩu thử. **Fix (tạm cho E2E):** reset
   `pass_hash` của admin-1 về `cencom@123` (dùng `scrypt` đúng định dạng dự án) + `must_change=1`.
   *Ghi chú:* on-premise `init_db.sh` cần cập nhật comment/tài khoản mẫu cho đúng.
7. **BUG PHÂN QUYỀN (admin không dùng được tính năng module)** — `core.perm.permsOfRole('admin')`
   trả `{ all: ['all'] }`, nhưng các trang (baogia,...) check `perms['mua'].includes('tao')` →
   `perms['mua']` là `undefined` → nút "Tạo chứng từ" ẩn, admin KHÔNG thể tạo chứng từ. **Fix:**
   `permsOfRole` với admin trả đủ mọi module + mọi feature (giữ wildcard `all` để tương thích).
   Cập nhật 3 test (`perm.test.ts`, `gd41.test.ts`) cho khớp. *Đây là lỗ hổng RBAC thật làm admin
   bị kẹt UI — unit test cũ assert sai hành vi nên không bắt được.*
8. **BUG SCHEMA (xeSave lỗi cột)** — `core.xe.xeSave` INSERT cả cột `chu_xe`, nhưng bảng `xe` live
   (init từ on-premise migrations) chỉ có `khach_hang_id`, thiếu `chu_xe` → `column "chu_xe" of
   relation "xe" does not exist` → xe KHÔNG lưu được (E2E ban đầu hiện false-green). **Fix:**
   - ALTER live DB: `ALTER TABLE xe ADD COLUMN IF NOT EXISTS chu_xe TEXT DEFAULT ''` (đã chạy).
   - `schema.sql` (dùng cho cloud `supabase db push`) đã có `chu_xe` sẵn → chuẩn.
   - Tạo `Onpremise/migrations/005_chu_xe.sql` (idempotent) để on-premise có sẵn cột này.

### Lần 9-11: siết assert, loại false-green
9. **False-green do assert yếu** — test cũ chỉ assert `URL contains /xe` (khớp cả /xe/new) và
   `body không chứa 'Internal Server Error'` → coi như pass dù save thất bại. **Fix:**
   - xe: assert `page.getByText(bks).toBeVisible()` ở trang chi tiết (chỉ redirect khi `r.ok`).
   - baogia: assert toast `Đã tạo chứng từ NCC` + reload `/baogia` thấy dòng `NCC E2E <ts>`.
   - Dùng biến unique (`Date.now()`) để chạy lặp được.

## Kết quả cuối (lần 11)
- `npx playwright test --config e2e/playwright.config.ts` → **4/4 passed (10.2s)**.
  - setup: đăng nhập admin (login + đổi mật khẩu + lưu storageState).
  - Tạo xe mới từ /xe/new → tạo thực tế (xe `51C-xxx`, `chu_xe` lưu đúng).
  - Trang nhắc hạn hiển thị.
  - Tạo chứng từ NCC → tạo thực tế vào `bao_gia_ncc`, xuất hiện trong list.
- **Verify DB thực tế:** `xe` có 2 dòng `51C-%` (chu_xe ≠ ''), `bao_gia_ncc` có 2 dòng `NCC E2E %`.
- **Video:** 4 file `video.webm` tại `apps/web/test-results/<test>/video.webm` (auth.setup, 3 flow).
- `npx vitest run` (packages/core) → **159/159 passed** (không hồi quy do sửa perm + chu_xe).

## Rủi ro / tồn tại cần theo dõi
- Web đang chạy ở chế độ `next dev` (không phải `next start` production) cho mục đích E2E; khi deploy
  production phải build lại (`npm run build`) để nạp code core mới.
- Mật khẩu admin-1 trong DB live là `cencom@123` (reset tạm). Cần chuẩn hóa tài khoản mẫu qua
  `init_db.sh`/seed để không phải reset tay.
- On-premise migration 004 chưa có `chu_xe`; phải chạy `005_chu_xe.sql` (đã thêm) khi deploy on-premise.

---

## Đợt 2 — Mở rộng 9 luồng nghiệp vụ + quay video demo (10/10 passed)

> Yêu cầu: quay video từng quy trình (lập phiếu SC, báo giá NCC, đề xuất mua VT, nhập/xuất kho,
> thêm KH, hồ sơ xe, quyết toán, nhắc hạn) vừa làm tư liệu hướng dẫn, vừa soi tiếp "đường chết".
> Mở rộng `flow.spec.ts` lên 9 test (mỗi test = 1 video). Kết quả: **10/10 passed**, bắt thêm
> 4 BUG THẬT + 3 lỗi test (false-green / selector / strict-mode).

### Các BUG THẬT tìm thấy & fix
10. **SC: trường ngày rỗng fail Zod** — trang `/sc/create` gửi `ngay_du_kien: ''` (để trống),
    contract `scCreate` dùng `ngay_du_kien: dateStr.optional()` mà `.optional()` KHÔNG chấp nhận
    chuỗi rỗng `''` → lỗi `'Ngày phải YYYY-MM-DD'`. **Fix (2 tầng, defense-in-depth):**
    - `packages/contract/src/schemas.ts`: thêm helper `optDate = z.preprocess(v => v===''||v==null||v===undefined ? undefined : v, dateStr.optional())` và áp dụng cho mọi trường ngày tùy chọn
      (`ngay_du_kien`, `thoi_gian_tu/den`, `tu/den`, `ngay`). Rebuild contract (`npm run build`).
    - Trang `/sc/create` gửi `ngay_du_kien: ngayDK || undefined` (không gửi rỗng).
11. **Đề xuất (ĐX): sai ENUM + sai TÊN TRƯỜNG** (2 bug, đều gây false-green):
    - (a) `PRIORITIES` trang gửi `'thap'/'binh_thuong'/'cao'/'khan_cap'` (lower-case, 4 giá trị)
      nhưng contract/core chỉ nhận `['Khan_cap','Xu_ly_som','Binh_thuong']` → validation fail.
      **Fix:** `PRIORITIES` → `[{Binh_thuong,'Bình thường'},{Xu_ly_som,'Xử lý sớm'},{Khan_cap,'Khẩn cấp'}]`,
      default `'Binh_thuong'`.
    - (b) trang gửi field `lydo` nhưng contract/core yêu cầu `mo_ta` → lỗi `'mo_ta: Required'`.
      **Fix:** trang gửi `mo_ta: lydo`.
    - *Cả 2 gây false-green:* test cũ assert `waitForURL(/\/de-xuat\//)` khớp CẢ `/de-xuat/create`
      (khi tạo lỗi, trang ở lại form) → coi như pass dù `de_xuat_sua_chua` rỗng.*
12. **BUILD ERROR `redis` phá route /api/rpc** — `packages/core/src/cache.ts` dùng
    `require('redis')` (lazy, đúng thiết kế optional), nhưng webpack vẫn cố resolve tĩnh →
    `"Module not found: Can't resolve 'redis'"` khi recompile sau khi sửa nhiều file → route
    `/api/rpc` (import core) fail NGẮT QUÃNG → baogia/xe flaky fail. **Fix:** `next.config.js`
    thêm `config.resolve.fallback = { ...(config.resolve.fallback||{}), redis: false }`
    (redis vẫn optional, in-memory mặc định khi chưa cài). *Không thêm dependency.*

### Lỗi TEST (không phải lỗi hệ thống, nhưng che giấu bug)
13. **Selector xuất kho bắt nhầm** — `page.locator('select.input').first()` bắt nhầm combobox
    "loại xuất" (đứng trước select vật tư) → vật tư không được chọn → tạo phiếu rỗng fail.
    **Fix:** gán `data-testid="vattu-select"` cho `<select>` vật tư trong `/kho/nhap` & `/kho/xuat`,
    test dùng `getByTestId('vattu-select')`.
14. **Strict-mode `getByText(bks)`** — `bks` hiện ở CẢ heading lẫn hàng "Biển số" trên trang
    chi tiết SC & xe → Playwright strict violation → timeout (từng làm SC/xe flaky fail).
    **Fix:** `getByText(bks).first()`.
15. **Siết assert ĐX** — đổi `waitForURL(/\/de-xuat\//)` → `/\/de-xuat\/DX/` (chỉ khớp
    trang chi tiết, không khớp `/de-xuat/create`), loại bỏ false-green.

### Kết quả cuối (Đợt 2)
- `npx playwright test --config e2e/playwright.config.ts` → **10/10 passed (20s)**.
  - 9 flow: SC, báo giá NCC, đề xuất ĐX, nhập kho, xuất kho, thêm KH, hồ sơ xe, quyết toán SC, nhắc hạn.
  - setup: đăng nhập admin.
- **Verify DB thực tế (không còn false-green):** `phieu_sua`=12, `de_xuat_sua_chua`=**2** (trước=0!),
  `bao_gia_ncc`=10, `phieu_nhap`=8, `phieu_xuat`=6, `khach_hang`=8, `xe`=52.
- **Video demo:** 10 file `video.webm` tại `apps/web/test-results/<test>/video.webm`
  (auth.setup + 9 flow). Đây là tư liệu chạy thực tế khép kín từng nghiệp vụ.
- `packages/core` vitest: 159/159 (không hồi quy do sửa contract/core).

### Tồn tại nhỏ cần theo dõi
- Trong log RPC từng thấy 2 lần `SyntaxError: Unexpected end of JSON input` (request body rỗng).
  Nhiều khả năng do client abort kết nối ngay sau `await res.json()` + `router.push` (dev-only).
  Đã revert đoạn debug-log tạm; cần monitor thêm ở môi trường thực tế. Có thể bọc `request.json()`
  bằng try/catch trả 400 rõ thay vì 500 nếu body rỗng.
- Các trang tạo (SC, ĐX, xe) chưa có unit test backend tương ứng → đã bổ sung cover qua E2E.


## Dot 3 — Ap dung simulation-testing kit (Contract / Load / Playwright / Skill)

> Nguon: E:\APP-LAPTOP-SYNC\simulation-testing-kit (skill + 4 reference). Ap dung 4 lop mo phong vao cencomOS de test "cho chuan chi" va dua vao quy trinh kiem thu.

### A. Contract test (consumer-driven) — boundary /api/rpc
- File: packages/core/tests/contract.test.ts (chay trong vitest workspace core).
- Ma hoa "giao keo" frontend->Zod: voi moi RPC_SCHEMAS[fn] (35 fn), payload thuc te frontend gui PHAI thoa schema; nguoc lai moi payload khai bao PHAI co schema (chan drift hai chieu).
- Regression cac bug Dot 2: optDate nhan ''; deXuatCreate bat mo_ta (khong lydo); muc_uu_tien enum chuan Khan_cap/Xu_ly_som/Binh_thuong (khong cao). Ngan truot nguoc.
- Vitest alias @cencom/contract -> contract/src/index.ts (dung source, tranh dist loi thoi).
- packages/core/tsconfig.json them paths tro src de tsc typecheck khop alias.
- Ket qua: 41/41 contract tests pass; npm test core tong 200/200.
- Chay: npm run test:contract (hoac npx vitest run contract trong packages/core).

### B. Load test (k6) — do chiu tai da user
- Bundle k6 binary: tools/k6/k6.exe (v0.53.0).
- Script: tests/load/cencom_load.js (stages ramp-up->sustain->ramp-down, thresholds p95<800/p99<2000, error<5%). Login /api/auth -> cookie cen_session -> gui Cookie + x-session-token (middleware copy) + khong Origin/Referer (CSRF pass). Doc SC/vat tu/de xuat/dashboard + write SC.
- Runner cross-platform: scripts/load-runner.mjs. Cleanup: scripts/clean-load.mjs (xoá SC marker mo_ta LIKE 'k6-load-%').
- Smoke (4 VU/12s): 116 checks 100% ok, p95~65ms, 0% loi; write thuc su persist (23 dong don sach).
- Bai hoc: assert CA envelope.ok VA business result.ok (tranh false-green: envelope ok nhung result.ok=false "Chua co xe..." do scCreate yeu cau xe ton tai).
- Chay: node scripts/load-runner.mjs tests/load/cencom_load.js -s 10s:3

### C. Playwright best-practices — chuan hoa E2E
- apps/web/e2e/playwright.config.ts: them actionTimeout 8000, CI workers, forbidOnly khi CI.
- apps/web/e2e/helpers.ts: business-action rpc(request, fn, args) + ensureXe (seed qua API thay click UI).
- apps/web/e2e/api-helpers.spec.ts: demo lop "API contract" trong E2E, assert dung result.sc.id.
- Ket qua: 11/11 E2E passed (10 flow + 1 API contract + setup).

### D. Skill dang ky
- Copy simulation-testing vao GLOBAL skills: E:\DevTools\opencode\config\skills\simulation-testing\ (SKILL.md + reference/). Sua frontmatter description thanh 1 dong bat dau "Use when" (chuan checker).
- Cap nhat SKILL_REGISTER.md (entry GLOBAL). node check-skills.js -> ERR=0 (WARN=1 khong chan).

### Ton tai / de xuat tiep
- npm run typecheck (root) van loi 3 cho o packages/db (cli.ts, migrate-tk-removal.ts) — co tu truoc, khong lien quan Dot 3, can sua rieng.
- Contract test hien ma hoa payload bang tay; co the nang thanh Pact provider-verify thuc thu neu muon CI gate tu dong.
- Load test moi do read+1 write nhe; nen bo sung stress/spike va write nang (nhap/xuat kho hang loat) de tim diem gan connection pool (PG max:10).

## Đợt 4 — xử lý tiếp các đề xuất (A/B/C/D bổ sung)

### #1 Sửa typecheck packages/db (ĐÃ XONG)
- `packages/db/src/cli.ts`: import `SqlClient`; `runSeed` bọc `pg.Pool` thành `client: SqlClient`, `seedDir = path.join(__dirname,'..','seed')` (sửa `seedAll()` thiếu 2 đối số).
- `packages/db/src/migrate-tk-removal.ts`: `dxIndexes: [string,string,string][]` (noUncheckedIndexedAccess) + `pathToFileURL(process.argv[1] ?? import.meta.url)`.
- `packages/db/seed` tồn tại (seed_vattu.json, seed_xe.json).
- Kết quả: root `npm run typecheck` sạch hoàn toàn (exit 0).

### #2 Nâng load test (stress + write nặng) (ĐÃ XONG)
- `tests/load/cencom_load.js`: thêm group `HEAVY write` kích hoạt `HEAVY=1` — gửi scCreate 10 công việc + 10 vật tư.
- Phát hiện drift (LỖ HỔNG tiềm tàng): Zod `scCreate` `congviec.loai_xu_ly` là `optionalStr` (tự do), nhưng DB CHECK `chk_sc_congviec_loai_xu_ly` chỉ nhận `{thay_the, khac_phuc}`. Gửi `'sua_chinh'` → DB từ chối, API trả ok:false.
  - UI không gửi `loai_xu_ly` trong scCreate (grep chỉ thấy display `sc/[id]`), nên siết schema AN TOÀN.
  - Đã sửa `packages/contract/src/schemas.ts`: `congviec.loai_xu_ly: z.enum(['thay_the','khac_phuc']).optional()` và thêm `vattu.loai_xu_ly` tương tự (đóng drift Zod↔DB).
  - Thêm contract regression: `scCreate` từ chối `loai_xu_ly:'sua_chinh'`, chấp nhận `'thay_the'`.
  - Payload heavy đổi thành `'thay_the'` → valid.
- Smoke HEAVY (4 VU/10s): 103 checks 100%, 0 lỗi, p95~91ms. Dọn 34 dòng `k6-load`/`k6-heavy`.
- Chạy: `node scripts/load-runner.mjs tests/load/cencom_load.js -s 10s:4 -e HEAVY=1` rồi `node scripts/clean-load.mjs`.

### #3 Mở rộng contract test thành provider-verify (kiểu Pact nhẹ) (ĐÃ XONG)
- Thêm describe `RPC contract — provider verify`: với mỗi `fn` có schema (consumer contract), assert core thực sự có handler wired (`core[fn]` flat hoặc `core[ns][fn]`). Bắt drift "schema ok nhưng không có handler".
- Không cần broker; nếu sau này muốn cross-service contract tự động, có thể nâng lên Pact thật.
- Kết quả: 78/78 contract tests pass (35 payload + drift 2 chiều + 5 regression Đợt 3 + 35 provider-verify + 2 drift loai_xu_ly).
- Lưu ý import trong test core: dùng `import * as core from '@cencom/core'` (core dùng `moduleResolution: nodenext`, relative import cần `.js` → self-package import giải qua exports, hợp lệ cả tsc & vitest).

### #4 Refactor flow test dùng helpers (ĐÃ XONG)
- `apps/web/e2e/helpers.ts`: sửa `ensureXe` detect đúng (`xeList` trả `result` là mảng trực tiếp, không bọc `{rows}`).
- `apps/web/e2e/flow.spec.ts`: SC test gọi `ensureXe(page.request, {bks: SEED_BKS})` trước flow — idempotent, giảm phụ thuộc vào seed state (thay vì click UI tạo xe).
- Kết quả: 11/11 E2E passed (29.3s).

### Trạng thái tổng (Đợt 4)
- core vitest: 237/237 (gồm contract 78). Root typecheck exit 0. E2E 11/11.
- Đóng drift Zod↔DB loai_xu_ly (tránh lọt payload sai vào DB qua đường khác).
- Tồn tại/thiếu: chưa thêm stress/spike profile vào k6 threshold thực tế (chỉ HEAVY=1 thủ công); chưa CI gate tự động chạy 3 lớp trên mỗi PR.

