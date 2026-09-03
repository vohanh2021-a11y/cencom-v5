# 07 — ACTION PLAN (CHI TIẾT, STEP-BY-STEP, CÓ GIÁM SÁT)

> **QUY TẮC VÀNG:** Mọi bước BUILD chỉ được thực thi SAU KHI user duyệt plan này.
> Mỗi bước có "Tiêu chí giám sát" (Done when) — bước hoàn thành chỉ khi thỏa mãn tiêu chí + chạy test.

## KÝ HIỆU TRẠNG THÁI
- ✅ HOÀN THÀNH (đã làm trong plan này)
- 🔲 CHỜ DUYỆT (có kế hoạch, chưa build)
- 🔧 BUILD (sẽ code sau duyệt)

---

## GIAI ĐOẠN 0 — CHUẨN BỊ TÀI LIỆU (✅ HOÀN THÀNH)
| ID | Bước | Đầu ra | Giám sát | Thực hiện |
|---|---|---|---|---|
| G0.1 | Copy văn bản gốc QC206 vào repo | `docs/QC206_quy_che.md` | File tồn tại, UTF-8 đọc được | AI |
| G0.2 | Viết bản AI dịch QC206 | `01-QC206-AI.md` | Có ánh xạ vai trò ↔ role | AI |
| G0.3 | Ma trận traceability | `02-traceability.md` | 25+ dòng đối chiếu có trạng thái | AI |
| G0.4 | Audit 8 mẫu hồ sơ | `03-audit-8-mau.md` | Kết luận rõ mẫu 6 & 8 thiếu | AI |
| G0.5 | Compliance P2/P3 + RBAC | `04-compliance-p2-p3.md` | Có pseudocode + ma trận role mới | AI |
| G0.6 | Flowchart | `05-flowchart.md` | 4 diagram Mermaid hợp lệ | AI |
| G0.7 | Chương trình APP | `06-app-program.md` | Ánh xạ 9 bước → thao tác | AI |

---

## GIAI ĐOẠN 1 — RBAC: BỔ SUNG ROLE PTTB & LAIXE 🔲 CHỜ DUYỆT → 🔧 BUILD
| ID | Bước | Đầu ra | Giám sát (Done when) | Rủi ro |
|---|---|---|---|---|
| G1.1 | Thêm `pttb`,`laixe` vào `ROLES` (perm.ts:10) + `ROLES_LOCAL` (auth.ts:180) | Code | Build pass, role hợp lệ | Sai拼写 ảnh hưởng login |
| G1.2 | Thêm `pttb`/`laixe` vào `MATRIX` (perm.ts:15) theo §C.3 file 04 | Code | `reseed-perms.ts` seed đúng | Quên quyền → user kẹt |
| G1.3 | Sửa `canApproveMua`/`canApproveSC` nhận `pttb` | Code | Unit test覆盖 | Ghi đè ngưỡng |
| G1.4 | Gộp `preview.ts PREVIEW_ROLES` dùng `ROLES` thật | Code | Preview vẫn chạy | — |
| G1.5 | Test `perm.test.ts` cho `pttb`,`laixe` | Test | Pass | — |
| G1.6 | UI `/perm`, `/users` hiển thị 2 role | UI | Tạo user role mới OK | — |

## GIAI ĐOẠN 2 — COMPLIANCE P2.2a: CHẶN TT THIẾU HĐĐT 🔲 CHỜ DUYỆT → 🔧 BUILD
| ID | Bước | Đầu ra | Giám sát | Rủi ro |
|---|---|---|---|---|
| G2.1 | Sửa `phieuChiCreate` check `vat_invoice` theo `ref_phieu_nhap` | Code (ketoan.ts) | Trả lỗi rõ khi thiếu HĐĐT | Block nhầm chi nội bộ → cần phân biệt ref_type |
| G2.2 | RPC `congNoChuaCoHoaDon` + UI filter `/ke-toan/cong-no` | Code+UI | Báo cáo hiện đúng | — |
| G2.3 | Test `ketoan-gd3` bổ sung (thiếu HĐĐT → chặn) | Test | Pass | — |

## GIAI ĐOẠN 3 — COMPLIANCE P2.2b: BẮT BUỘC THU HỒI VT CŨ 🔲 CHỜ DUYỆT → 🔧 BUILD
| ID | Bước | Đầu ra | Giám sát | Rủi ro |
|---|---|---|---|---|
| G3.0 | Thêm cột `cp_ve_phuphi` (numeric) vào `phieu_chi` + hạch toán gộp 642 (nhánh 4, 3b) | Schema+Code | Cột tồn tại, gộp đúng `co_vat`/`loai_chung_tu` | Sai bút toán |
| G3.1 | Xác nhận/thêm cột `sc_vattu.la_thay_the` + migration | Schema | Cột tồn tại | Mất data cũ |
| G3.2 | Gọi `autoGenCuHong` BÊN TRONG `quyetToan`/`scFinish` (transaction) | Code (ketoan/asset) | Tự sinh PXN cu_hong | Nested tx |
| G3.3 | Gate `scNghiem` chặn nếu SC có thay thế chưa thu hồi cũ | Code (sc.ts) | Trả lỗi rõ | False-block SC cũ |
| G3.4 | UI `/kho/nhap` option `loai_nhap=cu_hong` + `ref_sc` (Mẫu 6) | UI | Thủ kho nhập được | — |
| G3.5 | Test `kho.test.ts`/`asset.test.ts` cover | Test | Pass | — |

## GIAI ĐOẠN 4 — MẪU 7 & 8 (IN BIÊN BẢN / BẢNG KÊ) 🔲 CHỜ DUYỆT → 🔧 BUILD
| ID | Bước | Đầu ra | Giám sát | Rủi ro |
|---|---|---|---|---|
| G4.1 | Tab "Bàn giao & Bảo hành" `/sc/[id]` + trường `ban_giao_tai`,`bao_hanh_den`,`nguoi_nghiem_thu` | UI+Schema | In Mẫu 7 có 2 bên | — |
| G4.2 | In "Bảng kê thay thế" (Mẫu 8) từ `/sc/[id]` | UI | Liệt kê VT thay thế + cũ đã thu hồi | — |
| G4.3 | Màn hình Kiểm tu (Mẫu 2) `/sc/[id]/kiem-tu` | UI | Form kiểm tu độc lập | — |

## GIAI ĐOẠN 5 — WIZARD SC & DASHBOARD ROLE 🔲 CHỜ DUYỆT → 🔧 BUILD
| ID | Bước | Đầu ra | Giám sát | Rủi ro |
|---|---|---|---|---|
| G5.1 | Wizard SC 7 bước (theo §2 file 06) | UI | Thao tác đúng thứ tự | Phức tạp UX |
| G5.2 | Dashboard theo vai (pttb thấy SC chờ duyệt, laixe thấy đề xuất) | UI | Đúng trách nhiệm | — |
| G5.3 | Gate trực quan (nút disable + tooltip) cho nghiệm thu/chi | UI | Rõ lý do chặn | — |

## GIAI ĐOẠN 6 — KIỂM THỬ & UAT 🔲 CHỜ DUYỆT → 🔧 BUILD
| ID | Bước | Đầu ra | Giám sát | Rủi ro |
|---|---|---|---|---|
| G6.1 | Conformance test parity QC206 (tất cả gate) | Test | ≥332+ mới pass | Hồi quy |
| G6.2 | `npx tsc --noEmit` + `npm test` | CI | 0 lỗi | — |
| G6.3 | UAT từng vai (pttb/xuong/khoa/ketoan/laixe) bằng Playwright | Video | Quy trình trơn tru | — |
| G6.4 | Visual test light/dark + screenshot mẫu 6/7/8 | Ảnh | Đúng thiết kế | — |

---

## GIAI ĐOẠN 7 — UI: EXPANDABLE CARD LIST + PIPELINE + EXPORT 🔲 CHỜ DUYỆT → 🔧 BUILD
| ID | Bước | Đầu ra | Giám sát | Rủi ro |
|---|---|---|---|---|
| G7.1 | Transform `/sc/kanban` → Expandable Card List (master) | UI | Thẻ SC hiển thị xe/ngày/trách nhiệm/nhánh/CP/timeline | Mất Kanban cũ |
| G7.2 | Card detail: pipeline mini-graph + 8 bước progress + log | UI | Click mở rộng thấy đủ | — |
| G7.3 | Kanban toggle nhẹ (4 cột: `cho_kiem_tra`/`dang_sua`/`cho_thanhtoan`/`hoanthanh`) | UI | Nút chuyển view ok | — |
| G7.4 | Alert icon P2 (thiếu HĐĐT / chưa thu hồi cũ) trên thẻ | UI | Hiện đúng SC vi phạm | — |
| G7.5 | Export xlsx 9 tab + PDF A5/A4 | Code+UI | File xuất đúng cấu trúc `03-audit-8-mau.md` | — |

## MA TRẬN GIÁM SÁT TỔNG THỂ
| Giai đoạn | Đầu ra chính | Checkpoint | Ai duyệt tiếp |
|---|---|---|---|
| G0 ✅ | Bộ tài liệu plan | User đọc xong | → duyệt build |
| G1 🔧 | Role pttb/laixe | test phân quyền pass | User |
| G2 🔧 | Gate thiếu HĐĐT | ketoan-gd3 pass | User |
| G3 🔧 | Gate thu hồi VT cũ | kho/asset pass + UI nhập | User |
| G4 🔧 | Mẫu 7/8/2 in | UX video | User |
| G5 🔧 | Wizard + dashboard | UAT | User |
| G6 🔧 | Conformance + UAT | tsc+test pass | Hoàn thành |

## RỦI RO TỔNG THỂ & KIẾN NGHỊ
1. **False-block nghiệp vụ cũ:** SC đã xong trước 18.08 chưa có `la_thay_the` → cần migration đánh dấu `la_thay_the=0` mặc định để không block.
2. **NCC text tự do:** báo cáo HĐĐT yếu → nên bổ sung master NCC (`khach_hang.la_ncc`) như `read_04` đề xuất (riêng GĐ).
3. **Tương thích ngược:** gate P2.2a chỉ áp dụng `cong_no.ref_type='phieu_nhap'` (không block phiếu chi nội bộ khác).
4. **Rollback:** mọi build qua transaction + audit; nếu lỗi, `reseed-perms.ts` khôi phục MATRIX cũ.

> ⚠️ **Lưu ý hệ thống sản xuất (Production Check):**
> - **Còn thiếu gì?** Mới xong G0 (tài liệu). G1–G6 là plan chờ duyệt, chưa code.
> - **Rủi ro ở đâu?** Gate sai → kẹt nghiệp vụ; role mới sai → user không login được. Cần test kỹ trước UAT.
> - **Đã chạy kiểm thử chưa?** Chưa (chưa sửa code). Chỉ doc/phân tích.
> - **Đề xuất tiếp?** User duyệt ACTION-PLAN → AI build tuần tự G1→G6, mỗi bước có checkpoint + báo cáo.
