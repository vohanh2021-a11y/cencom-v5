# Plan_10 — Đánh giá toàn diện & Bàn giao  ·  Chức năng: Đánh giá  ·  Cuối

## Checklist bàn giao
- [ ] `plan_ketoan/` đầy đủ 16 file.
- [ ] Schema áp dụng live DB (54322) + seed CoA.
- [ ] `ledgerPost` + tích hợp kho/SC hoạt động.
- [ ] Công nợ NCC + VAT đầu vào + báo cáo Excel.
- [ ] Khóa kỳ + đối chiếu 152≡tonKho, 331≡cong_no.
- [ ] Tests: unit/contract/conformance/E2E/k6 xanh.
- [ ] `npm run typecheck` exit 0.
- [ ] Cập nhật `docs/QUALITY_SCORE_v4.0.md` (sửa nhãn tk≠kế toán, cộng điểm kế toán).

## Đánh giá lại (rubric QUALITY_SCORE)
- **Tính năng nghiệp vụ & độ phủ:** +2 (có VAS ledger, công nợ, thuế) → ~9/10.
- **Chất lượng kiểm thử:** +2 (có conformance + CI gate nếu làm) → ~9/10.
- **Toàn vẹn & tuân thủ:** +1 (VAT đầu vào, khóa kỳ) → ~9/10.
- **Tổng kỳ vọng:** ~88–92/100 (lên hạng A).

## Chốt phiên bản
- **v4.2.0** (module kế toán là subsystem lớn, đủ tiêu chí bump 4.2).
- Ghi `changelog_ketoan_v4.2.0.md` mô tả: scope, định khoản, COGS method, cách chạy test, rủi ro.
