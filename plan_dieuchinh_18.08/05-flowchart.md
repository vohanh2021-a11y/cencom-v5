# 05 — FLOWCHART CHUẨN HÓA (QC206 + 8 BƯỚC KẾ TOÁN)

> Vẽ bằng Mermaid. Đưa vào tài liệu thiết kế (`docs/ui_v4/*` hoặc `docs/QC206_flow.md`).

## 1. 8 BƯỚC PROGRESS (thanh tiến trình SC)

```mermaid
flowchart LR
    S1[1.Kiểm tra<br/>BẮT BUỘC mở SC] --> S2[2.Kết luận + Chọn nhánh]
    S2 --> S3[3.Mua / Xuất VT]
    S3 --> S4[4.Sửa chữa]
    S4 --> S5[5.Thu hồi VT cũ<br/>P2.2b]
    S5 --> S6[6.Nghiệm thu<br/>Bàn giao + BH]
    S6 --> S7[7.Quyết toán<br/>Nợ 642/241 Có 154]
    S7 --> S8[8.Thanh toán NCC<br/>CÓ HĐĐT - P2.2a]
```

> Quy tắc: `Kiểm tra` là **điều kiện cần để MỞ phiếu SC** — nếu chưa kiểm tra → không mở phiếu.

## 2. NESTED BRANCH TREE (cây quyết định 4 nhánh)

```mermaid
flowchart TD
    KT[Kiểm tra - Xưởng Cencom] --> KL[Kết luận + Hệ thống gợi ý / Thợ xác nhận]
    KL --> N1[Nhánh 1: Khắc phục<br/>không thay, không mua]
    KL --> N2[Nhánh 2: Thay VT nhỏ từ khovattu<br/>chuyển quyền BP kho]
    KL --> N3[Nhánh 3: Thay → Mua]
    KL --> N4[Nhánh 4: Xưởng ngoài]

    N3 --> N3a[3a Kios<br/>tạm ứng / ghi nợ]
    N3 --> N3b[3b Gửi kiểm tra<br/>công ty trả CP → 154]
    N3 --> N3c[3c NCC xa<br/>HĐĐT 331]

    N4 --> N41[4.1 KC không mua<br/>công ngoài TM/331]
    N4 --> N42[4.2 XN yêu cầu VT<br/>khovattu mua → XN lắp]
    N4 --> N43[4.3 XN lo cả<br/>HĐ linh động VAT/TM]
```

> Thợ/xưởng **chỉ** Kiểm tra + Lập SC (nhánh sửa tại xưởng). Từ nhánh 2/3/4, quyền **chuyển sang `khovattu`** (mua/xuất kho).

## 3. GATE tuân thủ (Nguyên tắc 2 & 3)

```mermaid
flowchart LR
    subgraph P2.2a[Nguyên tắc 2a: Chứng từ]
      T1[Phiếu chi NCC] --> G1{Công nợ có vat_invoice?}
      G1 -->|Không| X1[CHẶN - Vi phạm QC206]
      G1 -->|Có| OK1[Cho phép chi - Nợ 331/Có 112]
    end
    subgraph P2.2b[Nguyên tắc 2b: Thu hồi VT cũ]
      T2[Nghiệm thu SC] --> G2{SC có VTPT thay thế?}
      G2 -->|Có| G3{Đã nhập kho cu_hong?}
      G3 -->|Không| X2[CHẶN nghiệm thu]
      G3 -->|Có| OK2[Duyệt nghiệm thu]
      G2 -->|Không| OK2
    end
    subgraph P2.3[Nguyên tắc 3: Kế hoạch + nghiệm thu]
      T3[Lệnh cấp phát] --> OK3[SC được tạo]
      T4[Nghiệm thu + bàn giao] --> OK4[Đóng phiếu - có biên bản]
    end
```

## 4. Ma trận nghiệp vụ ↔ bút toán (từ `plan_ketoan/read_06`)

```mermaid
flowchart TD
    M1[Nhập VT NCC+HĐĐT] -->|Nợ 152,133 / Có 331| L1[152 tồn kho]
    M2[Xuất VT cho SC] -->|Nợ 154 / Có 152| L1
    M3[Nhân công trong] -->|Nợ 622 / Có 334| L2[622 giá thành]
    M3b[Nhân công ngoài] -->|Nợ 622 / Có 331| L2
    M4[Quyết toán SC thường] -->|Nợ 642 / Có 154| L3[642 CP QLDN]
    M4b[Quyết toán nâng cấp] -->|Nợ 241 / Có 154 → 241→211| L4[211 TSCĐ]
    M6[Thanh toán NCC] -->|Nợ 331 / Có 112| L6[331 công nợ]
    L1 -.đối chiếu.-> K[(kho.tonKho phải khớp)]
    L6 -.đối chiếu.-> C[(cong_no.con_no phải khớp)]
```

## 5. Phân vai (RBAC) theo QC206

```mermaid
flowchart TD
    PTTB[Tổ PTTB - role pttb] -->|giám sát, quyết định mua| SC[Phiếu SC]
    LX[Lái xe - role laixe] -->|đề xuất, tự khắc phục| DX[Đề xuất]
    XUONG[Xưởng - role xuong/tho] -->|kiểm tra, lập SC, sửa| SC
    KVT[BP Kho Vật tư - role khovattu] -->|nhập/xuất/mua| KHO[(Kho VTPT)]
    KT[Kế toán - role ketoan] -->|quyết toán, TT NCC| CN[(Công nợ/HĐĐT)]
    GD[GĐ/Quản lý] -->|phê duyệt lớn| SC
```

## 6. GHI CHÚ UI (theo quyết định 18.08 v2)
- **Dashboard master** = Expandable Card List (Shopify/Linear/Notion), KHÔNG dùng Kanban mặt định.
- **Card detail** = pipeline mini-graph (như §1–§2) + 8 bước progress + audit log.
- **Kanban** giữ lại dạng toggle nhẹ (4 cột: `cho_kiem_tra` / `dang_sua` / `cho_thanhtoan` / `hoanthanh`).
- **Timeline ngắn gọn + Alert icon** ⚠️ nếu thiếu HĐĐT (P2.2a) hoặc chưa thu hồi VT cũ (P2.2b).

> ⚠️ **Lưu ý:** Hiện `pttb`, `laixe` (thực), `khovattu` CHƯA có trong hệ thống → cần build theo `04-compliance-p2-p3.md` mục C trước khi flowchart này đúng thực tế.
