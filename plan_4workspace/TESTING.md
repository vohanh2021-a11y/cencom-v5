# TESTING — Quy trình kiểm thử (nhắc lại từ Skill)

> Tài liệu này tổng hợp 3 skill bắt buộc phải tuân thủ khi thực hiện v4.3 Workspace.
> Đọc trước mỗi bước code. Vi phạm = DỪNG và làm lại.

---

## 1. dev-workflow (Khung 5 bước)

**Iron Law:** `KHÔNG VIẾT CODE PRODUCTION TRƯỚC KHI THIẾT KẾ ĐƯỢC DUYỆT VÀ TEST ĐÃ FAIL`

| Bước | Tên | Hành động cốt lõi |
|---|---|---|
| 1 | Hiểu & Thiết kế (brainstorm) | Đọc AGENTS.md (global+project); đọc code liên quan; hỏi 1 câu/lần; đề xuất 2–3 phương án; **Gate: chưa duyệt thiết kế thì không code** |
| 2 | Kế hoạch nhỏ (plan) | Tách task 5–15 phút; ghi rõ file/sửa, input, output, cách chứng minh; **KHÔNG placeholder** (TBD/"làm sau") |
| 3 | TDD logic cốt lõi | Xem §2 (tdd-loop). Ngoại lệ: prototype 1 lần, config, code sinh |
| 4 | Thực thi (execute) | Theo convention dự án; async có await; validate+sanitize input; check quyền TRONG hàm; log đúng mức độ; không hardcode secret |
| 5 | Xác minh & bàn giao (verify) | Chạy test/lint/`node --check`; **EVIDENCE TRƯỚC CLAIM**; kiểm "đường chết"; bàn giao kèm mục Production Check 4 câu |

**Checklist bàn giao (phải tick hết):**
- [ ] Hiểu yêu cầu + duyệt thiết kế trước khi code
- [ ] Plan task nhỏ, không placeholder
- [ ] Test logic cốt lõi + RED-GREEN
- [ ] Chạy kiểm tra dự án (tsc/build/test) — kết quả THỰC TẾ
- [ ] Validate + sanitize mọi input (backend)
- [ ] Check quyền TRONG hàm xử lý
- [ ] Async: await đủ, không fire-and-forget
- [ ] Không hardcode secret
- [ ] Log đúng mức độ
- [ ] Cập nhật docs/CHANGELOG
- [ ] Bàn giao kèm Production Check 4 câu

**Red Flags:** code trước khi hiểu; bỏ design vì "đơn giản"; không chạy test mà bảo pass; không check quyền; "sửa 1 dòng" không verify; không update docs.

---

## 2. tdd-loop (Test Trước, Code Sau)

**Iron Law:** `NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST`

```
RED → GREEN → REFACTOR (lặp)
```

- **RED:** viết 1 test nhỏ cho 1 hành vi; tên rõ (`rejects empty email`); **chạy và XÁC NHẬN FAIL đúng lý do** (tính năng chưa có, không phải typo).
- **GREEN:** viết code TỐI THIỂU để pass; không thêm tính năng ngoài phạm vi; **chạy lại: test mới pass + suite cũ pass + output sạch**.
- **REFACTOR:** dọn sau khi green; giữ test xanh; không thêm hành vi.
- Lặp cho hành vi tiếp theo.

**Chống rationalization:** "đơn giản không cần test" / "test sau" / "đã test tay" → đều = bỏ TDD → XÓA CODE, làm lại.

**Áp dụng v4.3:** Mọi hàm P4 (tonKhoReport, vatTuHistory, scProposalSave, xeScoreSave, phieuThuCreate...) phải có test RED trước khi implement.

---

## 3. systematic-debugging (Tìm nguyên nhân gốc)

**Iron Law:** `NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST`

**4 Pha:**
1. **Điều tra gốc:** đọc stack trace kỹ; tái hiện nhất quán; check `git diff` gần đây; tách lớp API→service→DB (thêm diagnostic); trace luồng dữ liệu → fix tại NGUỒN.
2. **Phân tích pattern:** tìm code chạy đúng để so sánh; nhận diện lỗi quen thuộc (null, off-by-one, race, encoding, timezone).
3. **Giả thuyết & kiểm chứng tối thiểu:** đề xuất rõ "lỗi do X vì Y"; thử nghiệm nhỏ; sai → quay lại Pha 1/2.
4. **Triển khai fix:** viết test fail tái hiện bug TRƯỚC; fix gốc không che giấu; chạy lại toàn bộ pass; ghi log.

**Sau 3+ lần fix thất bại:** nghi ngờ kiến trúc → hỏi user có cần tái thiết kế không.

**Áp dụng v4.3:** nếu ExcelTable treo (R3) hoặc workspace lộ menu (R1) → điều tra gốc, không "thử xem".

---

## 4. Lệnh chạy kiểm thử (dự án)

```bash
# Type check (toàn bộ + từng package)
npx tsc --noEmit
npm run typecheck --workspace @cencom/db
npm run typecheck --workspace @cencom/core

# Build web
npm run build --workspace @cencom/web

# Contract test (bắt buộc nếu đổi/them RPC)
npm run test:contract

# Load test
npm run test:load

# E2E mobile (P3) — Playwright viewport 375px
npx playwright test --viewport 375x667
```

**Quy tắc vàng:** chưa chạy lệnh thì KHÔNG nói "pass". Báo cáo kết quả THỰC TẾ (số pass/fail).

---

> ⚠️ Lưu ý hệ thống sản xuất (Production Check):
> - **Còn thiếu gì?** Thực thi P1–P6 chưa bắt đầu; tài liệu này chỉ nhắc lại quy trình.
> - **Rủi ro ở đâu?** Vi phạm TDD (code trước test) / không check quyền trong hàm.
> - **Đã chạy kiểm thử chưa?** Chưa (giai đoạn kế hoạch).
> - **Đề xuất tiếp theo?** Khi thực thi, mỗi task P4 viết test RED trước (xem `tdd-loop`).
