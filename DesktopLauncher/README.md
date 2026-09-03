# CencomOS Garage Launcher (DesktopLauncher)

App Windows cực nhẹ, bấm icon là mở thẳng giao diện web garage trên LAN trong
**cửa sổ riêng (kiosk — không lộ thanh địa chỉ)**, không cần nhớ IP.

- Công nghệ: **Tauri v2** (Rust + WebView2). Exe ~21 MB, bộ cài NSIS ~3.6 MB.
- URL lấy từ `config.json` → đổi IP chỉ sửa file, không rebuild.
- Tự động kết nối lại (splash "Đang kết nối…" + retry 5s) khi server chưa bật.
- Bộ cài NSIS **kèm sẵn `config.json`** (đặt vào `resources/`), không cần chỉnh sau cài.

## 1. Yêu cầu môi trường (máy dev để build)
- Rust (cargo + rustc, target `x86_64-pc-windows-gnu`) + linker MinGW-w64.
- Node.js ≥ 18, npm.
- Windows 10/11 (client có sẵn WebView2 Runtime).

> ✅ **Đã BUILD THÀNH CÔNG trên máy dev này (2026-08-18)** với toolchain per-user
> (không cần admin): MinGW-w64 15.3.0 (winlibs) + Rust stable-gnu 1.97.1.
> Khi build cần PATH: `%USERPROFILE%\.cargo\bin` và
> `%TEMP%\tauri_setup\mingw\mingw64\bin` — `scripts/build-all.ps1` đã tự thêm.

## 2. Cấu hình IP tĩnh + tên miền nội bộ (bắt buộc cho PA A)
App mặc định mở `http://garage.local`. Để tên này phân giải được:

1. **Server on-premise đặt IP tĩnh thật** (static IP trên server, hoặc DHCP
   Reservation theo MAC trong router). *Không* dựa vào DHCP tự động — tắt/bật
   lại server sẽ bị cấp IP khác.
2. Trên mỗi máy client, sửa `C:\Windows\System32\drivers\etc\hosts` thêm:
   ```
   192.168.1.10   garage.local
   ```
   (thay `192.168.1.10` bằng IP tĩnh đã đặt).
3. Hoặc đơn giản hơn: sửa `config.json` điền thẳng IP tĩnh, bỏ bước hosts:
   ```json
   { "url": "http://192.168.1.10" }
   ```

## 3. Build & phát hành (đã xác nhận chạy)
```bash
cd DesktopLauncher
npm install
node scripts/gen-icon.mjs      # sinh icon (đã có, chạy lại nếu đổi logo)
npx tauri build                # đóng gói
```
Output đã tạo (2026-08-18):
- App: `src-tauri\target\release\desktop-launcher.exe` (21.1 MB)
- Bộ cài: `src-tauri\target\release\bundle\nsis\CencomOS Garage Launcher_0.1.0_x64-setup.exe` (3.6 MB)
- Unit test: `cargo test --release` = **8/8 PASS**
- Shortcut Desktop: `scripts/create-desktop-shortcut.ps1` (đã chạy → tạo
  "CencomOS Garage.lnk")
- **WebView2Loader.dll (156 KB) được đóng gói cạnh exe khi cài** qua NSIS hook
  (`src-tauri/nsis-hooks.generated.nsh` do `scripts/gen-nsis-hooks.ps1` sinh,
  config `bundle.windows.nsis.installerHooks`) — **bắt buộc với build
  windows-gnu**: thiếu DLL app chết ngay `0xC0000135` (main chưa kịp chạy).

Chạy lại toàn bộ pipeline 1 lệnh: `powershell -ExecutionPolicy Bypass -File scripts\build-all.ps1`
(7 bước: PATH → toolchain → npm → tauri build → cargo test → tìm output).

## 4. Đổi URL / IP sau này
Chỉ sửa `config.json`. App tìm theo thứ tự: **cạnh exe** → **`_up_/config.json`**
(nơi NSIS cài `bundle.resources`) → **thư mục hiện tại**. Không cần build lại.

> App tự xử lý UTF-8 BOM (Notepad / PowerShell lưu kèm BOM vẫn đọc được —
> `parse_config` strip BOM trước khi parse).

## 5. Dùng ngay mà không cần build (fallback Edge --app)
Mở file `launcher-edge.cmd` (hoặc tạo shortcut Desktop trỏ đến):
```
msedge.exe --app=http://garage.local --new-window
```
Edge `--app` mở cửa sổ không thanh địa chỉ, trông như app native. Không cần
cài gì (Edge có sẵn trên Win10/11).

## 6. Bảo mật (Gatekeeper)
- URL đọc từ `config.json`, **không hardcode** secret.
- `parse_config` chỉ chấp nhận scheme `http/https`, từ chối `file://`,
  `javascript:`, và dấu nháy (chặn injection khi inject vào webview).
- `devtools:false`, cửa sổ `decorations:false` (kiosk).
- CSP cơ bản trong `tauri.conf.json`.

## 7. Kiểm thử
- Unit test `parse_config` (Rust): `cargo test --release` trong `src-tauri` = **8/8 PASS**
  (http hợp lệ, https kèm port, thiếu trường, JSON sai, chặn `file://`,
  `javascript:`, dấu nháy, chấp nhận UTF-8 BOM).
- **Nghiệm thu thực tế trên máy (2026-08-18)**:
  - Cài silent + gỡ + cài lại bộ `.exe`: exit 0; thư mục
    `%LOCALAPPDATA%\CencomOS Garage Launcher\` đầy đủ (exe + `WebView2Loader.dll`
    + `_up_\config.json` + uninstaller).
  - App chạy từ thư mục cài **và** từ Start Menu shortcut: process sống, kiosk mở.
  - `launcher.log` (cạnh exe) xác nhận `config OK: ...\_up_\config.json -> http://...`.
  - Đổi `config.json` sang IP khác (có BOM lẫn không BOM): app dùng URL mới —
    đúng hành vi "đổi IP không cần rebuild".
