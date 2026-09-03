# Plan_09 — Kiểm thử & Xuất báo cáo quy trình  ·  Chức năng: QA  ·  Xuyên suốt

## Ma trận kiểm thử
| Lớp | Công cụ | Mục tiêu |
|---|---|---|
| Unit (TDD) | vitest (`ledger.test.ts`) | cân bằng, reject lệch, tài khoản tồn tại, khóa kỳ, COGS 2 method |
| Contract | `contract.test.ts` | schema Zod + provider-verify (mỗi RPC có handler) |
| Conformance | `tests/conformance` | logic chi phí cũ (recalc, quyết toán) không đổi |
| E2E | Playwright | luồng "nhập kho → quyết toán → xem CĐKT" |
| Load | k6 | `ledgerPost` write (p95<800, error<5%) |

## Quy trình xuất báo cáo quy trình (file Excel)
- Mỗi báo cáo Excel có sheet "Quy trình" mô tả các bước thực hiện (VD: nhập kho → hệ thống post Nợ 152/Có 331 → kiểm tra 152≡tonKho).
- Sheet "Dữ liệu" chứa bảng; sheet "Đối chiếu" highlight chênh lệch (nếu có).

## Ngưỡng đạt
- Unit/Contract: 100% pass.
- E2E: 11+ (thêm 1 flow kế toán).
- k6: p95<800ms, 0% lỗi với 10 VU.
- `npm run typecheck` exit 0.
