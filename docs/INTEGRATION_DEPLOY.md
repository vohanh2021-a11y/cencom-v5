# NHẮC TRIỂN KHAI — Liên thông Gara ↔ Cover Platform (mẹ)

> **Đọc file này mỗi khi**: cài máy HUB/Spoke mới, thêm chi nhánh xưởng (hiện 1/5 điểm), cấp/quay site-key, bật Cloudflare Tunnel, hoặc nối thêm app con khác.
> Bản giao thức phía mẹ: `cencom-cover-platform/docs/PROTOCOL_APP_CON.md` (đọc cặp với file này).

## 1. Nguyên tắc vàng (đừng phá vỡ)

1. **Nhập liệu ở con, quản trị ở mẹ** — mẹ KHÔNG clone DB con.
2. **PUSH sự kiện** (con → mẹ, lưu nhẹ `site_daily_kpi`) + **PULL chi tiết** (mẹ → con, không lưu).
3. **MCP chỉ cho AI hỏi**, không dùng lấy báo cáo định kỳ.
4. **Integration API v1 của con là read-only tuyệt đối** — mẹ không bao giờ ghi sang con.

## 2. Checklist cài 1 chi nhánh xưởng mới (Hub + Spoke + nối mẹ)

- [ ] **HUB**: chạy `CencomOS Gara Hub Setup 5.4.0.exe` → mở app → tự `initdb` (`%APPDATA%/CencomOS/hub-data`) → login `admin/cencom@123` → đổi mật khẩu ngay
- [ ] **HUB**: `Cài đặt → AI` → nhập key zen + model `mimo-v2.5` → Test OK (nếu chi nhánh cần AI)
- [ ] **HUB**: ghi lại IP LAN (vd `192.168.1.10`) + port PG 5433 + web 3000 + MCP 3001
- [ ] **Spoke** (mỗi máy trạm): chạy `Spoke Setup` → nhập IP HUB → login → test rút dây 30s → badge Offline → cắm lại → Đồng bộ
- [ ] **Site-key**: xin mẹ 1 `site_id` + `site_key` riêng (vd `site_id=gara-cn1`) → nhập vào HUB `Cài đặt → Liên thông` (khi có UI; hiện tại lưu `config` key `site_id/site_key`)
- [ ] **Verify PULL**: từ mẹ `GET http(s)://<HUB_IP>:3000/api/integration/v1/kpi/today` kèm `X-Site-Key` → 200
- [ ] **Verify PUSH**: tạo + quyết toán 1 SC test → mẹ nhận event `sc.settled` trong 1 phút (`site_daily_kpi` +1)
- [ ] **MCP LAN**: trưởng phòng trỏ `http://<HUB_IP>:3001/mcp` + Bearer `MCP_API_KEY` → `tools/call dashboardAll` OK
- [ ] **Sao lưu**: copy 1 file `.dump` đầu tiên ra USB + hẹn Task Scheduler 23:00 hàng ngày
- [ ] **Tunnel** (làm sau): `cloudflared tunnel --url http://localhost:3000` + token → báo mẹ URL công khai

## 3. Sự cố thường gặp

| Dấu hiệu | Kiểm tra |
|---|---|
| Mẹ báo site offline | HUB có mở app không? LAN ảo (Tailscale) còn kết nối? site-key hết hạn? |
| KPI mẹ lệch con | So `sync_log` (con) vs log `fireWebhook` (mẹ) theo `event_id`; event nào thiếu thì con retry (idempotent, không trùng) |
| Spoke không đồng bộ | IP HUB đổi? HUB tắt app? `hub-boot.log` có lỗi `pg_ctl`? |
| Antivirus chặn Hub | Whitelist `%APPDATA%/CencomOS` + `postgres.exe` + `initdb` lần đầu |

## 4. Khi nối app con khác (không phải gara)

Mỗi app con mới lặp lại mẫu này: đọc `PROTOCOL_APP_CON.md` bên mẹ → implement 4 endpoint PULL + 4 event PUSH → đăng ký `site_registry` → verify 7 bước mục 2 (bỏ bước Spoke nếu app đó không có trạm).

---
*Gắn với: plan_4.9 (Hub-and-Spoke), PLAN_HELP.md (tab Đồng bộ/MCP), Onpremise/smoke_onpremise.mjs*
