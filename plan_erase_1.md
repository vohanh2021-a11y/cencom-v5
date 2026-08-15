# PLAN_ERASE_1.md — Kế Hoạch Loại Bổ Module "Thăm Khám Sửa Chữa" (TK)

> **Ngày tạo:** 2026-08-14  
> **Mục đích:** Ghi chép chi tiết việc loại bỏ hoàn toàn module "Thăm khám sửa chữa" (TK), thay thế bằng module "Đề xuất sửa chữa" (DeXuatSuaChua). File này serve as historical record để AI phiên sau nắm được tính năng đã lược bỏ.

---

## 1. TÓM T��T THAY Đ��I

| Thành Phần | Hành Động | Chi Tiết |
|------------|-----------|----------|
| Module TK | **XÓA HOÀN TOÀN** | Xóa `tk.ts`, `tk.test.ts`, tất cả RPC TK, role `laixe` |
| Module DeXuat | **T��O M��I** | Tạo `de_xuat.ts`, `de_xuat.test.ts`, RPC `deXuat*` |
| Database | **REFACTOR** | Xóa 6 bảng TK, thêm bảng `de_xuat_sua_chua`, sửa `phieu_sua`, `xe`, `sc_vattu` |
| Role `laixe` | **XÓA HOÀN TOÀN** | Xóa khỏi `ROLES`, `MATRIX`, permissions |
| Module DeXuat | **T��O M��I** | State: `cho_duyet` → `da_duyet`/`tu_choi` → `da_chuyen_sc` |
| Tests | **REFACTOR** | Xóa `tk.test.ts`, tạo `de_xuat.test.ts`, cập nhật tests liên quan |
| Seed Data | **REFACTOR** | Xóa `seed_biemau.json`, xóa `danh_gia_pct` khỏi `seed_xe.json` |
| Documentation | **C��P NH��T** | `PLAN_14.08_supa.md`, `CHANGELOG.md`, `docs/CHANGELOG.md` |

---

## 2. DANH SÁCH FILE C��N THAY Đ��I (Theo Thứ Tự ��u Tiên)

### A. Database & Types (��u Tiên Cao)
- [ ] `packages/db/schema.sql` - Xóa 6 bảng, sửa 4 bảng, thêm `de_xuat_sua_chua`
- [ ] `packages/db/schema.sql` - Xóa indexes TK, thêm indexes DeXuat
- [ ] `packages/db/src/migrate-tk-removal.ts` - **FILE M��I**: Migration script
- [ ] `packages/core/src/types.ts` - Xóa types TK, thêm `DeXuatSuaChuaRow`
- [ ] `packages/db/seed/seed_biemau.json` - **XÓA FILE**
- [ ] `packages/db/seed/seed_xe.json` - Xóa `danh_gia_pct`
- [ ] `packages/db/src/seed.ts` - Xóa `seedBieuMa()`

### B. Core Modules (��u Tiên Cao)
- [ ] `packages/core/src/tk.ts` - **XÓA FILE**
- [ ] `packages/core/src/de_xuat.ts` - **FILE M��I** (~20KB)
- [ ] `packages/core/src/sc.ts` - Xóa `tk_id`, thêm `de_xuat_id`, thêm `scCreateFromDeXuat`
- [ ] `packages/core/src/xuong.ts` - Thay TK sections bằng DeXuat sections
- [ ] `packages/core/src/welcome.ts` - Xóa TK stats/tasks/shortcuts
- [ ] `packages/core/src/chat.ts` - Xóa TK image handling
- [ ] `packages/core/src/handlers.ts` - Xóa RPC TK, thêm RPC DeXuat
- [ ] `packages/core/src/perm.ts` - Xóa `laixe`, xóa TK perms, thêm DeXuat perms
- [ ] `packages/core/src/index.ts` - Export `de_xuat`, xóa `tk`
- [ ] `packages/core/src/chat.ts` - Xóa TK image handling

### C. Permissions & RPC (��u Tiên Trung Bình)
- [ ] `packages/core/src/perm.ts` - Xóa `laixe`, TK perms, thêm DeXuat perms
- [ ] `packages/core/src/handlers.ts` - Xóa RPC TK, thêm RPC DeXuat

### D. Tests (��u Tiên Trung Bình)
- [ ] `packages/core/tests/tk.test.ts` - **XÓA FILE**
- [ ] `packages/core/tests/de_xuat.test.ts` - **FILE M��I**
- [ ] `packages/core/tests/xuong.test.ts` - Cập nhật
- [ ] `packages/core/tests/welcome.test.ts` - Cập nhật
- [ ] `packages/core/tests/sc.test.ts` - Cập nhật
- [ ] `packages/core/tests/chat.test.ts` - Cập nhật
- [ ] `packages/core/tests/de_xuat.test.ts` - **FILE M��I**

### E. Seed Data & Config (��u Tiên Trung Bình)
- [ ] `packages/db/seed/seed_biemau.json` - **XÓA FILE**
- [ ] `packages/db/seed/seed_xe.json` - Xóa `danh_gia_pct`
- [ ] `packages/db/src/seed.ts` - Xóa `seedBieuMa()`

### E. Documentation (��u Tiên Thấp)
- [ ] `PLAN_14.08_supa.md` - Cập nhật section 6.4, 7.3, 8.5, 10, 12, 13
- [ ] `docs/CHANGELOG.md` - Ghi nhận loại bỏ TK
- [ ] `CHANGELOG.md` - Ghi nhận loại bỏ TK
- [ ] `plan_erase_1.md` (file này) - Ghi chép lịch sử

### F. Migration Script (��u Tiên Cao)
- [ ] `packages/db/src/migrate-tk-removal.ts` - Migration script production data

---

## 3. TH�� T�� TRI��N KHAI CHI TI��T

### Phase 1: Database Schema & Migration (Ngày 1)
```
1. packages/db/schema.sql          # Cập nhật schema
2. packages/core/src/types.ts      # Cập nhật types
3. packages/db/src/migrate-tk-removal.ts  # Migration script
4. Chạy migration test trên PGlite
5. packages/db/seed/seed_xe.json   # Xóa danh_gia_pct
6. packages/db/seed/seed_biemau.json (XÓA)
7. packages/db/src/seed.ts         # Xóa seedBieuMa()
8. Chạy test DB + typecheck
```

### Phase 2: Core Modules (Ngày 2)
```
1. XÓA packages/core/src/tk.ts
2. T��O packages/core/src/de_xuat.ts
3. Cập nhật sc.ts (xóa tk_id, thêm de_xuat_id, thêm scCreateFromDeXuat)
4. Cập nhật xuong.ts (thay TK sections bằng DeXuat)
5. Cập nhật welcome.ts (xóa TK stats/tasks)
6. Cập nhật chat.ts (xóa TK image handling)
8. Cập nhật handlers.ts (RPC mapping)
9. Cập nhật perm.ts (xóa laixe, thêm DeXuat perms)
10. Cập nhật index.ts (export de_xuat, xóa tk)
10. Cập nhật chat.ts
11. T��O de_xuat.ts
```

### Phase 3: Permissions & Tests (Ngày 3)
```
1. perm.ts - xóa laixe, TK perms, thêm DeXuat perms
2. handlers.ts - RPC mapping
3. XÓA tk.test.ts
4. T��O de_xuat.test.ts
3. Cập nhật xuong.test.ts
4. Cập nhật welcome.test.ts
4. Cập nhật sc.test.ts
4. Cập nhật chat.test.ts
5. T��O de_xuat.test.ts
```

### Phase 4: Seed & Verification (Ngày 4)
```
1. Cập nhật seed_xe.json (xóa danh_gia_pct)
2. XÓA seed_biemau.json
3. Cập nhật seed.ts
5. Chạy typecheck toàn repo
6. Chạy test toàn bộ
7. Cập nhật documentation
7. Commit
```

---

## 4. CHI TI��T K�� THU��T C��N L��U Ý

### 4.1 Migration Production Data
```sql
-- 1. Backup tk_id to log_audit
INSERT INTO log_audit (bang, id_dong, hanh_vi, noi_dung, nguoi, thoi_gian)
SELECT 'phieu_sua', id, 'migrate_tk_removal', 'tk_id=' || tk_id, 'system', now_stamp()
FROM phieu_sua WHERE tk_id IS NOT NULL;

-- 2. Set NULL before drop
UPDATE phieu_sua SET tk_id = NULL WHERE tk_id IS NOT NULL;

-- 3. Drop column
ALTER TABLE phieu_sua DROP COLUMN tk_id;
ALTER TABLE phieu_sua ADD COLUMN de_xuat_id TEXT;

-- 4. sc_vattu.bao_gia_id
UPDATE sc_vattu SET bao_gia_id = NULL WHERE bao_gia_id IS NOT NULL;
ALTER TABLE sc_vattu DROP COLUMN bao_gia_id;

-- 4. xe.danh_gia_pct
ALTER TABLE xe DROP COLUMN danh_gia_pct;
```

### 4.2 Role `laixe` Cleanup
- Grep toàn bộ codebase: `grep -r "laixe" --include="*.ts" --include="*.json"`
- Xóa khỏi: `ROLES`, `MATRIX`, `ROLE_LABEL`, seed users, tests

### 4.3 File `de_xuat.ts` API Surface
```typescript
// State: cho_duyet → da_duyet/tu_choi → da_chuyen_sc
export async function deXuatCreate(api, rec)          // de_xuat.tao
export async function deXuatList(api, q)              // de_xuat.xem
export async function deXuatGet(api, id)              // de_xuat.xem
export async function deXuatApprove(api, id, action)  // de_xuat.duy (ok/tu_choi)
export async function deXuatToSC(api, id)             // de_xuat.sua - chuyển thành SC
```

---

## 5. CHECKLIST TR��NG THÁI

| Mục | Trạng Thái | Ghi Chú |
|-----|------------|---------|
| Schema SQL | [ ] | |
| Migration script | [ ] | |
| Types | [ ] | |
| tk.ts (XÓA) | [ ] | |
| de_xuat.ts (M��I) | [ ] | |
| sc.ts | [ ] | |
| xuong.ts | [ ] | |
| welcome.ts | [ ] | |
| chat.ts | [ ] | |
| handlers.ts | [ ] | |
| perm.ts | [ ] | |
| index.ts | [ ] | |
| chat.ts | [ ] | |
| perm.ts | [ ] | |
| tk.test.ts (XÓA) | [ ] | |
| de_xuat.test.ts (M��I) | [ ] | |
| xuong.test.ts | [ ] | |
| welcome.test.ts | [ ] | |
| sc.test.ts | [ ] | |
| chat.test.ts | [ ] | |
| de_xuat.test.ts | [ ] | |
| seed_xe.json | [ ] | |
| seed_biemau.json (XÓA) | [ ] | |
| seed.ts | [ ] | |
| Migration script | [ ] | |
| PLAN_14.08_supa.md | [ ] | |
| CHANGELOG.md | [ ] | |
| docs/CHANGELOG.md | [ ] | |
| Typecheck pass | [ ] | |
| Tests pass | [ ] | |

---

## 6. GHI CHÚ QUAN TR��NG

1. **Migration production data**: Có data production cho `tk_id` và `bao_gia_id` → cần migration script cẩn thận
2. **Role `laixe`**: Hardcoded ở nhiều chỗ → grep toàn bộ codebase trước khi xóa
3. **Test coverage**: Xóa `tk.test.ts` → phải viết `de_xuat.test.ts` đầy đủ
4. **Frontend GĐ3**: Cập nhật `PLAN_14.08_supa.md` section 10 trước khi GĐ3
4. **Backup**: Trước khi chạy migration production, backup DB

---

## 6. L��CH S�� THAY Đ��I (CHANGELOG PH��N NÀY)

| Ngày | Phiên | Thay Đổi |
|------|-------|----------|
| 2026-08-14 | 1.0 | Tạo plan_erase_1.md, bắt đầu triển khai |

---

## 7. R��I RO & MITIGATION

| Rủi Ro | Mức Độ | Mitigation |
|--------|--------|------------|
| FK `phieu_sua.tk_id` drop | Cao | Migration: set NULL → log_audit → drop |
| `sc_vattu.bao_gia_id` production data | Trung bình | Set NULL trước khi drop column |
| Role `laixe` hardcoded ở nhiều chỗ | Cao | Grep toàn bộ codebase trước khi xóa |
| Test coverage giảm | Thấp | Viết test `de_xuat.test.ts` đầy đủ |
| Frontend GĐ3 chưa code | Cao | Cập nhật PLAN trước GĐ3 |

---

## 8. LI��N K��T THAM CHI��U

- `PLAN_14.08_supa.md` - Master plan (cập nhật sections 6.4, 7.3, 8.5, 10, 12, 13)
- `docs/CHANGELOG.md` - Changelog hệ thống
- `CHANGELOG.md` - Changelog root
- `packages/db/schema.sql` - Schema chính
- `packages/core/src/` - Core modules
- `packages/db/src/migrate-tk-removal.ts` - Migration script