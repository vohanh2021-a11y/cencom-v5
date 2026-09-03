# Plan_03 — Handler `ledgerPost` (ghi sổ kép)  ·  Chức năng: Ghi sổ  ·  GĐ1

**Đầu vào:** `arg = { so_ct, ngay(YYYY-MM-DD), loai_ct, nguoi?, ref_type?, ref_id?, note?, entries:[{tai_khoan, du_no?, du_co?}] }`.
**Đầu ra:** `{ ok, ct_id }` hoặc `{ ok:false, error }`.

## Các bước (TDD — RED trước)
1. **Test trước (RED):** viết `ledger.test.ts`:
   - Trường hợp hợp lệ: entries `[{tk:'152', du_no:100},{tk:'331', du_co:100}]` → `ok:true`, có 1 `chung_tu` + 2 `ledger`, tổng Nợ=Có.
   - Trường hợp lệch: `[{152,100},{331,90}]` → `ok:false` (không ghi row nào).
   - Tài khoản không tồn tại → `ok:false`.
   - Ngày nằm trong kỳ `da_dong` → `ok:false`.
2. **Implement (GREEN)** trong `packages/core/src/ledger.ts`:
   - `checkLock(api,'ke_toan','tao')`.
   - Validate: entries.length≥2; mỗi entry đúng 1 side>0; `round(sum du_no,2)===round(sum du_co,2)`.
   - Tồn tại mọi `tai_khoan` trong `tai_khoan` (not deleted).
   - Nếu `ngay` trong kỳ `da_dong` → reject.
   - `db.transaction(async tx => { ctId=await tx.nextId('CT'); insert chung_tu; for entry insert ledger (nextId 'LT'); tx.audit('ke_toan','chung_tu',ctId, meId, ...) })`.
3. Thêm schema Zod (`ledgerPost`) vào `packages/contract/src/schemas.ts` + `RPC_SCHEMAS`.
4. Đăng ký `RPC_META['ledgerPost']=['ke_toan','tao']`, `ledgerList` xem.
5. Export `export * as ledger from './ledger.js'` trong `index.ts`.
6. Thêm `ke_toan` vào `perm.MODULES` + `MATRIX` (ketoan: xem,tao,duy,quyet; quanly/giamdoc: xem,tao,quyet).
7. Chạy: typecheck + `npx vitest run ledger`.

**Đối chiếu:** `ledger.ref_type/ref_id` = nghiệp vụ gốc (nhập/xuất/quyết toán). Đây là "cầu nối" mà GĐ2 sẽ gọi.
**Rủi ro:** làm tròn `NUMERIC` → so sánh cân bằng dùng `Math.abs(sumNo-sumCo) < 0.005`.
