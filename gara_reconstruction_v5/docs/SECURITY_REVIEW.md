# SECURITY REVIEW — cencomOS Gara v5 (OWASP)

**Ngày:** 2026-08-21
**Phạm vi:** tầng API/RPC, auth, RBAC, input validation, logging, dependency
**Phương pháp:** đọc source `lib/rpc.ts`, `app/api/rpc/route.ts`, `lib/core/*`, `lib/perm.ts`, `lib/db.ts`; đối chiếu với `tests/conformance/security.test.ts` (28 test PASS) và `npm audit`.

## Tổng quan
Ứng dụng áp dụng các kiểm soát bảo mật cơ bản theo Chuẩn Gatekeeper (AGENTS.md): xác thực qua cookie `sid`, phân quyền RBAC, validation đầu vào bằng Zod, truy vấn tham số hóa (`pg` `$1`), soft-delete + audit log (`log_audit`). 28 test bảo mật conformance PASS → mức cơ bản an toàn cho môi trường nội bộ/intranet.

## Bảng findings

| STT | Vấn đề | OWASP | Mức độ | Vị trí | Trạng thái |
|-----|--------|-------|--------|--------|-----------|
| 1 | SQL Injection | A03 | LOW | `lib/db.ts` dùng `pg` parameterized `$1,$2` (không nối chuỗi) | ĐÃ ĐÚNG |
| 2 | XSS | A03 | LOW | Output React tự escape; in HTML A4 dùng template kiểm soát | ĐÃ ĐÚNG |
| 3 | CSRF | A01 | MED | `/api/rpc` chưa có CSRF token (dựa vào same-origin + cookie httpOnly) | ĐỀ XUẤT: thêm origin check / double-submit cookie nếu mở external |
| 4 | IDOR | A01 | MED | Handler sửa/xóa phải check quyền sở hữu (user A vs B) | ĐÃ CÓ perm check trong handler (`lib/perm.ts` + `lib/core/*`); cần bổ sung edge-case test |
| 5 | Auth / RBAC | A01/A05 | LOW | Check quyền nằm trong handler, không chỉ ẩn UI | ĐÃ ĐÚNG |
| 6 | Input validation | A03 | LOW | Zod schemas + manual trim/validate (`lib/contract`) | ĐÃ ĐÚNG |
| 7 | Secret hardcode | A02 | LOW | Dùng `.env.local`, `.gitignore` đã ignore `.env` | ĐÃ ĐÚNG |
| 8 | Logging | A09 | LOW | `log_audit` ghi hành động; lỗi ERROR có stack (`lib/observability.ts` từ WS5) | ĐÃ ĐÚNG (củng cố) |
| 9 | Next.js CVE (image optimizer / SSRF / ReDoS) | A06 | MED | Next 14.2.35 còn 2 high advisory, dọn sạch chỉ ở v16 | XEM `docs/SECURITY_NEXT16_RISK.md` (fallback: app nội bộ/intranet → rủi ro thấp) |
| 10 | Shell spawn deprecation (DEP0190) | A06 | LOW | `scripts/run-e2e.mjs` spawn với `shell: true` | ĐÃ SỬA (→ `shell: false`) tại WS orchestrator |

## Kết luận
App có mức bảo mật cơ bản an toàn cho môi trường nội bộ/intranet: không SQLi, không XSS do React escape, RBAC thực thi trong handler, input validated, secret không hardcode, audit log có. Các điểm còn lại (CSRF token, IDOR edge test, Next CVE) là đề xuất tăng cường, không phải lỗ hổng khai thác trực tiếp ở current scope.

## Đề xuất tiếp theo
- Thêm CSRF protection (origin check) cho `/api/rpc` nếu mở ra external network.
- Bổ sung edge-case test IDOR (user A gọi API resource của user B → 403).
- Theo dõi advisory Next.js; nâng v16 khi master đồng bộ đủ source + có thời gian migrate (xem `docs/SECURITY_NEXT16_RISK.md`).
- Đảm bảo `installGlobalErrorHandlers()` (từ `lib/observability.ts`) được gọi tại server startup để bắt `unhandledRejection`.
