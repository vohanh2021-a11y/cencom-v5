// CencomOS Garage LAN launcher — Tauri v2, cửa sổ kiosk (không thanh địa chỉ).
//
// Luồng:
//   1. Đọc config.json (cạnh tệp thực thi, fallback thư mục hiện tại).
//   2. Validate URL (chỉ http/https) qua module `config`.
//   3. Mở cửa sổ kiosk loading `splash.html`, inject URL an toàn.
//   4. Splash (JS) tự probe và chuyển hướng sang web garage khi có mạng.

mod config;

use tauri::{WebviewUrl, WebviewWindowBuilder};

const SPLASH: &str = "splash.html";
const DEFAULT_URL: &str = "http://garage.local";

/// Thử ghi log vào một đường dẫn; trả true nếu thành công.
fn try_write_log(path: &std::path::Path, msg: &str) -> bool {
    use std::io::Write;
    match std::fs::OpenOptions::new().create(true).append(true).open(path) {
        Ok(mut f) => {
            let secs = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            let _ = writeln!(f, "[{}] {}", secs, msg);
            true
        }
        Err(e) => {
            eprintln!("[log] cannot write {:?}: {}", path, e);
            false
        }
    }
}

/// Ghi một dòng vào launcher.log — thử lần lượt: cạnh exe (thư mục cài
/// per-user của NSIS luôn ghi được) → thư mục temp → thư mục hiện tại.
/// Dùng để hỗ trợ sản xuất: biết app đang dùng URL/config nào.
fn log_line(msg: &str) {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            if try_write_log(&dir.join("launcher.log"), msg) {
                return;
            }
        }
    }
    if try_write_log(&std::env::temp_dir().join("launcher.log"), msg) {
        return;
    }
    let cwd = std::env::current_dir().unwrap_or_default();
    let _ = try_write_log(&cwd.join("launcher.log"), msg);
}

fn main() {
    log_line("launcher starting (main entry)");
    tauri::Builder::default()
        .setup(|app| {
            let url = resolve_url();

            let win = WebviewWindowBuilder::new(app, "main", WebviewUrl::App(SPLASH.into()))
                .title("CencomOS Garage")
                .decorations(false)
                .devtools(false)
                .fullscreen(true)
                .resizable(false)
                .build()
                .expect("Tạo cửa sổ thất bại");

            // Inject URL đã validate (không chứa dấu nháy nhờ parse_config).
            let script = format!("window.__GARAGE_URL__ = '{}';", url);
            win.eval(&script).expect("Inject URL vào webview thất bại");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Lỗi chạy ứng dụng");
}

/// Đọc và validate config.json; nếu thiếu/lỗi thì dùng DEFAULT_URL (graceful).
fn resolve_url() -> String {
    let path = config_path();
    match std::fs::read_to_string(&path) {
        Ok(content) => match config::parse_config(&content) {
            Ok(url) => {
                println!("[launcher] Dùng URL từ config: {}", url);
                log_line(&format!("config OK: {} -> {}", path.display(), url));
                url
            }
            Err(e) => {
                eprintln!(
                    "[launcher] WARN config không hợp lệ ({}). Dùng mặc định: {}",
                    e, DEFAULT_URL
                );
                log_line(&format!("config INVALID ({}): {} -> default {}", e, path.display(), DEFAULT_URL));
                DEFAULT_URL.to_string()
            }
        },
        Err(e) => {
            eprintln!(
                "[launcher] WARN không đọc được {:?} ({}). Dùng mặc định: {}",
                path, e, DEFAULT_URL
            );
            log_line(&format!("config NOT FOUND ({:?}): {} -> default {}", path, e, DEFAULT_URL));
            DEFAULT_URL.to_string()
        }
    }
}

/// Tìm config.json theo thứ tự: (1) cạnh tệp thực thi, (2) thư mục `_up_`
/// (nơi NSIS installer của Tauri v2 đặt `bundle.resources` khi cài),
/// (3) thư mục `resources` (bản chạy từ target), (4) thư mục hiện tại.
fn config_path() -> std::path::PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let candidates = [
                dir.join("config.json"),
                dir.join("_up_").join("config.json"),
                dir.join("resources").join("config.json"),
            ];
            for p in candidates {
                if p.exists() {
                    return p;
                }
            }
        }
    }
    std::path::PathBuf::from("config.json")
}
