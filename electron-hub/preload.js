"use strict";

// Preload an toàn cho CencomOS Gara Desktop (Electron).
// Chạy trong isolated context (contextIsolation: true) — chỉ phơi bày API tối thiểu qua contextBridge.
// KHÔNG expose: ipcRenderer thô, require, process, hay file system.

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("versions", {
  node: process.versions.node,
  electron: process.versions.electron,
  platform: process.platform,
});
