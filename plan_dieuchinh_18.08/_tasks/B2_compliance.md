# B2 — COMPLIANCE & KẾ TOÁN

## Mục tiêu
Cập nhật logic tuân thủ theo 6+3 câu trả lời thực tế: chi phí nhánh 4, gộp 642, hoãn tạm ứng.

## Phạm vi file sửa (CHỈ 2 file)
1. `04-compliance-p2-p3.md` (mục A)
2. `03-audit-8-mau.md` (phần xuất file)

## Việc cần làm
- [ ] `04` mục A.1: ghi chú `cp_ve_phuphi` (numeric) trên `phieu_chi`, áp dụng nhánh 4 (vé ô tô dịch vụ gửi, phụ phí).
- [ ] `04` mục A.2: thêm quy tắc "Chi phí không sổ sách (vé/gửi/tiền mặt) → Nợ 642 / Có 112 (TM) hoặc /Có 331, ghi `co_vat=false, loai_chung_tu='khac'`". Có HĐĐT → Nợ 138 / Có 331.
- [ ] `04` mục A.3: ghi chú "Tam ứng tiền mặt → HOÃN giai đoạn 2; giai đoạn build hiện tại dùng drop-list `hinh_thuc=ghi_no`".
- [ ] `03` phần cuối: thêm "Xuất file: ưu tiên xlsx 9 tab (01_KiemTra…09_CongTy); PDF dự phòng A5 (ngắn) / A4 (dài)".

## Tiêu chí xong
- Có nhắc `cp_ve_phuphi`, gộp 642, hoãn tạm ứng, xlsx 9 tab.

## KHÔNG làm
- Không sửa 00/02/05/06/07.
