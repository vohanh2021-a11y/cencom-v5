# MASTER PLAN — cencomOS_gara_4.0_supa (bản rút gọn)

> Bản chi tiết đầy đủ: `PLAN_14.08_supa.md` (cùng thư mục). Kiến trúc: `docs/Architect.md`.
> Mục tiêu: cloud-first (Vercel + Supabase), giữ 100% logic nghiệp vụ, bỏ rác, giải nút thắt, thương mại hoá.

## Các quyết định chốt (tóm tắt)

1. Dự án mới `E:\APP-LAPTOP-SYNC\cencomOS_gara_4.0_supa\` — ngoài thư mục v3.6, git riêng, không đụng hệ thống cũ.
2. Next.js + TS + Tailwind (Vercel) + PostgreSQL + Realtime + Storage (Supabase).
3. Custom auth (users/scrypt/session/must_change/CBAC) trên PG.
4. Gói Free khi bắt đầu; subdomain `.vercel.app`.
5. **BỎ**: ảnh báo giá + AI-OCR (chỉ nhập tay); GAS; Electron desktop; docx (in HTML A4).
6. **GIỮ**: Preview vai trò; CencomBot; contract `POST /api/rpc` bất biến; 327 test làm conformance.
7. Ảnh chat/TK: file tạm Storage TTL 1 ngày, người nhận tải về máy.
8. Multi-tenant sẵn sàng (tenant_id + RLS); vận hành 1 đơn vị trước.

## Lộ trình giai đoạn

| GĐ | Nội dung | Deliverable | Trạng thái |
|---|---|---|---|
| 0 | Scaffold repo + docs (Architect, MASTER_PLAN, CHANGELOG, PLAN_14.08_supa, AGENTS, .gitignore) | Nền tảng | ✅ 2026-08-14 |
| 1 | **Schema PG + migrations + migrator SQLite→PG + seed (42 xe/97 mục)** | DB cloud chạy | ⏳ KẾ TIẾP |
| 2 | Core port TS (`db/auth/perm/scoring/sc/kho/chat/tk/xuong/asset/baogia/nhanKy/welcome/report/preview`) | Logic giữ 100% | ⏳ |
| 3 | API layer: `/api/rpc` + middleware auth/CBAC/CSRF + export stream + in HTML + chat-file | Contract bất biến | ⏳ |
| 4 | Realtime + Storage (TTL 1 ngày, download) | Hết polling 45s | ⏳ |
| 5 | UI toàn bộ màn hình (PC/tablet/ĐT, 3 theme) | UI v4 | ⏳ |
| 6 | Performance: pagination, index, materialized view, cache, export job | Hết nút thắt | ⏳ |
| 7 | Backup 7 ngày + Archive chứng từ + partition | Thoả yêu cầu | ⏳ |
| 8 | Conformance 327 test trên v4 (≥320 pass) + E2E | Parity | ⏳ |
| 9 | Deploy Vercel + Supabase + CI/CD + hardening | Chạy cloud | ⏳ |
| 10 | Multi-tenant RLS + bàn giao (docs 2 nơi, tag v4.0.0) | Thương mại hoá | ⏳ |

## Tiêu chí hoàn thành mỗi GĐ

- `tsc --noEmit` sạch; `tests/conformance` xanh; docs cập nhật; bàn giao kèm Production Check.
- GĐ1: `SELECT COUNT(*) FROM xe` = 42, `bieu_ma` = 97; login seed OK; migrator đối chiếu số dòng từng bảng trước/after.

## Lệnh tham chiếu

```bash
cd cencomOS_gara_4.0_supa
# GĐ1: npx supabase init; supabase db push; npm run seed
# Test: cd tests/conformance && npm test
# Dev: cd apps/web && npm run dev
```

## Tài liệu nguồn (đọc khi cần)

- `PLAN_14.08_supa.md` (chi tiết đầy đủ — mọi quyết định, schema, RPC, test).
- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\docs\rewrite\01-04,07` (SPEC gốc).
- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\server\*.js` (mã nguồn port).
- `E:\APP-LAPTOP-SYNC\CencomOS-Garage-v3.6\shared\data\seed_xe.json`, `seed_biemau.json` (seed).