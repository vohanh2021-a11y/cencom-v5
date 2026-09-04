"use strict";

// main.js — CencomOS Gara Desktop (Electron wrapper cho Next.js standalone).
// CommonJS — KHÔNG dùng ES import.
// Dev:  loadURL http://localhost:3000 (server Next do script `npm run dev` bên ngoài chạy),
//       kèm retry-wait (thử fetch tối đa 10 lần) trước khi mở window.
// Prod: spawn `node server.js` từ .next/standalone (PORT 3000) nếu chưa có server lắng nghe,
//       rồi mới loadURL. kill tiến trình Next khi will-quit.

const { app, BrowserWindow, session, Menu, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");

const APP_URL = "http://127.0.0.1:3000";
const PORT = 3000;
const WAIT_TRIES = 10;
const WAIT_DELAY_MS = 1000;

// Hub portable PG
const PG_PORT = 5433;
function pgDataDir() {
  return path.join(app.getPath("userData"), "hub-data");
}
function pgBinDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "pg-portable", "bin");
  }
  return path.join(__dirname, "pg-portable", "bin");
}
function pgIsAvailable() {
  return fs.existsSync(path.join(pgBinDir(), process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl"));
}

const isProd = () =>
  process.env.NODE_ENV === "production" || app.isPackaged;

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {import("child_process").ChildProcess | null} */
let nextProcess = null;
let isQuitting = false;

// ---------------------------------------------------------------------------
// Single instance lock — cửa sổ thứ 2 chỉ focus cửa sổ đã mở
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Probe HTTP 1 lần: true nếu có server trả về (bất kỳ status < 500).
function probeServer() {
  return new Promise((resolve) => {
    const req = http.get(APP_URL, (res) => {
      res.resume(); // drain socket để đóng kết nối sạch
      resolve((res.statusCode || 0) < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Retry wait-on: thử fetch tối đa `tries` lần, cách nhau `delayMs`.
async function waitForServer(tries = WAIT_TRIES, delayMs = WAIT_DELAY_MS) {
  for (let i = 0; i < tries; i += 1) {
    if (await probeServer()) return true;
    if (i < tries - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return false;
}

// Vị trí thư mục Next standalone:
// - đóng gói (electron-builder extraResources): resources/standalone
// - chạy unpackaged (electron .):               ../gara_reconstruction_v5/.next/standalone
function standaloneRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "standalone");
  }
  return path.join(__dirname, "..", "gara_reconstruction_v5", ".next", "standalone");
}

// Next standalone đọc .next/static + public tương đối theo cwd → đặt cwd tại root dự án
// khi chạy unpackaged (standalone/server.js nằm trong .next/standalone nhưng .next/static
// và public nằm ngoài). Khi đóng gói, electron-builder đã copy kèm trong standalone/.
function standaloneCwd(root) {
  if (app.isPackaged) return root;
  // unpackaged: server.js mong .next/static và public nằm cạnh cwd của nó;
  // repo giữ nguyên cấu trúc .next/ nên cwd = gara_reconstruction_v5 hoạt động
  // khi Next standalone tự resolve theo __dirname của server.js. Dùng root an toàn.
  return path.join(__dirname, "..", "gara_reconstruction_v5");
}

// ----------- Hub Portable PG lifecycle -----------
const { execSync, exec } = require("child_process");
let pgStartedByUs = false;

function pgIsReady() {
  return new Promise((resolve) => {
    const bin = path.join(pgBinDir(), process.platform === "win32" ? "pg_isready.exe" : "pg_isready");
    if (!fs.existsSync(bin)) return resolve(false);
    exec(`"${bin}" -h 127.0.0.1 -p ${PG_PORT} -U postgres`, (err) => resolve(!err));
  });
}

async function ensureHubDb() {
  if (!pgIsAvailable()) {
    console.log("[hub-pg] Portable PG chưa có — dùng DB ngoài (DATABASE_URL từ env)");
    return;
  }
  const dataDir = pgDataDir();
  if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) {
    console.log("[hub-pg] initdb tại", dataDir);
    fs.mkdirSync(dataDir, { recursive: true });
    const initdb = path.join(pgBinDir(), process.platform === "win32" ? "initdb.exe" : "initdb");
    try {
      execSync(`"${initdb}" -U postgres -D "${dataDir}" --no-locale --encoding=UTF8`, { stdio: "inherit" });
    } catch (e) {
      console.error("[hub-pg] initdb lỗi:", e.message);
    }
  }
  if (await pgIsReady()) {
    console.log("[hub-pg] PG đã chạy");
    return;
  }
  console.log("[hub-pg] pg_ctl start...");
  const pgCtl = path.join(pgBinDir(), process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl");
  const logFile = path.join(dataDir, "hub-pg.log");
  try {
    execSync(`"${pgCtl}" -D "${dataDir}" -l "${logFile}" -o "-p ${PG_PORT}" start`, { stdio: "inherit" });
    pgStartedByUs = true;
    // chờ ready
    for (let i = 0; i < 10; i++) {
      if (await pgIsReady()) break;
      await new Promise((r) => setTimeout(r, 500));
    }
  } catch (e) {
    console.error("[hub-pg] pg_ctl start lỗi:", e.message);
  }
}

function stopHubDb() {
  if (!pgStartedByUs || !pgIsAvailable()) return;
  const pgCtl = path.join(pgBinDir(), process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl");
  const dataDir = pgDataDir();
  try {
    execSync(`"${pgCtl}" -D "${dataDir}" stop`, { stdio: "ignore" });
    console.log("[hub-pg] stopped");
  } catch (_) {}
}

// Spawn tiến trình Next standalone (production).
function startNextServer() {
  const root = standaloneRoot();
  const serverJs = path.join(root, "server.js");
  if (!fs.existsSync(serverJs)) {
    console.error(`[gara] Không tìm thấy Next standalone tại: ${serverJs}`);
    return false;
  }
  const hubDbUrl = `postgres://postgres:postgres@127.0.0.1:${PG_PORT}/cencom`;
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(PORT),
    HOSTNAME: "127.0.0.1",
    DATABASE_URL: process.env.DATABASE_URL || (pgIsAvailable() ? hubDbUrl : process.env.DATABASE_URL),
    SESSION_SECRET: process.env.SESSION_SECRET || "hub-dev-secret-change-me",
  };
  // đảm bảo DATABASE_URL luôn có khi Hub tự chứa PG
  if (pgIsAvailable() && !process.env.DATABASE_URL) {
    env.DATABASE_URL = hubDbUrl;
  }
  try {
    nextProcess = spawn(process.execPath, [serverJs], {
      cwd: standaloneCwd(root),
      env,
      // ELECTRON_RUN_AS_NODE: chạy electron.exe ở chế độ Node thuần (không cần node hệ thống)
      stdio: ["ignore", "inherit", "inherit"],
      windowsHide: true,
    });
    nextProcess.on("exit", (code, signal) => {
      console.log(`[gara] Next server kết thúc (code=${code} signal=${signal})`);
      nextProcess = null;
      if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("server-exited", { code, signal });
      }
    });
    nextProcess.on("error", (err) => {
      console.error("[gara] Lỗi spawn Next server:", err.message);
      nextProcess = null;
    });
    return true;
  } catch (err) {
    console.error("[gara] Không spawn được Next server:", err);
    return false;
  }
}

// Kill cây tiến trình Next khi thoát app (Windows: taskkill /T /F; Unix: SIGTERM).
function killNextServer() {
  if (!nextProcess || nextProcess.killed) return;
  const pid = nextProcess.pid;
  try {
    if (process.platform === "win32" && pid) {
      require("child_process").exec(`taskkill /pid ${pid} /T /F`, () => {});
    } else if (pid) {
      process.kill(pid, "SIGTERM");
    }
  } catch (err) {
    console.error("[gara] kill Next server thất bại:", err);
  }
  try {
    nextProcess.kill();
  } catch (_) {
    /* đã chết */
  }
  nextProcess = null;
}

// ---------------------------------------------------------------------------
// Application Menu — production-grade menu bar + keyboard shortcuts
// ---------------------------------------------------------------------------
function buildMenu() {
  const template = [
    {
      label: "Tệp",
      submenu: [
        {
          label: "Tải lại trang",
          accelerator: "CmdOrCtrl+R",
          click: () => mainWindow && mainWindow.reload(),
        },
        {
          label: "Tải lại mạnh (bỏ cache)",
          accelerator: "CmdOrCtrl+Shift+R",
          click: () => mainWindow && mainWindow.webContents.reloadIgnoringCache(),
        },
        { type: "separator" },
        {
          label: "Mở DevTools",
          accelerator: "F12",
          click: () => mainWindow && mainWindow.webContents.toggleDevTools(),
        },
        { type: "separator" },
        { role: "quit", label: "Thoát" },
      ],
    },
    {
      label: "Chỉnh sửa",
      submenu: [
        { role: "undo", label: "Hoàn tác" },
        { role: "redo", label: "Làm lại" },
        { type: "separator" },
        { role: "cut", label: "Cắt" },
        { role: "copy", label: "Sao chép" },
        { role: "paste", label: "Dán" },
        { role: "selectAll", label: "Chọn tất cả" },
      ],
    },
    {
      label: "Hiển thị",
      submenu: [
        {
          label: "Phóng to",
          accelerator: "CmdOrCtrl+=",
          click: () => {
            if (!mainWindow) return;
            const z = mainWindow.webContents.getZoomLevel();
            mainWindow.webContents.setZoomLevel(z + 0.5);
          },
        },
        {
          label: "Thu nhỏ",
          accelerator: "CmdOrCtrl+-",
          click: () => {
            if (!mainWindow) return;
            const z = mainWindow.webContents.getZoomLevel();
            mainWindow.webContents.setZoomLevel(z - 0.5);
          },
        },
        {
          label: "Reset zoom",
          accelerator: "CmdOrCtrl+0",
          click: () => mainWindow && mainWindow.webContents.setZoomLevel(0),
        },
        { type: "separator" },
        {
          label: "Toàn màn hình",
          accelerator: "F11",
          click: () => {
            if (!mainWindow) return;
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
          },
        },
        { role: "togglefullscreen", label: "Chế độ cửa sổ" },
      ],
    },
    {
      label: "Trợ giúp",
      submenu: [
        {
          label: "Về CencomOS Gara",
          click: () => showAbout(),
        },
        { type: "separator" },
        {
          label: "Tài liệu sử dụng",
          click: () => shell.openExternal("https://github.com/vohanh2021-a11y/cencom-v5"),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// About dialog
function showAbout() {
  const pkg = require(path.join(__dirname, "package.json"));
  dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "Về CencomOS Gara",
    message: "CencomOS Gara Desktop",
    detail: [
      `Phiên bản: ${pkg.version || "5.2.0"}`,
      "Hệ thống quản lý & giám sát xe đầu kéo",
      "Built with Electron + Next.js + PostgreSQL",
      "",
      "© 2024 CencomOS Team",
    ].join("\n"),
    buttons: ["Đóng"],
  });
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "icon-512.png")
    : path.join(__dirname, "..", "gara_reconstruction_v5", "public", "icon-512.png");

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: "CencomOS Gara",
    show: false,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: "#0b1220",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow && mainWindow.show());

  mainWindow.loadURL(APP_URL);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Trang lỗi cục bộ khi không kết nối được Next server (tránh màn hình trắng khó hiểu).
function showErrorPage(message) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const html = `data:text/html;charset=utf-8,${encodeURIComponent(
    `<!doctype html><html><head><meta charset="utf-8"><title>CencomOS Gara</title></head>` +
      `<body style="font-family:Segoe UI,sans-serif;background:#0b1220;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">` +
      `<div style="max-width:560px;text-align:center"><h1>CencomOS Gara</h1>` +
      `<p>${message}</p><p style="opacity:.7">Kiểm tra: server Next đã chạy ở cổng ${PORT}? ` +
      `Dev → <code>npm run dev:next</code>. Prod → tồn tại <code>.next/standalone/server.js</code>.</p></div></body></html>`
  )}`;
  mainWindow.loadURL(html);
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
async function bootstrap() {
  // Hub: đảm bảo PG portable chạy trước khi spawn Next
  await ensureHubDb();

  // Security cứng: chặn điều hướng ra ngoài origin app + chặn window.open tuỳ tiện.
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const ok = details.url.startsWith(APP_URL) || details.url.startsWith("data:");
    callback({ cancel: !ok });
  });

  createWindow();

  if (isProd()) {
    const up = await probeServer();
    if (!up && !startNextServer()) {
      showErrorPage("Không khởi động được server ứng dụng (thiếu .next/standalone/server.js).");
      return;
    }
  }

  // Retry wait-on: tối đa 10 lần × 1s trước khi báo lỗi.
  const ready = await waitForServer();
  if (!ready) {
    showErrorPage("Không kết nối được ứng dụng tại cổng " + PORT + " sau " + WAIT_TRIES + " lần thử.");
    return;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL(APP_URL); // chắc chắn tải lại khi server đã sẵn sàng
  }
}

app.whenReady().then(bootstrap).catch((err) => {
  console.error("[gara] bootstrap lỗi:", err);
  showErrorPage("Lỗi khởi động: " + (err && err.message ? err.message : String(err)));
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
  createWindow();
  buildMenu();
    mainWindow.loadURL(APP_URL);
  }
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("will-quit", () => {
  killNextServer();
  stopHubDb();
});

process.on("unhandledRejection", (reason) => {
  console.error("[gara] unhandledRejection:", reason);
});
