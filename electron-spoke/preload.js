// preload.js — Spoke thin client
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("spokeAPI", {
  getHubUrl: () => ipcRenderer.invoke("get-hub-url"),
  setHubUrl: (url) => ipcRenderer.invoke("set-hub-url", url),
  showHubConfig: (msg) => ipcRenderer.invoke("show-hub-config", msg),
  // SQLite queue — sẽ được mở rộng khi db/sqlite.ts hoàn thiện
  queuePush: (type, payload) => ipcRenderer.invoke("queue-push", type, payload),
  queueList: () => ipcRenderer.invoke("queue-list"),
  syncNow: () => ipcRenderer.invoke("sync-now"),
  getStatus: () => ipcRenderer.invoke("get-status")
});
