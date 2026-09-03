# B4 — APP PROGRAM / UI

## Mục tiêu
Cập nhật chương trình APP sang mô hình "Nested Expandable List + Visual Status Pipeline".

## Phạm vi file sửa (CHỈ 1 file)
1. `06-app-program.md`

## Việc cần làm
- [ ] Mục 1: đổi "wizard 7 bước" → "Expandable Card List làm master; pipeline mini-graph trong card detail".
- [ ] Mục 2 (ánh xạ): giữ 9 bước nhưng đổi `khoa` → `khovattu`; bổ sung bước "Kiểm tra là điều kiện MỞ SC" (gate cứng).
- [ ] Mục 3: thêm "Kanban toggle nhẹ (4 cột: cho_kiem_tra / dang_sua / cho_thanhtoan / hoanthanh)" là view phụ.
- [ ] Mục 3: thêm "Timeline ngắn gọn trên card + Alert icon nếu thiếu HĐĐT hoặc chưa thu hồi VT cũ".
- [ ] Mục 4 (dashboards): đổi `Thủ kho` role thành `khovattu`; mô tả Xưởng chỉ Kiểm tra + Lập SC nhánh sửa tại xưởng, còn mua/xuất kho thuộc `khovattu`.
- [ ] Mục 4: thêm hàng "Tổ PTTB", "Lái xe" như đã định nghĩa.

## Tiêu chí xong
- Có nhắc "Expandable Card List", "pipeline mini-graph", "Kanban toggle", "Timeline", "Alert", `khovattu`.

## KHÔNG làm
- Không sửa 00/02/03/04/05/07.
