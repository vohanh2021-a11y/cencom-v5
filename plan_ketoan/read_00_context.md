# read_00 — Bối cảnh & quyết định scope

## 1. Sửa hiểu lầm quan trọng
- `tk` trong mã nguồn = **"Thăm khám sửa chữa"** (từ lái xe), KHÔNG phải "kế toán". `migrate-tk-removal.ts` loại bỏ module thăm khám → thay bằng **DeXuat**.
- **Kế toán/tài chính KHÔNG bị xoá** — nó nằm ở `asset.ts` (quyết toán, GTTV, khấu hao), `kho.ts` (nhập/xuất/tồn), `sc.ts` (tổng chi phí), `report.ts`.
- Tài liệu `docs/QUALITY_SCORE_v4.0.md` cũ ghi nhầm "tk = kế toán bị loại bỏ" → **đã sửa** thành "tk = thăm khám bị loại bỏ; kế toán (cost) vẫn còn, đang bổ sung thành VAS đầy đủ".

## 2. Quyết định đã chốt (từ người dùng)
1. **Mô hình:** xe đầu kéo nội bộ → chỉ chi phí. KHÔNG doanh thu, KHÔNG AR, KHÔNG HĐĐT đầu ra.
2. **Mức độ:** Kế toán **đầy đủ VAS** (sổ cái kép, hệ thống tài khoản, chứng từ, khóa kỳ, CĐKT, Báo cáo chi phí).
3. **Thuế:** chỉ **VAT đầu vào** (133 được khấu trừ từ HĐĐT NCC).
4. **COGS:** cấu hình 2 loại, mặc định **bình quân gia quyền** (hàng phụ tùng lẻ, mua theo lô hiếm). Kế toán chủ động đổi sau qua `ke_toan_setting.cogs_method`.

## 3. Ranh giới (không làm)
- Không làm doanh thu bán dịch vụ, không HĐĐT đầu ra, không công nợ khách (AR).
- Không viết lại logic nghiệp vụ cũ (port nguyên v3.6 theo `docs/rewrite/02_BUSINESS_RULES.md`).
- Không hardcode secret; không bỏ contract RPC;SQL parameterized; audit + soft-delete + tenant_id.

## 4. Thuật ngữ
- **Chứng từ (`chung_tu`):** bằng chứng nghiệp vụ kế toán (hóa đơn, phiếu nhập, phiếu xuất, quyết toán...).
- **Bút toán (`ledger`):** 1 dòng Nợ hoặc Có vào 1 tài khoản, thuộc 1 chứng từ.
- **Cân bằng:** mọi chứng từ có `Σ Nợ = Σ Có`.
- **Kỳ kế toán (`ky_ke_toan`):** khoảng thời gian (tháng/quý) để lập báo cáo; đóng kỳ để khóa số liệu.
