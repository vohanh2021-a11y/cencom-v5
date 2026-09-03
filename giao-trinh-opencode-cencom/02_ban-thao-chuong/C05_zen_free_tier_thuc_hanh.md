# Chương 5: OpenCode Zen Free Tier — Dùng miễn phí hiệu quả

> **Mục tiêu học tập**
> - Mô tả Zen là AI Gateway đã tuyển chọn, phân biệt với Bring Your Own Key và nguyên tắc no lock-in.
> - Nêu quota nhóm Free (~200 request/ngày/model, giá $0, "available for a limited time") và lưu ý bảo mật.
> - Cấu hình được `opencode.json` qua 3 bước và áp dụng 3 mẹo tiết kiệm quota vào báo cáo hàng ngày.

---

## 1. Zen là gì — Siêu thị model đã chọn lọc

Nếu OpenCode là bàn làm việc của AI Agent, thì **Zen** là siêu thị đặt ngay cạnh bàn — nơi mọi trợ lý AI đã được tuyển chọn sẵn.

**OpenCode Zen** được mô tả tại `opencode.ai/docs/zen` là *curated list of models provided by OpenCode*. Thay vì tự dò hàng trăm model, đội ngũ OpenCode chỉ đưa vào Zen những model đã thử nghiệm thực tế cho tác vụ Agent. Hạ tầng Zen đặt tại Mỹ, chính sách lưu giữ dữ liệu ghi tại mục Privacy trên docs.

Điểm cốt lõi cho Trưởng phòng: Zen **hoạt động như một provider bình thường** trong OpenCode. Bạn đăng nhập Zen, lấy API key và chọn model ngay trong TUI, không cần đổi công cụ. Zen tuân thủ **no lock-in — không khóa chặt**: hoàn toàn tùy chọn. Bạn có thể chỉ dùng Zen, chỉ dùng khóa riêng (Bring Your Own Key — BYOK), hoặc kết hợp cả hai. Tháng ít việc chi phí có thể là $0; tháng nhiều việc tính theo lượng dùng thực tế (pay-as-you-go).

Nói gọn: **BYOK là tự đi chợ, Zen là vào siêu thị đã chọn lọc** — cùng mua hàng, nhưng Zen tiết kiệm thời gian thử-sai.

![H09](03_hinh-anh-minh-hoa/H09_zen_free_tier_quota.png)
*Hình H09 — Zen như siêu thị model đã chọn lọc: chọn đúng trợ lý cho đúng việc, chỉ trả phần đã dùng. Nguồn: opencode.ai/docs/zen.*

## 2. Quota Free Tier — Bảng so sánh Free vs Pro vs Team

Zen duy trì nhóm **model Free giá $0** (input, output, cache đều $0). Đến 08/2026 gồm 7 model, tất cả ghi chú **"available for a limited time"** — miễn phí trong giai đoạn thu thập phản hồi, có thể thay đổi mà không báo trước:

- **Big Pickle**, **Ox Alpha Free** (stealth, Ox Alpha zero-retention);
- **MiMo-V2.5 Free**, **Hy3 Free**;
- **Nemotron 3 Ultra Free**, **Nemotron 3.5 Lightning Free** (cổng NVIDIA);
- **Muse Spark 1.2 Contributor Free**.

Về **quota**, Zen **không công bố con số cố định**. Thực tế cộng đồng ghi nhận ngưỡng khoảng **~200 request/ngày/model Free** — vượt ngưỡng sẽ gặp lỗi `429 FreeUsageLimitError` và phải chờ chu kỳ mới. Ngưỡng này không cam kết, khác nhau theo model và thời điểm.

**Lưu ý bảo mật:** một số cổng Free cho phép dùng dữ liệu để cải thiện model. Vì vậy **không đưa thông tin mật** (giá vốn, hợp đồng, dữ liệu khách hàng) vào model Free; khi xử lý dữ liệu nhạy cảm, hãy chuyển sang model trả phí có zero-retention.

| Tiêu chí | **Free Tier** | **Zen trả phí (Pay-as-you-go)** | **Team / Workspace** |
|---|---|---|---|
| **Chi phí** | $0 — 7 model Free | Nạp tối thiểu $20, trả theo token | Workspace **miễn phí beta** |
| **Model** | Chỉ nhóm Free | Toàn bộ 70+ model: GPT-5, Claude, Gemini… | Admin bật/tắt model cho nhóm |
| **Giá (1M token)** | Input $0 / Output $0 | Input $0,05–$30; Output tới $180/1M | Theo tiêu thụ chung |
| **Giới hạn** | ~200 request/ngày/model (không cam kết) | Không trần — hết khi hết số dư | Đặt hạn mức tháng cho workspace và thành viên |
| **Tự động nạp** | Không áp dụng | Khi < $5 tự nạp $20 (tắt được) | Admin cấu hình |
| **Phù hợp cho** | Dùng thử, việc nhẹ | Công việc ổn định hàng ngày | Phòng ban cần kiểm soát tập trung |

> Nguồn: Zen Pricing và For Teams tại `opencode.ai/docs/zen` cập nhật 21/08/2026.

## 3. Ba bước đăng ký và cấu hình `opencode.json`

### Bước 1 — Đăng ký Zen và lấy API Key

Truy cập **https://opencode.ai/auth**, đăng nhập và bổ sung thông tin thanh toán để xác thực (bắt buộc ngay cả khi chỉ dùng Free). Sao chép **API Key** và giữ như mật khẩu — không dán vào nhóm chat, không commit lên Git.

### Bước 2 — Kết nối trong OpenCode

Mở TUI bằng `opencode`, gõ `/connect` → chọn **OpenCode Zen** → dán API Key. Kiểm tra bằng `/models` để thấy danh sách model Free hiển thị giá $0.

### Bước 3 — Cấu hình `opencode.json` (key qua biến môi trường)

Tệp `opencode.json` đặt ở thư mục dự án hoặc `~/.config/opencode/`. Mẫu tối giản:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "opencode": {
      "options": {
        "apiKey": "{env:OPENCODE_ZEN_API_KEY}"
      }
    }
  },
  "model": "opencode/mimo-v2.5-free",
  "small_model": "opencode/big-pickle",
  "agents": {
    "plan": {
      "model": "opencode/claude-sonnet-4-5"
    }
  }
}
```

**Giải thích:** `apiKey` trỏ tới biến môi trường `OPENCODE_ZEN_API_KEY` nên không lộ khi chia sẻ; `model` mặc định là `mimo-v2.5-free` (miễn phí); `small_model` cho việc nhẹ như đặt tiêu đề phiên (`big-pickle` Free); `agents.plan.model` chỉ gọi khi lập kế hoạch phức tạp (model trả phí). Đặt biến môi trường xong, khởi động lại OpenCode và kiểm tra bằng `opencode debug config`.

![H10](03_hinh-anh-minh-hoa/H10_cau_hinh_opencode_json.png)
*Hình H10 — Ba bước Zen: lấy key tại opencode.ai/auth → /connect trong TUI → khai báo opencode.json qua biến môi trường. Nguồn: opencode.ai/docs/zen.*

## 4. Ba bài thực hành báo cáo hàng ngày + Ba mẹo tiết kiệm quota

### Ba bài thực hành (3–5 phút/bài, dùng model Free)

**1. Soạn email tồn kho:** Trong `D:\bao-cao-kho`, gõ `opencode` rồi yêu cầu: *"Từ ton-kho-07.xlsx, soạn email 150 từ gửi Giám đốc: tồn xi măng, sắt, gạch — nêu 1 cảnh báo dưới định mức"*. Kiểm tra lại số liệu trước khi gửi.

**2. Tóm tắt biên bản họp:** Dán biên bản 2 trang: *"Tóm tắt 5 bullet: việc đã làm, việc tồn, người phụ trách, deadline — giữ nguyên số liệu"*.

**3. Chỉnh báo cáo gọn 20%:** Dán đoạn 300 từ: *"Viết lại ngắn hơn 20%, giữ 3 con số chính, giọng trang trọng, dùng bullet"*.

Ba việc này tiêu tốn rất ít token, nằm gọn trong ngưỡng Free nếu rải đều trong ngày.

### Ba mẹo tiết kiệm quota

**Mẹo 1 — Phân tầng độ khó.** Free làm việc nhẹ (email, tóm tắt, chỉnh văn bản); chỉ chuyển sang model trả phí (Claude Sonnet, GPT-5) khi cần suy luận sâu như rà soát hợp đồng.

**Mẹo 2 — Chọn đúng model, chênh lệch tới 100 lần.** Giá output trên Zen từ $0 tới $180/1M token. Đặt `small_model` luôn là Free, `model` mặc định là Free, chỉ nâng cấp khi kết quả chưa đạt. Cuối tuần xem usage trên dashboard Zen.

**Mẹo 3 — Đặt trần chi tiêu.** Mặc định Zen tự nạp $20 khi số dư dưới $5 — tiện nhưng dễ trôi chi phí. Nếu cần kiểm soát chặt, hãy tắt auto-reload và đặt **monthly limit** (ví dụ $20/tháng). Khi hết số dư hệ thống dừng thay vì âm thầm trừ tiền.

---

## Tóm tắt chương

Zen là AI Gateway đã tuyển chọn, hoạt động như provider bình thường trong OpenCode với nguyên tắc no lock-in. Nhóm Free gồm 7 model giá $0, ngưỡng tham khảo ~200 request/ngày/model, luôn ghi chú "available for a limited time" và không dùng cho dữ liệu mật. Bảng Free/Trả phí/Team giúp chọn đúng nhu cầu: thử việc nhẹ thì Free, việc ổn định thì pay-as-you-go, quản lý phòng ban thì Workspace. Ba bước `opencode.ai/auth → /connect → opencode.json` (key qua biến môi trường) là đủ để chạy, và ba mẹo phân tầng — chọn đúng model — đặt trần giúp quota Free luôn đủ cho báo cáo hàng ngày.

## Bài tập thực hành 5 phút

Tạo `opencode.json` với `model: opencode/mimo-v2.5-free` và `small_model: opencode/big-pickle` (key qua `{env:OPENCODE_ZEN_API_KEY}`). Chạy `opencode debug config` và `/models` trong TUI, chụp màn hình dòng `model`/`small_model` đã nhận đúng, rồi thử *"Tóm tắt 3 bullet báo cáo tuần 100 từ"* để xác nhận model Free phản hồi trước khi sang Chương 6.
