# EULA — CencomOS Gara (Hệ thống quản lý xưởng gara)

**Phiên bản tài liệu:** 1.0 (draft 07/09/2026) · **Đơn vị cấp phép:** Cencom

## Điều 1 — Đối tượng
Phần mềm CencomOS Gara gồm: ứng dụng server (Next.js + PostgreSQL), ứng dụng
desktop Hub (Electron, chứa PostgreSQL portable), ứng dụng desktop Spoke (thin
client), MCP server, cùng tài liệu đi kèm.

## Điều 2 — Cấp phép
1. Cencom cấp quyền **sử dụng nội bộ** cho số lượng HUB/Spoke/địa điểm theo hợp đồng.
2. Mỗi bản cài phải dùng SESSION_SECRET/MCP_API_KEY riêng do Cencom cấp hoặc
   khách hàng tự sinh và chịu trách nhiệm bảo quản.
3. Không được: cho thuê, cho mượn, chia sẻ installer ra ngoài tổ chức, dịch
   ngược (trừ giới hạn theo luật hiện hành), tách module để dùng độc lập.

## Điều 3 — Dữ liệu & bảo mật
1. Khách hàng chịu trách nhiệm sao lưu định kỳ (tính năng Backup trong app +
   cron). Cencom hỗ trợ khôi phục theo SLA hợp đồng bảo trì.
2. Khách hàng chịu trách nhiệm quản lý tài khoản: đổi mật khẩu mặc định ngay
   khi nhận bàn giao, không chia sẻ tài khoản giữa nhiều người.

## Điều 4 — Cập nhật & hỗ trợ
1. Cập nhật được phát hành theo tag `vX.Y.Z`; quy trình update và rollback theo
   tài liệu triển khai. Trước mỗi update bắt buộc có backup (Iron Law).
2. Hỗ trợ kỹ thuật qua kênh trong hợp đồng bảo trì.

## Điều 5 — Giới hạn trách nhiệm
Trong phạm vi tối đa cho phép bởi pháp luật, Cencom không chịu trách nhiệm với
thiệt hại gián tiếp (mất lợi nhuận, gián đoạn kinh doanh) phát sinh từ việc sử
dụng phần mềm.

## Điều 6 — Chấm dứt
Giấy phép chấm dứt khi khách hàng vi phạm điều khoản. Sau chấm dứt, gỡ bỏ toàn
bộ bản cài và trả lại/hibernate dữ liệu theo thỏa thuận.

## Điều 7 — Pháp lý khác
Tranh chấp giải quyết theo pháp luật Việt Nam tại Tòa án có thẩm quyền nơi
Cencom đặt trụ sở.

---
*Draft nội bộ — cần luật sư duyệt trước khi đưa vào installer thương mại.
Kèm theo: `LICENSE` (bản quyền phần mềm), danh mục thư viện mã nguồn mở trong
`package.json` (nghĩa vụ notice của các license MIT/Apache/BSD).*
