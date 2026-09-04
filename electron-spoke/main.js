"use strict";
// Spoke Thin Client — không chứa PG/Next, chỉ trỏ về HUB qua LAN
// Config hubUrl lưu tại %APPDATA%/CencomOS/spoke-config.json
// SQLite queue tại %APPDATA%/CencomOS/spoke.db

const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow = null;
const CONFIG_PATH = () => path.join(app.getPath("userData"), "spoke-config.json");
const DEFAULT_HUB = "http://192.168.1.10:3000";

function getHubUrl() {
  try {
    if (fs.existsSync(CONFIG_PATH())) {
      const j = JSON.parse(fs.readFileSync(CONFIG_PATH(), "utf8"));
      if (j.hubUrl) return j.hubUrl;
    }
  } catch {}
  return DEFAULT_HUB;
}
function setHubUrl(url) {
  fs.mkdirSync(path.dirname(CONFIG_PATH()), { recursive: true });
  fs.writeFileSync(CONFIG_PATH(), JSON.stringify({ hubUrl: url }, null, 2));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "CencomOS Gara — Spoke (Thin)",
    show: false,
    backgroundColor: "#0b1220",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());

  const hubUrl = getHubUrl();
  // Thử fetch HUB health trước, nếu fail thì hiện trang nhập IP
  mainWindow.loadURL(hubUrl).catch(() => {
    showHubConfigPage(`Không kết nối được HUB tại ${hubUrl}`);
  });
}

function showHubConfigPage(msg) {
  const html = `data:text/html;charset=utf-8,${encodeURIComponent(
    `<!doctype html><meta charset="utf-8"><title>Cấu hình Spoke</title>
     <body style="font-family:Segoe UI;background:#0b1220;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh">
     <div style="background:#1e293b;padding:32px;border-radius:12px;max-width:480px;width:90%">
       <h2>🔗 Kết nối HUB</h2><p style="opacity:.8">${msg}</p>
       <p>Nhập IP HUB (ví dụ 192.168.1.10:3000):</p>
       <input id="hub" style="width:100%;padding:10px;border-radius:6px;border:1px solid #334155;background:#0f172a;color:#fff" value="${getHubUrl().replace('http://','')}">
       <button onclick="require('electron').ipcRenderer.invoke('set-hub-url', 'http://'+document.getElementById('hub').value).then(()=>location.reload())"
         style="margin-top:16px;width:100%;padding:12px;background:#3b82f6;color:#fff;border:0;border-radius:6px;cursor:pointer">Lưu & Kết nối</button>
       <p style="opacity:.5;font-size:12px;margin-top:12px">Spoke không cần Internet, chỉ cần cùng LAN với HUB.</p>
     </div>`
  )}`;
  mainWindow.loadURL(html);
}

ipcMain.handle("get-hub-url", () => getHubUrl());
ipcMain.handle("set-hub-url", (_, url) => {
  setHubUrl(url);
  return url;
});
ipcMain.handle("show-hub-config", (_, msg) => showHubConfigPage(msg || "Cấu hình lại HUB"));

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
