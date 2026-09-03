# ĐÁNH GIÁ TỔNG THỂ & CHẤM ĐIỂM CHẤT LƯỢNG — cencomOS_gara_4.0_supa

> **Phiên bản:** cencomOS gara 4.0 (bản cloud rewrite từ v3.6 Node/Express+SQLite)
> **Stack:** Next.js (App Router) + TypeScript strict + Tailwind (Vercel) + PostgreSQL + Realtime + Storage (Supabase); hỗ trợ on-premise (Docker+Nginx+SSL).
> **Ngày đánh giá:** 2026-08-16
> **Người đánh giá:** Người gác cổng (Gatekeeper / Build Agent)
> **Phương pháp:** Rà hiện trạng thực tế codebase + 3 lớp test đã chạy + so sánh đối thủ cùng loại (Vietnam + quốc tế) + chấm điểm theo 9 tiêu chí có trọng số.

---

## 1. TỔNG QUAN NHỮNG GÌ ĐÃ ĐẠT ĐƯỢC (thực tế, không "vibe")

| Hạng mục | Hiện trạng thực tế |
|---|---|
| **Module nghiệp vụ (core)** | 24 file module: `sc, kho, asset, de_xuat, chat, preview, nhac_han, perm, users, xe, baogia, khachhang, xuong, welcome, scoring, report, nhanKy, auth, search, cache, mailer, list, db, init` |
| **RPC (contract)** | 35 hàm (`RPC_SCHEMAS`) qua contract `POST /api/rpc {fn,args}` — giữ nguyên contract client cũ |
| **Phân vùng app (UI)** | 16 khu: `sc, kho, asset, de-xuat, chat, preview, nhac-han, perm, users, xe, baogia, khach-hang, dashboard, audit, thanhly, home` + `in/*` (in HTML A4) |
| **Bảo mật đầu vào** | Zod validate mọi đầu vào RPC; SQL parameterized `$1,$2`; RBAC kiểm tra trong handler; soft-delete; audit log (`log_audit`); không hardcode (`.env`) |
| **Kiểm thử (3 lớp + load)** | Unit **237/237** (vitest); Contract **78/78** (drift 2 chiều + regression + provider-verify kiểu Pact); E2E **11/11** (Playwright + video); k6 load **103/103 checks, 0 lỗi** (HEAVY write 4VU, p95~91ms) |
| **Realtime** | Supabase Realtime (đã bỏ polling 45s) |
| **DevOps** | On-premise: docker-compose + Dockerfile.standalone + nginx (WebSocket/SSL) + scripts init_db/backup/restore; cloud Vercel+Supabase; `.gitignore` an toàn |
| **Drift đã đóng** | `scCreate.congviec.loai_xu_ly` siết thành enum `{thay_the,khac_phuc}` khớp DB CHECK (phát hiện qua load test HEAVY) |
| **Tài liệu** | AGENTS.md (global+project), PLAN_14.08_supa (501 dòng), Architect, MASTER_PLAN, changelog, docs/rewrite, skill `simulation-testing` đã đăng ký global |

---

## 2. SO SÁNH VỚI PHẦN MỀM CÙNG LOẠI

### 2.1 Đối thủ quốc tế (heavy-duty / cloud / realtime)
| Phần mềm | Điểm mạnh | Điểm yếu | Giá (2026) |
|---|---|---|---|
| **Fullbay** | Thiết kế riêng xe tải nặng / rơ-moóc; RO gắn vật tư; lịch sử tài sản; cloud | Chỉ HD (không light-duty); phí theo user cao; UI trái chiều; báo cáo thiếu linh hoạt | $188–318/tháng + $89–119/user/tháng, cam kết năm |
| **Shopmonkey** | Light+Heavy 1 nền tảng; 9000+ xưởng; 35+ báo cáo; multi-shop HQ; DVI; SMS | Đóng gói SaaS, ít tùy biến sâu; giá theo gói | Published, tiered |
| **Shop-Ware / Tekmetric** | Workflow nhanh, DVI ảnh/video, khách hàng realtime | Thiết lập quy tắc nặng; báo cáo cần cấu hình | Quote-based |

### 2.2 Đối thủ Việt Nam
| Phần mềm | Điểm mạnh | Điểm yếu |
|---|---|---|
| **VC Garage 4.0** | AI, hóa đơn điện tử, Zalo OA, marketing tự động, nhắc lịch bảo dưỡng | SaaS đóng, phụ thuộc nhà cung cấp; tùy biến sâu hạn chế |
| **Carsoft (AIT)** | "All-in-one", kế toán, báo cáo; triển khai nhiều gara | Legacy (SQL Server + C#/VB.NET), khó mở rộng, chi phí tùy biến cao |
| **Odoo Garage / MISA AMIS / KiotViet** | ERP tích hợp, hóa đơn ĐT, eco lớn | Chưa tối ưu tiếng Việt (Odoo); không chuyên sâu sửa chữa xe tải đầu kéo |

### 2.3 Vị thế của cencomOS_gara_4.0_supa
- **Mạnh hơn đối thủ VN legacy**: kiến trúc cloud-native, realtime, mã nguồn kiểm soát được, on-prem/cloud swap không đổi core — khác biệt so với Carsoft (desktop cũ) hay SaaS đóng (VC/Fullbay).
- **Mạnh hơn SaaS quốc tế về tùy biến & chi phí**: không phí theo user, không cam kết năm, có thể tự host on-premise (phù hợp xe đầu kéo nội địa / bảo mật nội bộ).
- **Yếu hơn về hoàn thiện thương mại**: kế toán cost-side ĐÃ CÓ (asset/kho/sc) nhưng **chưa đầy đủ VAS** (thiếu sổ cái kép, công nợ NCC, VAT đầu vào, CĐKT), thiếu **hóa đơn điện tử tử** (đối thủ VN bắt buộc có), thiếu **parity test** chứng minh "giữ 100% logic v3.6", và chưa có **CI gate** / **conformance**. (Lưu ý: `tk` bị loại bỏ là "Thăm khám sửa chữa", không phải kế toán.)

---

## 3. TIÊU CHÍ ĐÁNH GIÁ CHI TIẾT & CHẤM ĐIỂM (thang 0–10)

| # | Tiêu chí | Trọng số | Điểm | Điểm có trọng số | Bằng chứng / Khoảng trống |
|---|---|---:|---:|---:|---|
| 1 | **Bảo mật (OWASP, auth, RBAC, input)** | 15% | 8 | 1.20 | + Zod + param SQL + RBAC in-handler + audit + soft-delete. − `SECURE_COOKIE=0` (localhost), chưa rate-limit/brute-force, CSRF dựa "không gửi Origin" (không token), chưa HSTS mặc định |
| 2 | **Kiến trúc & khả năng mở rộng** | 12% | 9 | 1.08 | + modular (core/db/contract/web), tách route-logic-repo, RPC dispatch, on-prem/cloud swap, TS strict, rewrite-readiness. − rà SOLID/handler phình |
| 3 | **Chịu tải & hiệu năng** | 12% | 7 | 0.84 | + async kỷ luật, k6 p95~65ms (read), ~91ms (HEAVY write). − chưa stress/spike, chưa xác nhận PG pool max:10 dưới tải, chưa audit N+1, chưa có Redis cache |
| 4 | **Tính năng nghiệp vụ & độ phủ** | 15% | 7 | 1.05 | + 24 module, 35 RPC, 16 UI, quy trình xe đầu kéo đầy đủ. − **tk (= Thăm khám sửa chữa) bị loại bỏ, thay bằng DeXuat** (KHÔNG phải kế toán — kế toán vẫn còn ở asset/kho/sc), **AI-OCR bỏ**, **conformance parity chưa có** (claim "100% logic v3.6" chưa chứng minh), roadmap 10 GD chưa rõ tiến độ |
| 5 | **Chất lượng kiểm thử & quan sát** | 13% | 7 | 0.91 | + 237 unit + 78 contract + 11 E2E + k6; audit log. − **conformance parity thiếu**, **chưa CI gate**, chưa metrics/tracing (Prometheus) |
| 6 | **Realtime & UX** | 10% | 7 | 0.70 | + Supabase Realtime, Tailwind responsive, video demo. − E2E chỉ smoke, chưa a11y/responsive test, chưa đo UX thực tế |
| 7 | **Triển khai & DevOps** | 8% | 7 | 0.56 | + on-prem docker/nginx/SSL, scripts backup/restore, .gitignore. − chưa CI/CD, chưa auto migrate/rollback, chưa IaC |
| 8 | **Toàn vẹn dữ liệu & tuân thủ** | 8% | 8 | 0.64 | + soft-delete, audit, transaction (claim), migrator, domain tách. − chưa xác nhận mọi write có transaction, chưa backup-verify, **thiếu hóa đơn điện tử VAT** (đối thủ VN có) |
| 9 | **Tài liệu & bảo trì** | 7% | 9 | 0.63 | + AGENTS, PLAN, Architect, MASTER_PLAN, changelog, rewrite docs, skill. − một số docs chưa đồng bộ code (conformance chưa làm) |
| | **TỔNG** | **100%** | | **7.61 / 10 → 76.1 / 100** | |

**Xếp hạng:** **B+ (Khá tốt)** — nền tảng kỹ thuật vững, quy trình kiểm thử 3 lớp + load đã thiết lập; còn thiếu gate CI, conformance parity, và module kế toán/hóa đơn để thành sản phẩm thương mại hoàn chỉnh.

---

## 4. RỦI RO CAO & KHUYẾN NGHỊ ƯU TIÊN (để lên 90+)

1. **[Cao] Thiếu conformance parity (≥320 test từ v3.6).** Claim "giữ 100% logic" chưa được test chứng minh → nguy cơ hồi quy nghiệp vụ khi port. → Làm ngay `tests/conformance` theo MASTER_PLAN.
2. **[Cao] Chưa có CI gate.** 3 lớp test chạy tay → dễ lọt regression. → Thêm GitHub Actions/on-prem runner: contract+vitest (bắt buộc), k6 (PR lớn), Playwright (đêm).
3. **[Cao] Kế toán chưa đầy đủ VAS.** Cost-side ĐÃ CÓ (asset/kho/sc) nhưng thiếu sổ cái kép, công nợ NCC, VAT đầu vào, báo cáo CĐKT. → Đang bổ sung (xem `plan_ketoan/`, mục tiêu v4.2.0). Lưu ý: `tk` bị loại bỏ là "Thăm khám sửa chữa" (không phải kế toán).
4. **[Trung bình] Thiếu hóa đơn điện tử (VAT).** Bắt buộc tại VN, đối thủ đều có. → Tích hợp nhà cung cấp HĐĐT hoặc xuất qua core.
5. **[Trung bình] Bảo mật bề mặt:** thêm rate-limit/brute-force, CSRF token thực, HSTS, scan drift enum/CHECK DB còn lại (ngoài `loai_xu_ly`).
6. **[Trung bình] Chịu tải:** chạy stress/spike k6, xác nhận PG pool, audit N+1, thêm Redis cache cho read-heavy.
7. **[Thấp] Observability:** structured logging + metrics (Prometheus) + tracing cho multi-user.

---

## 5. LỘ TRÌNH NÂNG HẠNG (từ 76 → 90+)

| Giai đoạn | Việc | Kỳ vọng điểm |
|---|---|---|
| Ngắn hạn (1–2 tuần) | Conformance parity + CI gate + scan drift enum/CHECK còn lại | +6–8 → ~84 |
| Trung hạn (1–2 tháng) | Tái tích hợp kế toán (hoặc API MISA) + HĐĐT + stress/spike + CSRF/rate-limit | +6–8 → ~90 |
| Dài hạn | Observability (metrics/tracing) + UX test + multi-tenant SaaS hóa | 90–95 |

---

*Đánh giá này là "phần chấm điểm cho chất lượng phiên bản" — dùng làm baseline so sánh qua các đợt phát hành tiếp theo. Mọi điểm số dựa trên hiện trạng rà thực tế tại ngày đánh giá; cần cập nhật khi conformance/CI hoàn thành.*
