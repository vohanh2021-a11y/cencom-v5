# plan_ketoan — Kế hoạch chi tiết module Kế toán VAS (cost-side, nội bộ)

> **Phiên bản mục tiêu:** v4.2.0 (module kế toán là subsystem lớn → bump 4.2).
> **Mô hình:** xe đầu kéo nội bộ → **chỉ chi phí**, KHÔNG doanh thu, KHÔNG công nợ phải thu khách, KHÔNG HĐĐT đầu ra.
> **Kế toán:** đầy đủ VAS (sổ cái kép, CoA, chứng từ, khóa kỳ, CĐKT, Báo cáo chi phí).
> **Thuế:** chỉ VAT đầu vào (133 được khấu trừ từ HĐĐT NCC).
> **COGS:** cấu hình 2 loại (`binh_quan` mặc định / `fifo` tùy chọn), mặc định **bình quân gia quyền** (hàng phụ tùng lẻ, ít mua lô).

## Cách đọc
- `read_*.md` = **bối cảnh / context** (AI hiểu nghiệp vụ, quy tắc, code hiện có).
- `Plan_*.md` = **bước thực hiện** (TDD, đầu vào/đầu ra, đối chiếu). Mỗi Plan có header `Chức năng | Giai đoạn | Đối chiếu`.
- Thực hiện theo **lộ trình GĐ1→GĐ4**, mỗi GĐ xong mới sang GĐ sau. Mỗi nhiệm vụ nhỏ = 1 `Plan_*`.

## Lộ trình
| GĐ | Nội dung | File Plan |
|---|---|---|
| GĐ1 | Schema CoA + sổ cái + ledgerPost + test | Plan_01,02,03 |
| GĐ2 | Tích hợp kho (nhập/xuất) + SC (quyết toán, khấu hao) post bút toán | Plan_04,05 |
| GĐ3 | Công nợ NCC + phiếu chi + VAT đầu vào | Plan_06,07 |
| GĐ4 | Báo cáo Excel (CĐKT, KQHĐKD chi phí, sổ 152/331) + khóa kỳ | Plan_08 |
| Xuyên suốt | Kiểm thử (unit/contract/conformance/E2E/k6) + đánh giá | Plan_09,10 |

## Ma trận đối chiếu nghiệp vụ ↔ kế toán
| Nghiệp vụ | Bút toán VAS | Module liên quan |
|---|---|---|
| Mua VT nhập kho | Nợ 152, 133 / Có 331 (hoặc 112) | **Mua + Kho + Thuế** |
| Xuất VT cho SC | Nợ 154 / Có 152 | **Kho + SC** |
| Nhân công (trong/ngoài) | Nợ 622 / Có 334 hoặc 331 | **Nhân công + Mua** |
| Quyết toán SC | Nợ 642 (thường) hoặc 241 (nâng cấp) / Có 154 | **SC/Asset** |
| Khấu hao xe | Nợ 627 / Có 214 | **SC/Asset** |
| Thanh toán NCC | Nợ 331 / Có 112 | **Mua (công nợ)** |
| Khóa kỳ | Nợ 911 / Có 642,627,622,621 | **Kế toán** |

> **Nguyên tắc vàng:** kế toán và kho phải "theo sát" → số dư 152 (ledger) phải khớp `kho.tonKho` (Σ ton×gia). Mọi bút toán sinh từ 1 `chung_tu` có `ref_type/ref_id` trỏ về nghiệp vụ gốc (truy xuất ngược).
