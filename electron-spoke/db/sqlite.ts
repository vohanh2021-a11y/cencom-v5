// Spoke queue — dùng file JSON thay better-sqlite3 để tránh native build
// File: %APPDATA%/CencomOS/spoke-queue.json
import path from "path";
import fs from "fs";
import { app } from "electron";

function queueFile() {
  const dir = app ? app.getPath("userData") : path.join(process.cwd(), ".spoke-data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "spoke-queue.json");
}

function readQueue(): any[] {
  try {
    if (fs.existsSync(queueFile())) return JSON.parse(fs.readFileSync(queueFile(), "utf8"));
  } catch {}
  return [];
}
function writeQueue(q: any[]) {
  fs.writeFileSync(queueFile(), JSON.stringify(q, null, 2));
}

export function queuePush(loai: string, payload: any): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const q = readQueue();
  q.push({ id, loai, payload: JSON.stringify(payload), status: "pending", created_at: new Date().toISOString() });
  writeQueue(q);
  return id;
}
export function queueList() { return readQueue(); }
export function queueMark(id: string, status: string) {
  const q = readQueue();
  const item = q.find((x: any) => x.id === id);
  if (item) { item.status = status; item.synced_at = new Date().toISOString(); writeQueue(q); }
}
export function getDb() { return { prepare: () => ({ all: queueList, run: () => {} }) } as any; }
