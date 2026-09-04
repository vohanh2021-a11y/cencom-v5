import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { app } from "electron";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const dir = app ? app.getPath("userData") : path.join(process.cwd(), ".spoke-data");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "spoke.db");
  db = new Database(file);
  db.pragma("journal_mode = WAL");
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      loai TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending','conflict','synced','failed')),
      retry INTEGER DEFAULT 0,
      created_at TEXT,
      synced_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sq_status ON sync_queue(status);
    CREATE TABLE IF NOT EXISTS cache_vattu (id TEXT PRIMARY KEY, ten TEXT, ton REAL, gia REAL, don_vi TEXT);
    CREATE TABLE IF NOT EXISTS cache_xe (id TEXT PRIMARY KEY, bien_so TEXT, chu_xe TEXT);
    CREATE TABLE IF NOT EXISTS cache_sc (id TEXT PRIMARY KEY, xe_id TEXT, trang_thai TEXT, ngay_tao TEXT, tong REAL);
  `);
}

export function queuePush(loai: string, payload: any): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const d = getDb();
  d.prepare("INSERT INTO sync_queue (id, loai, payload, status, created_at) VALUES (?,?,?,?,?)")
    .run(id, loai, JSON.stringify(payload), "pending", new Date().toISOString());
  return id;
}

export function queueList() {
  return getDb().prepare("SELECT * FROM sync_queue ORDER BY created_at DESC").all();
}

export function queueMark(id: string, status: string) {
  getDb().prepare("UPDATE sync_queue SET status=?, synced_at=? WHERE id=?").run(status, new Date().toISOString(), id);
}
