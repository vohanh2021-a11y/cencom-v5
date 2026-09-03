# AI_CONTEXT — Lịch sử trao đổi & quyết định (DesktopLauncher)

> File này ghi lại TOÀN BỘ quá trình yêu cầu → thiết kế → quyết định của tính
> năng DesktopLauncher, để AI (hoặc người) sau này đọc hiểu ngữ cảnh mà không
> cần hỏi lại. Cập nhật: 2026-08-18.

## 1. Yêu cầu gốc (người dùng)
- Muốn một app nhẹ, bấm trên desktop là vào thẳng đường link local LAN,
  **không cần nhớ đường link IP**.
- Môi trường: Windows. Khi bấm muốn mở bằng **app cửa sổ riêng (kiosk)**,
  không lộ thanh địa chỉ/toolbar.
- URL LAN: **chưa chốt** ban đầu.

## 2. Các câu hỏi làm rõ & câu trả lời
- OS client: **Windows**.
- Cách mở: **App cửa sổ riêng (kiosk)** → chọn Tauri (WebView2) thay vì shortcut
  hay Electron (nặng).
- URL cố định không: **chưa chốt** → đề xuất PA A.

## 3. Thảo luận về IP tĩnh (quan trọng)
- Người dùng hỏi: "Trong LAN IP luôn tĩnh đúng không? Có khi nào thay đổi?"
- AI giải thích: DHCP tự động **có thể đổi IP** khi router reboot / lease hết /
  server tắt lâu / đổi MAC. "Tĩnh" phải là **tĩnh thật**.
- Người dùng băn khoăn: tắt điện bật lại → IP mới → rõ ràng không tĩnh (vì máy
  không chạy 24/24).
- AI đề xuất 2 cách IP thật không đổi: (1) DHCP Reservation theo MAC, hoặc
  (2) set static IP thủ công trên server.
- Nếu không muốn đụng network: app tự tìm server (mDNS `garage.local` hoặc quét
  LAN). Người dùng chọn **PA A + set IP tĩnh**.

## 4. Quyết định cuối (được duyệt)
- Làm app **Tauri v2**, thư mục con `DesktopLauncher/`.
- **PA A + IP tĩnh thật**: server đặt IP tĩnh; app mở URL từ `config.json`
  (mặc định `http://garage.local`). Hosts file hoặc điền thẳng IP.
- Tạo **bộ cài NSIS** (shortcut Desktop).
- Ghi lại toàn bộ trao đổi vào thư mục (file này) cho AI sau.

## 5. Phát hiện rào cản môi trường (khi bắt đầu build)
- Node v24 có sẵn. **Rust (cargo/rustc) chưa cài**.
- Máy **không có quyền admin**, **không có winget**, **không có compiler**
  (MSVC `cl.exe` / MinGW `gcc` đều không có).
- Hỏi người dùng → chọn **"Tự cài Rust rồi build"**.
- Hướng xử lý: vẫn viết **toàn bộ code Tauri hoàn chỉnh** (để build sau trên máy
  đủ quyền) + tạo **launcher Edge `--app`** (zero-build) dùng ngay hôm nay +
  thử cài Rust per-user + MinGW portable (không admin) để build tại chỗ nếu khả thi.

## 6. Cấu trúc đã tạo
```
DesktopLauncher/
  package.json            # scripts + @tauri-apps/cli
  config.json             # {"url":"http://garage.local"}  (đổi IP ở đây)
  src-tauri/
    Cargo.toml
    build.rs
    tauri.conf.json       # kiosk + NSIS + CSP
    capabilities/default.json
    icons/icon.ico        # sinh bởi scripts/gen-icon.mjs
    src/
      config.rs           # parse_config + validate + unit test
      main.rs             # load config -> kiosk window -> inject URL
  public/
    splash.html           # "Đang kết nối…" + JS tự reconnect
    icon.png
  scripts/gen-icon.mjs    # sinh icon thuần Node
  launcher-edge.cmd       # fallback Edge --app (dùng ngay, không build)
  README.md
  AI_CONTEXT.md           # file này
```

## 7. Lưu ý bảo mật đã áp dụng
- `parse_config` chỉ nhận `http/https`, chặn `file://`/`javascript:`/dấu nháy.
- `devtools:false`, `decorations:false` (kiosk).
- CSP cơ bản.
- Không hardcode secret.

## 8. KẾT QUẢ BUILD (2026-08-18) — HOÀN THÀNH ✅
- [x] Cài toolchain per-user (không admin): MinGW-w64 15.3.0 (winlibs) →
      `%TEMP%\tauri_setup\mingw\mingw64\bin`; rustup `stable-x86_64-pc-windows-gnu`
      (rustc/cargo 1.97.1) → `%USERPROFILE%\.cargo\bin`; node_modules OK
      (@tauri-apps/cli 2.11.4).
- [x] `npx tauri build` **THÀNH CÔNG** (exit 0): exe 21.1 MB +
      NSIS installer 3.6 MB
      (`bundle\nsis\CencomOS Garage Launcher_0.1.0_x64-setup.exe`).
- [x] `cargo test --release` = **7/7 PASS** (validate URL + chặn injection).
- [x] `config.json` đóng gói vào bộ cài qua `bundle.resources`; `config_path` đọc
      theo thứ tự: exe dir → `_up_/` (nơi NSIS thực sự đặt resources!) → `resources/` → cwd.
- [x] **BUG SẢN XUẤT đã lộ ra khi nghiệm thu & fix**:
  1. **Thiếu WebView2Loader.dll**: app cài chết ngay `0xC0000135
     STATUS_DLL_NOT_FOUND` (loader fail — main() không hề chạy; mọi test
     "ALIVE" trước đó chỉ đúng vì PATH session có sẵn DLL). Fix: NSIS
     **installerHooks** (`NSIS_HOOK_POSTINSTALL`, tên macro KHÔNG có suffix `_`
     theo template 2.11) copy DLL cạnh exe khi cài. Config:
     `bundle.windows.nsis.installerHooks` = file do `scripts/gen-nsis-hooks.ps1`
     sinh. Đã xác minh: sau cài, thư mục có `WebView2Loader.dll` (156 KB),
     app chạy + ghi log.
  2. **UTF-8 BOM**: Notepad/PowerShell lưu config kèm BOM → serde_json từ chối
     ("expected value at line 1 column 1") → app fallback mặc định. Fix:
     `parse_config` strip `\u{feff}`; thêm test `accepts_utf8_bom` (8/8 PASS).
- [x] **launcher.log**: app ghi log cạnh exe (`log_line`, thử exe dir → temp → cwd)
      — hỗ trợ sản xuất (biết app dùng URL nào). Bằng chứng nghiệm thu:
      `config OK: C:\Users\Admin\AppData\Local\CencomOS Garage Launcher\_up_\config.json -> http://garage.local`.
- [x] Sửa bug `scripts/build-all.ps1`: `Start-Process -RedirectStandardOutput`
      trả `ExitCode` rỗng trên PowerShell 5.1 → chuyển sang `& exe 2>&1 |
      ForEach-Object` + `$LASTEXITCODE` (đã test: bắt đúng exit 7 và 0).
      Bước 5/6 check nhầm `$LASTEXITCODE` thay vì `$rc` → đã sửa.
      Bước 5 giờ tự gọi `gen-nsis-hooks.ps1` trước khi `npx tauri build`.
- [x] Khởi động thử exe thật: process sống sau 6s, cửa sổ kiosk mở.
- Lỗi gặp khi build & cách xử lý:
  1. cargo không có PATH trong phiên npx → set PATH trước khi chạy.
  2. `devUrl` phải là URI → đã bỏ khỏi `tauri.conf.json`.
  3. `nsis.createDesktopShortcut` không tồn tại trong Tauri 2.11 → `nsis` object
     (installerHooks) + tạo shortcut .lnk bằng script riêng.
  4. Cảnh báo `.rsrc merge failure: multiple non-default manifests` của linker
     GNU là benign (đã xác nhận build thành công, exit 0).

## 9. NGHIỆM THU CUỐI (2026-08-18) — CÀI THẬT LÊN MÁY ✅
- Cài silent (`/S`) → gỡ → cài lại: exit 0 mọi bước; cấu trúc cài đặt đầy đủ:
  `desktop-launcher.exe` + `WebView2Loader.dll` + `_up_\config.json` + `uninstall.exe`.
- Chạy từ thư mục cài và từ Start Menu shortcut (`CencomOS Garage Launcher.lnk`):
  process sống, kiosk mở.
- `launcher.log` xác nhận đọc đúng config bản cài (`_up_\config.json`).
- Đổi URL sau cài (có/không BOM): app dùng URL mới — mục tiêu "đổi IP không
  rebuild" đạt.

## 10. Bước tiếp theo (tùy chọn)
- Tự chạy cùng Windows (Startup folder) nếu nhân viên thích.
- Đóng gói hướng dẫn "đặt IP tĩnh" 1 trang cho quản trị mạng.
- Thử nghiệm thật trên máy client: cài bộ .exe → bấm icon → vào thẳng web garage.
