# tests/conformance — Conformance Suite Quy chế 206/QC.CT

Bộ kiểm thử tuân thủ Quy chế 206 được chạy như một phần của bộ test core
(`npm test --workspace @cencom/core`, vitest + pglite in-memory). Không tách
thành một project riêng để tránh trùng lặp harness và dễ hồi quy.

## Cách chạy
```bash
npm test --workspace @cencom/core
```
Kết quả mục tiêu: **335+ passed** (bao gồm conformance-qc206.test.ts).

## Ánh xạ clause → test file

| Giai đoạn / Clause | File test | Nội dung chính |
|---|---|---|
| G1 — RBAC role pttb/laixe/khovattu | `perm.test.ts`, `conformance-qc206.test.ts` | role mới, canApproveSC/Mua nhận pttb |
| G2 — P2.2a chặn TT thiếu HĐĐT | `ketoan-gd3.test.ts`, `conformance-qc206.test.ts` | gate `phieuChiCreate` + `congNoChuaCoHoaDon` |
| G3 — P2.2b thu hồi VT cũ + `cp_ve_phuphi` | `p2-thuhoi.test.ts`, `ketoan-gd3.test.ts` | `genCuHongInTx` trong `scNghiem`, hạch toán gộp 642 |
| G4 — Mẫu 2/7/8 | `sc-gd6-mau.test.ts`, `conformance-qc206.test.ts` | `scMau2/7/8` đúng cấu trúc |
| G5 — Dashboard + tiến trình 8 bước | `sc-gd5.test.ts`, `conformance-qc206.test.ts` | `scDashboard` báo vi phạm, `scTienTrinh` 8 bước |
| G7 — Hồ sơ 9 tab xlsx | `report-gd7.test.ts`, `conformance-qc206.test.ts` | `scHoSoXlsx` 9 worksheet |
| G7 — UI (pipeline, in-Mẫu, export) | (manual UAT) | `StatusPipeline`, `ScHoSoPanel`, route `/api/in/sc/[id]/[mau]` + `/api/export/sc-hoso/[id]` |

## Ghi chú
- `tests/conformance` thư mục này chỉ chứa tài liệu; code test nằm trong `packages/core/tests/`.
- UAT trình duyệt (Playwright) và `tests/conformance` ≥320 case tự động chưa có môi trường chạy tại đây.
