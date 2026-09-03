# Chương 8: Học giọng văn & tạo skill viết lại báo cáo

> **Mục tiêu học tập**
> - Thu thập 3–5 báo cáo mẫu đã được duyệt và trích đặc trưng giọng văn (từ khóa, độ dài câu, tone).
> - Viết prompt few-shot giữ nguyên 100% số liệu, đổi diễn đạt theo giọng đã chọn.
> - Đóng gói Skill `viet-lai-phong-cach-[Ten]` và test A/B để duyệt bản viết lại đạt chuẩn Cencom.

---

## 1. Thu thập 3–5 báo cáo mẫu — chọn đúng mới học đúng

AI không tự biết "giọng anh Hùng" là gì nếu bạn không cho mẫu. Nguyên tắc duy nhất: **chỉ học từ báo cáo đã được duyệt**, không học từ bản nháp bị sửa nhiều.

**Tiêu chí chọn nhanh:**

| Tiêu chí | Cách kiểm |
|---|---|
| Được duyệt 1 lần | Có comment "duyệt, gửi luôn" của lãnh đạo |
| Cùng loại văn bản | Chỉ gom báo cáo tuần — không trộn báo cáo tài chính |
| Cùng người ký | Cùng Trưởng phòng ký gửi Ban Giám đốc |
| Có số liệu | Mỗi mẫu ≥300 từ, có bảng và 2–3 con số %/tấn/ngày |

**Cách làm 10 phút:**

1. Lọc 5 báo cáo gần nhất được khen trong `Bao-cao-da-duyet/`.
2. Copy vào `docs/mau-giong-van/` đặt `mau-01.md` … `mau-05.md`.
3. Dùng bút dạ quang: **vàng** = câu/từ đặc trưng, **xanh** = số liệu cấm đổi (tấn, %, ngày, tên VLXD).

> Bảo mật: báo cáo chứa giá vốn, lương, khách hàng chiến lược — **không đưa vào Zen Free Tier** (gateway bên thứ ba). Dùng RAG local hoặc model trả phí có zero-retention.

![H15](03_hinh-anh-minh-hoa/H15_hoc_giong_van.png)
*Hình H15 — Thu thập 3–5 mẫu đã duyệt → copy vào docs/mau-giong-van → đánh dấu câu đặc trưng và số liệu cấm đổi. Nguồn: thực hành Cencom.*

## 2. Phân tích giọng văn — tách thành từ khóa, câu, tone

Tách giọng văn thành 3 lớp để AI bắt chước được, thay vì cảm tính "hay/dở":

| Lớp | Quan sát gì | Ví dụ giọng trang trọng Cencom |
|---|---|---|
| **Từ khóa** | Cụm mở đầu, từ nối lặp lại | *Kính báo cáo, tính đến ngày, đạt …%, tồn đọng, đề nghị* |
| **Câu** | Độ dài, chủ động/bị động | 18–25 từ/câu, chủ động: "Phòng Kho đã nhập 120 tấn xi măng PCB40." |
| **Tone** | Mức trang trọng | Trang trọng — trung lập — không icon, không "ạ/nhé", không cảm thán |

Điền phiếu cho từng mẫu (ví dụ Kho T07: từ khóa *Kính báo cáo* ×3, câu TB 21 từ, cấm đổi 120 tấn/87%), rồi tổng hợp 1 dòng: *"Trang trọng, 18–25 từ/câu, mở đầu Kính báo cáo, giữ 100% số liệu."* — làm đầu vào few-shot.

## 3. Prompt few-shot + tạo Skill `viet-lai-phong-cach-[Ten]`

### 3.1. Prompt few-shot — cho AI xem 2 ví dụ trước khi viết

Few-shot là cho AI xem **2–3 cặp "gốc → viết lại"** rồi mới giao đoạn mới. Không cần huấn luyện, chỉ cần dán mẫu.

```markdown
Bạn là trợ lý viết lại theo giọng [Tên] — trang trọng, 18-25 từ/câu.
QUY TẮC: Giữ 100% số liệu/ngày/VLXD. Không thêm số, không làm tròn.

VÍ DỤ 1 — Gốc: "Tuần rồi kho nhập 120 tấn, bán 95 tấn, còn 25 tấn."
→ Viết lại: "Kính báo cáo Ban Giám đốc, tính đến 15/02/2026 Phòng Kho đã nhập 120 tấn xi măng PCB40, xuất 95 tấn, tồn 25 tấn (79% kế hoạch)."
VÍ DỤ 2 — Gốc: "Có 3 việc chưa xong."
→ Viết lại: "Tồn đọng 03 việc: đối chiếu công nợ NCC HT (quá hạn 02 ngày) — phụ trách anh Dũng, hạn 20/02."

NHIỆM VỤ: Viết lại đoạn dưới ngắn 20% giữ đủ số liệu: [dán đoạn thô 5-8 câu]
```

Để 2 ví dụ cố định trong Skill, mỗi lần chỉ thay đoạn cuối.

### 3.2. Đóng gói thành Skill `viet-lai-phong-cach-[Ten]`

Đặt tên theo người/phòng: `viet-lai-phong-cach-Hung`, `viet-lai-phong-cach-Kho`.

```powershell
mkdir .opencode\skills\viet-lai-phong-cach-Hung
notepad .opencode\skills\viet-lai-phong-cach-Hung\SKILL.md
```

**Nội dung `SKILL.md` — dán nguyên văn là chạy:**

```markdown
---
name: viet-lai-phong-cach-Hung
description: "Use when Trưởng phòng cần viết lại báo cáo thô thành giọng trang trọng của anh Hùng — giữ 100% số liệu, 18-25 từ/câu."
---
# viet-lai-phong-cach-Hung
## Mục tiêu
Viết lại đoạn 5-8 câu thành giọng trang trọng, ngắn 15-20%, giữ 100% số liệu.

## Quy trình
1. Kiểm tra: đủ số liệu? Có mật thì cảnh báo không dùng Free Tier.
2. Viết lại few-shot với 2 ví dụ giọng anh Hùng.
3. Tự kiểm: [ ] Kính báo cáo/Đề nghị [ ] 18-25 từ/câu [ ] khớp 100% số liệu
```

Kiểm tra: `opencode skill list` và `opencode debug config | findstr viet-lai` phải hiện Skill; `node E:\DevTools\opencode\config\check-skills.js` đạt ERR=0. Đăng ký vào `SKILL_REGISTER.md`.

![H16](03_hinh-anh-minh-hoa/H16_skill_viet_lai_bao_cao.png)
*Hình H16 — Anatomy Skill viet-lai-phong-cach-[Ten]: frontmatter Use when + 2 ví dụ few-shot + checklist giữ số liệu. Nguồn: opencode.ai/docs/skills.*

## 4. Test A/B — để người duyệt chọn, không tự chấm

Hay hay không do lãnh đạo quyết. Đưa **cùng 1 đoạn thô cho 2 bản**: **A** = Skill few-shot giọng anh Hùng, **B** = prompt mặc định. Gửi cả hai cho 1–2 người duyệt chấm 3 câu: (1) giữ đúng 100% số liệu? (2) đúng giọng Cencom hơn? (3) ngắn gọn đủ ý? A thắng 2/3 → chốt lưu `docs/mau-giong-van/ban-chot.md`; hòa thì thêm 1 ví dụ few-shot và test lại. Luôn đối chiếu số liệu bằng mắt — AI hay làm tròn 87,4% thành 87% là sai.

---

## Tóm tắt chương

Học giọng văn là chuỗi 4 bước: **thu thập 3–5 báo cáo đã duyệt** vào `docs/mau-giong-van/` và đánh dấu số liệu cấm đổi; **phân tích** thành từ khóa–câu–tone (18–25 từ/câu, trang trọng); **prompt few-shot 2 ví dụ** giữ 100% số liệu và đóng gói thành Skill `viet-lai-phong-cach-[Ten]` với frontmatter `Use when...`; cuối cùng **test A/B** để người duyệt chọn. Báo cáo mật không đi qua Zen Free Tier.

## Bài tập thực hành 5 phút

Dán 1 đoạn thô 5 câu (có 2 số liệu tấn/%/ngày) vào TUI, gọi Skill `viet-lai-phong-cach-Hung`: *"Viết lại đoạn này ngắn hơn 20% theo giọng anh Hùng, giữ nguyên 100% số liệu"*. So sánh gốc và bản viết lại, tick checklist ở Mục 3.2 và gửi cho 1 đồng nghiệp chấm A/B bằng phiếu 3 câu ở Mục 4.
