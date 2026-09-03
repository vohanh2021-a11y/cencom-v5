# read_02 — Hiện trạng code & khoảng trống

## 1. Những gì ĐÃ CÓ (port nguyên v3.6, giữ parity)
| File | Hàm/Tính năng | Liên quan kế toán |
|---|---|---|
| `asset.ts` | `quyetToan` | Ghi `lich_sua` (sổ quyết toán 1 dòng/RO), chuyển `da_quyet` |
| `asset.ts` | `khauHao`, `chiTichLuy`, `assetXe`, `assetReport` | GTTV = nguyên giá − khấu hao + chi phí tích lũy |
| `asset.ts` | `ncNgoaiReport` | Chi phí nhân công ngoài theo đơn vị |
| `sc.ts` | `recalc`, `scNghiem` | Tổng chi phí `phieu_sua.tong*`, `bien_ban_nghiem` |
| `kho.ts` | `phNhapCreate`, `phXuatCreate`, `tonKho` | Nhập/xuất/tồn, `giaTriTonKho=Σton×gia` |
| `de_xuat.ts` | tạo phiếu SC | (thay TK) |

## 2. Bảng hiện có (schema.sql)
`phieu_sua(tong_cong,tong_vt)`, `sc_congviec(don_gia,thanh)`, `sc_vattu(gd_dk,gd_tt,thanh)`, `lich_sua(tong_cong,tong_vt,tong)`, `de_nghi_mua(tong)`, `dm_mua_ct`, `phieu_nhap(tong)`, `phieu_nhap_ct(dgia,thanh)`, `phieu_xuat_ct(dgia,thanh)`, `vattu(gia,ton)`, `xe(nguyen_gia)`, `khach_hang(không có công nợ)`, `bao_gia_ncc(không có bảng chi tiết)`, `log_audit`, `config`, `phan_quyen`.

## 3. KHOẢNG TRỐNG (sẽ xây — GĐ1..4)
1. **Sổ cái kép** (`ledger` + `chung_tu`) — CHƯA CÓ.
2. **Hệ thống tài khoản** (`tai_khoan`) — CHƯA CÓ.
3. **Công nợ phải trả NCC** (`cong_no` loại `phai_tra`) + tuổi nợ + phiếu chi — CHƯA CÓ.
4. **Thuế VAT đầu vào** (`vat_invoice` + 133) — CHƯA CÓ.
5. **COGS chuẩn:** xuất kho hiện lấy `vattu.gia` (giá hiện tại) → sai lệch; cần bình quân/FIFO — CHƯA CÓ.
6. **Khóa kỳ** (`ky_ke_toan`) + Báo cáo CĐKT/KQHĐKD — CHƯA CÓ.
7. **Kiểu tiền `REAL`→`NUMERIC`** cho bảng mới.

## 4. Quy ước code (phải tuân thủ)
- Handler: `export async function foo(api: LedgerApi, arg) {...}`; `api = {db, auth, perm}`.
- Mọi ghi: `await db.transaction(async (tx) => { tx.run(...); tx.audit(...); })`; id qua `tx.nextId('CT')`.
- Validate đầu vào: Zod trong `packages/contract/src/schemas.ts`, đăng ký `RPC_SCHEMAS`.
- Phân quyền: `RPC_META[fn]=['ke_toan',feat]`; role `ketoan` có sẵn trong MATRIX.
- Contract test `contract.test.ts` yêu cầu MỖI `RPC_SCHEMAS` key có handler (`hasHandler`) → RPC mới PHẢI có cả schema + handler + meta.
