# CencomOS Garage — Fallback Launcher bằng C (Win32 + WebView2)

Launcher kiosk **dự phòng (fallback)** viết bằng ngôn ngữ C thuần (Win32), dùng khi bản Tauri (`src-tauri/`) chưa build được. Mở web app CencomOS Garage fullscreen, tự động kết nối lại khi mạng lỗi.

## Mục đích

| Bản | File | Dùng khi |
|---|---|---|
| Chính (WebView2) | `cencom-launcher.exe` | Máy có WebView2 Runtime (Windows 10/11 thường có sẵn qua Edge). Cửa sổ kiosk đúng nghĩa: không viền, fullscreen, tắt DevTools. |
| Tối giản (Edge) | `cencom-launcher-simple.exe` | Fallback cuối cùng — chỉ cần máy có Microsoft Edge. Mở URL bằng `--app=` mode của Edge. |

Cả hai đều đọc URL từ file `config.json` **đặt cạnh file exe**:

```json
{ "url": "http://garage.local" }
```

Nếu thiếu file hoặc URL không hợp lệ → dùng mặc định `http://garage.local`. Chỉ chấp nhận tiền tố `http://` / `https://`, chặn ký tự nháy đơn/nháy kép (chống injection).

## Cấu trúc thư mục

```
DesktopLauncher/fallback-c/
├── main.c                # Launcher kiosk WebView2 (chính)
├── main-simple.c         # Launcher tối giản dùng Edge (dự phòng)
├── build.ps1             # Script build bằng MinGW gcc
├── cencom-launcher.nsi   # Script NSIS tạo installer (chạy bằng makensis)
└── README-fallback.md    # File này
```

Sau khi build: các file output nằm trong `fallback-c/bin/` (gồm `WebView2Loader.dll`).

## Cách build

**Điều kiện:** máy phải có MinGW-w64 `gcc` (bản mới, khuyến nghị GCC 13+).

```powershell
cd DesktopLauncher\fallback-c
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

`build.ps1` tự động:
1. Tìm `gcc.exe` trong `%TEMP%\tauri_setup\mingw` (đệ quy) hoặc trong `PATH`; nếu không có → in lỗi "thiếu gcc, cần tải MinGW" và thoát (không tự tải MinGW).
2. Nếu thiếu `WebView2Loader.dll` hoặc `WebView2.h`: tải package `Microsoft.Web.WebView2` từ NuGet (package hiện tại ~9MB vì gom chung DLL cho x64/x86/arm64 + static lib; phần ta cần là `WebView2Loader.dll` x64 chỉ ~160KB), giải nén rồi lấy header + `build\native\x64\WebView2Loader.dll`. Package sẽ chỉ được tải **một lần** và được cache trong `%TEMP%\webview2_nuget`.
3. Tự tạo `EventToken.h` fallback (WebView2.h mới require header này nhưng NuGet không ship).
4. Biên dịch 2 exe và copy `WebView2Loader.dll` cạnh `cencom-launcher.exe`.

Kết quả trong `fallback-c/bin/`:

```
bin/
├── cencom-launcher.exe        # Launcher chính (WebView2)
├── cencom-launcher-simple.exe # Launcher tối giản (Edge)
└── WebView2Loader.dll         # Bắt buộc cạnh cencom-launcher.exe
```

### Nếu chưa có MinGW

Tải một bản MinGW-w64 (ví dụ từ <https://github.com/niXman/mingw-builds-binaries/releases> hoặc <https://winlibs.com/>), giải nén rồi:
- thêm thư mục `bin/` vào `PATH`, **hoặc**
- giải nén vào `%TEMP%\tauri_setup\mingw` (nơi `build.ps1` sẽ tìm thấy).

Lưu ý: cần MinGW-w64 **mới** (GCC 13+) vì `WebView2.h` mới yêu cầu `rpcndr.h` phiên bản cao.

## Cách dùng

1. Đặt `cencom-launcher.exe` + `WebView2Loader.dll` ở cùng thư mục (hoặc chạy installer bên dưới).
2. Đặt `config.json` cạnh exe với URL cần mở (không có → `http://garage.local`).
3. Chạy `cencom-launcher.exe`.

Hành vi kiosk (bản chính):
- Cửa sổ không viền (`WS_POPUP`), fullscreen bằng kích thước màn hình.
- Nếu không tải được trang (mất mạng / server chưa lên) → tự retry sau **5 giây**, lặp vô hạn tới khi thành công.
- Tắt DevTools; nền tối (`RGB(15,23,42)`) tránh nhấp nháy trắng.
- Thoát: phím `ESC` hoặc `Alt+F4` (dùng cho admin; bỏ xử lý `ESC` trong `main.c` nếu muốn kiosk thuần).

### Chạy bản tối giản

```powershell
.\cencom-launcher-simple.exe
```

Mở Edge ở chế độ app (`--app=<url> --new-window`). Nếu không tìm thấy `msedge.exe`, sẽ mở URL bằng trình duyệt mặc định.

## Tạo installer (tùy chọn)

Sau khi có `bin/`, dùng NSIS (makensis) để tạo bộ cài đặt:

```powershell
makensis cencom-launcher.nsi
```

- Cài `cencom-launcher.exe` + `WebView2Loader.dll` (+ `cencom-launcher-simple.exe` nếu chọn) vào `%ProgramFiles%\CencomOS Garage`.
- Tạo shortcut Desktop trỏ tới `cencom-launcher.exe` (hoặc `-simple` nếu chọn mục tương ứng).
- Gỡ cài đặt qua "Add or Remove Programs".

## Gỡ rối

| Hiện tượng | Nguyên nhân / xử lý |
|---|---|
| "Thiếu gcc" khi chạy build.ps1 | Chưa cài MinGW-w64 — tải về, giải nén vào `%TEMP%\tauri_setup\mingw` hoặc thêm vào PATH. |
| "Thiếu WebView2Loader.dll" khi chạy exe | Chưa build (chưa có bin/) hoặc exe bị tách khỏi DLL — luôn giữ 2 file cạnh nhau. |
| "Khoi tao WebView2 that bai" | Máy chưa có WebView2 Runtime — cài từ <https://developer.microsoft.com/microsoft-edge/webview2/> hoặc chuyển sang `cencom-launcher-simple.exe`. |
| Màn hình trắng lúc khởi động, rồi tự hồi phục | Đang retry (5 giây/lần) do chưa kết nối được server. |