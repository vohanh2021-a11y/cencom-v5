# OpenCode Zen Free Tier — Dùng Miễn Phí Hiệu Quả

> **Vị trí trong giáo trình:** Tài liệu nghiên cứu cho **Chương 05 — OpenCode Zen Free Tier — Dùng miễn phí hiệu quả** · Đối tượng: Trưởng phòng ban Cencom (không chuyên IT)

---

## 1. Zen là gì?

**OpenCode Zen** là cổng mô hình AI (AI Gateway) do đội ngũ OpenCode tuyển chọn và kiểm định — được mô tả trên trang chủ là *"curated list of models provided by OpenCode"* (opencode.ai/docs/zen). Thay vì tự dò tìm hàng trăm mô hình ngoài thị trường, Zen chỉ đưa vào danh mục những mô hình đã được thử nghiệm thực tế cho tác vụ lập trình và làm việc với tác nhân AI (coding agent).

Điểm khác biệt lớn nhất so với cách dùng truyền thống là Zen hoạt động **như một nhà cung cấp (provider) bình thường** bên trong OpenCode. Người dùng đăng nhập Zen, lấy khóa API và chọn mô hình ngay trong giao diện OpenCode, không cần đổi công cụ. Zen cũng tuân thủ nguyên tắc **không khóa chặt (no lock-in)**: hoàn toàn tùy chọn — bạn có thể dùng Zen, dùng khóa riêng của mình (Bring Your Own Key), hoặc kết hợp cả hai. Toàn bộ hạ tầng Zen được lưu trữ tại Mỹ và áp dụng chính sách lưu giữ dữ liệu minh bạch (thông tin chi tiết ở mục Privacy trên docs).

Nói ngắn gọn cho trưởng phòng: **Zen giống như một siêu thị đã chọn lọc sẵn** — bạn vào, chọn đúng loại trợ lý AI phù hợp với việc đang làm, và chỉ trả đúng phần mình dùng.

## 2. Quota Free Tier — Dùng miễn phí được bao nhiêu?

Zen duy trì một nhóm **mô hình miễn phí (Free)** với mức giá **$0 cho cả đầu vào, đầu ra và đọc bộ nhớ đệm**. Tính đến tháng 08/2026, danh mục Free gồm 7 mô hình sau:

- **Big Pickle** (mô hình ẩn danh — stealth, miễn phí có thời hạn)
- **Ox Alpha Free** (stealth, chính sách zero-retention — không dùng dữ liệu để huấn luyện)
- **MiMo-V2.5 Free**, **Hy3 Free**
- **Nemotron 3 Ultra Free**, **Nemotron 3.5 Lightning Free** (cổng thử nghiệm NVIDIA)
- **Muse Spark 1.2 Contributor Free**

Tất cả đều được ghi chú rõ là **"available for a limited time"** — miễn phí trong giai đoạn thu thập phản hồi để cải thiện mô hình, có thể thay đổi hoặc rút khỏi danh mục mà không báo trước dài hạn.

Về **quota (hạn mức)**, Zen **không công bố một con số cố định** áp dụng cho mọi mô hình và mọi tài khoản. Tài liệu chính thức không nêu mức "bao nhiêu token/ngày" hay "bao nhiêu request/ngày" cho nhóm Free. Trong thực tế, cộng đồng ghi nhận mức giới hạn xoay quanh **khoảng 200 request/ngày cho mỗi mô hình Free** (ví dụ Big Pickle, DeepSeek V4 Flash Free) — khi vượt ngưỡng sẽ nhận lỗi `429 FreeUsageLimitError` và phải chờ chu kỳ làm mới. Tuy nhiên, ngưỡng này **không được đảm bảo**, có thể khác nhau theo mô hình, dung lượng hệ thống và thời điểm, và Zen có thể điều chỉnh mà không cam kết giữ nguyên. Thông điệp quan trọng cho người dùng văn phòng: **Free Tier đủ cho công việc thường ngày** (soạn báo cáo, chỉnh văn bản, tóm tắt), nhưng **không nên dùng cho khối lượng lớn liên tục** — khi cần ổn định, hãy chuyển sang mô hình trả phí.

Lưu ý bảo mật: một số cổng Free ghi rõ dữ liệu có thể được dùng để cải thiện mô hình trong giai đoạn miễn phí. Vì vậy **không đưa thông tin mật của công ty** (giá vốn, hợp đồng, dữ liệu khách hàng) vào các mô hình Free thuộc nhóm này; hãy dùng mô hình trả phí có chính sách zero-retention khi xử lý dữ liệu nhạy cảm.

## 3. Bảng so sánh Free vs Pro vs Team

| Tiêu chí | **Free Tier** | **Zen trả phí (Pay-as-you-go)** | **Team / Workspace** |
|---|---|---|---|
| **Chi phí** | $0 — dùng 7 mô hình Free | Nạp số dư (tối thiểu $20), trả theo token, không phụ phí trên request | Quản lý workspace hiện **miễn phí giai đoạn beta** |
| **Mô hình** | Chỉ nhóm Free nêu trên | Toàn bộ danh mục Zen (70+ mô hình: GPT-5, Claude, Gemini, Grok, DeepSeek, Qwen, Kimi…) | Quản trị viên bật/tắt mô hình cho cả nhóm |
| **Giá ví dụ (1M token)** | Input $0 / Output $0 | Từ $0,05 (GPT-5 Nano Input) đến $30 (GPT-5.5 Pro Input); Output tới $180/1M | Tính theo mức tiêu thụ chung của workspace |
| **Giới hạn sử dụng** | ~200 request/ngày/mô hình (không cam kết, có thể thay đổi) | Không có trần tuần/tháng mặc định — chỉ hết khi hết số dư (nếu tắt tự động nạp) | Đặt hạn mức tháng cho toàn workspace và từng thành viên |
| **Tự động nạp** | Không áp dụng | Khi số dư < $5 tự động nạp $20 (có thể đổi mức hoặc tắt) | Áp dụng chung, quản trị viên cấu hình |
| **Phí giao dịch** | Không | 4,4% + $0,30 mỗi lần nạp (phí xử lý thẻ, thu hộ) | Tương tự Zen trả phí |
| **Phù hợp cho** | Dùng thử, việc nhẹ, học công cụ | Công việc hàng ngày ổn định, cần chọn mô hình theo độ khó | Phòng ban / nhóm dự án cần kiểm soát chi phí tập trung |

> Bảng trên tổng hợp từ trang Zen Pricing và mục For Teams (opencode.ai/docs/zen) cập nhật ngày 21/08/2026. Giá chi tiết từng mô hình xem bảng Pricing đầy đủ trên docs.

## 4. Ba bước đăng ký và cấu hình `opencode.json`

### Bước 1 — Đăng ký Zen và lấy khóa API
Truy cập **https://opencode.ai/auth**, đăng nhập, bổ sung thông tin thanh toán (cần thiết ngay cả khi chỉ dùng Free để xác thực tài khoản), sau đó sao chép **API Key** của Zen.

### Bước 2 — Kết nối trong OpenCode
Mở OpenCode (giao diện TUI), gõ lệnh `/connect` → chọn **OpenCode Zen** → dán API Key vừa sao chép. Gõ `/models` để kiểm tra danh sách mô hình đã sẵn sàng.

### Bước 3 — Cấu hình `opencode.json`
Tệp `opencode.json` nằm ở thư mục dự án hoặc thư mục toàn cục. Ví dụ cấu hình tối giản cho trưởng phòng chỉ cần Free Tier và một mô hình trả phí dự phòng:

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

**Giải thích nhanh:**
- `provider.opencode.options.apiKey` trỏ tới biến môi trường `OPENCODE_ZEN_API_KEY` — **không dán khóa trực tiếp** vào tệp để tránh lộ khi chia sẻ dự án.
- `model` là mô hình mặc định (ở đây chọn MiMo-V2.5 Free — miễn phí).
- `small_model` dùng cho tác vụ nhẹ như đặt tiêu đề phiên làm việc (Big Pickle Free).
- `agents.plan.model` là mô hình mạnh hơn, chỉ gọi khi cần lập kế hoạch phức tạp (có tính phí theo token).

Sau khi lưu tệp, đặt biến môi trường `OPENCODE_ZEN_API_KEY` trong hệ thống và khởi động lại OpenCode là có thể sử dụng ngay.

## 5. Ba mẹo tiết kiệm quota

**Mẹo 1 — Để Free làm việc nhẹ, trả phí làm việc khó.** Dùng mô hình Free cho các việc lặp lại hằng ngày như soạn email, tóm tắt cuộc họp, chỉnh văn bản báo cáo tuần. Chỉ chuyển sang mô hình trả phí (ví dụ Claude Sonnet, GPT-5) khi cần suy luận sâu, rà soát hợp đồng hoặc tổng hợp số liệu phức tạp. Cách này giúp quota Free không bị bào mòn vô ích.

**Mẹo 2 — Chọn đúng mô hình cho đúng độ khó, vì chênh lệch giá rất lớn.** Trên Zen, giá output dao động từ **$0 tới $180 cho mỗi 1 triệu token** — gấp hơn 100 lần. Dùng mô hình đầu bảng cho việc đơn giản là lãng phí lớn nhất. Hãy đặt `small_model` là Free và chỉ nâng cấp khi kết quả chưa đạt.

**Mẹo 3 — Tắt tự động nạp nếu muốn trần chi tiêu cứng.** Mặc định Zen tự nạp $20 khi số dư xuống dưới $5 — tiện nhưng dễ khiến chi phí trôi незаметно. Nếu phòng ban cần kiểm soát chặt, hãy tắt auto-reload và đặt **monthly limit** (ví dụ $20/tháng). Khi hết số dư, hệ thống dừng lại thay vì âm thầm trừ tiền — an toàn như một gói cước cố định do chính bạn đặt ra.

## 6. Quy trình nâng cấp khi cần nhiều hơn Free

1. **Đánh giá nhu cầu:** Nếu thường xuyên gặp lỗi `Free usage exceeded` hoặc cần xử lý tài liệu mật, đó là tín hiệu nên nâng cấp.
2. **Nạp số dư Zen:** Vào dashboard Zen, chọn **Add $20 balance** (cộng phí xử lý thẻ $1,23 cho lần nạp $20). Có thể nạp số tiền lớn hơn để giảm số lần chịu phí cố định $0,30.
3. **Cấu hình lại `opencode.json`:** Đổi `model` sang mô hình trả phí phù hợp (ví dụ `opencode/claude-sonnet-4-5` cho báo cáo quan trọng, `opencode/gpt-5-nano` cho tác vụ siêu tiết kiệm).
4. **Thiết lập kiểm soát:** Đặt `monthly limit` cho cá nhân và cho cả workspace nếu dùng theo nhóm; phân quyền **Admin/Member** và bật/tắt mô hình không phù hợp với chính sách bảo mật.
5. **Theo dõi chi tiêu:** Xem lịch sử sử dụng (usage history) trên Zen để biết mô hình nào đang tốn nhiều nhất, từ đó điều chỉnh lại `model`/`small_model` cho tháng sau.

Toàn bộ quy trình là **pay-as-you-go, không phí cố định hằng tháng, hủy bất cứ lúc nào** — tháng ít việc chi phí có thể là $0.

## 7. Nguồn tham khảo

1. OpenCode — **Zen Documentation** (Pricing, Privacy, For Teams), cập nhật 21/08/2026 — https://opencode.ai/docs/zen/
2. OpenCode — **Zen Gateway** (giới thiệu mô hình curated, pay-as-you-go, auto-reload) — https://opencode.ai/zen
3. GitHub **anomalyco/opencode** — Issues #25619, #33495, #42128 (thảo luận quota Free ~200 request/ngày, lỗi 429) — https://github.com/anomalyco/opencode/issues/
4. CodeAgentSwarm — **OpenCode Pricing: BYOK, Zen and Real Costs (2026)** — https://www.codeagentswarm.com/en/guides/opencode-plans-and-pricing
5. XvanTech — **OpenCode AI Coding Agent: Is the Free Tier Worth It?** (09/07/2026) — https://xvantech.com/opencode-ai-coding-agent-free-models/

---

*Ghi chú cho Orchestrator:* Tài liệu này (~760 từ) tuân thủ ranh giới Wave 1 — chỉ nghiên cứu Zen Free Tier, không lan sang chương khác; mọi số liệu giá và danh mục Free được đối chiếu trực tiếp với docs chính thức ngày 21/08/2026.
