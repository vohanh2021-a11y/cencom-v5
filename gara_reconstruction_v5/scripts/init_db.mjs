#!/usr/bin/env node
/**
 * scripts/init_db.mjs — Khởi tạo database cho CencomOS Gara v5
 *
 * Thực hiện 3 bước theo đúng thứ tự:
 *   1) npx tsx db/migrate.ts        → tạo schema (db/schema.sql)
 *   2) npx tsx db/seed.ts           → nạp dữ liệu mẫu (xe, users, vattu, counters)
 *   3) apply db/realtime_triggers.sql → tạo trigger LISTEN/NOTIFY (dùng node:pg, không cần psql CLI)
 *
 * Yêu cầu:
 *   - Đã set env DATABASE_URL (ví dụ: postgres://postgres:postgres@localhost:5432/cencom)
 *   - Đang chạy từ thư mục gốc gara_reconstruction_v5 (có node_modules chứa tsx + pg)
 *
 * Cách chạy:
 *   DATABASE_URL=postgres://postgres:postgres@db:5432/cencom node scripts/init_db.mjs
 * (trong container: docker compose exec -e DATABASE_URL=... web node scripts/init_db.mjs — cần tsx;
 *  nếu runtime thiếu tsx, chạy từ build image hoặc host có deps)
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function fail(msg, err) {
  console.error('[init_db] ERROR:', msg);
  if (err) console.error(err);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  fail(
    'DATABASE_URL chưa được thiết lập.\n' +
    'Ví dụ: export DATABASE_URL=postgres://postgres:postgres@localhost:5432/cencom'
  );
}

// ---- (1/3) Migrate schema ----
console.log('[init_db] (1/3) migrate schema (db/migrate.ts)...');
const m = spawnSync('npx', ['tsx', 'db/migrate.ts'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
if (m.status !== 0) fail('migrate thất bại (db/migrate.ts)');

// ---- (2/3) Seed dữ liệu ----
console.log('[init_db] (2/3) seed dữ liệu (db/seed.ts)...');
const s = spawnSync('npx', ['tsx', 'db/seed.ts'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
if (s.status !== 0) fail('seed thất bại (db/seed.ts)');

// ---- (3/3) Realtime triggers (dùng node:pg, không phụ thuộc psql CLI) ----
console.log('[init_db] (3/3) apply realtime_triggers.sql...');
const sqlPath = path.join(root, 'db', 'realtime_triggers.sql');
let sql;
try {
  sql = fs.readFileSync(sqlPath, 'utf8');
} catch (e) {
  fail('Không đọc được db/realtime_triggers.sql', e);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  await client.query(sql);
  console.log('[init_db] realtime triggers OK');
} catch (e) {
  fail('apply realtime_triggers.sql thất bại', e);
} finally {
  await client.end();
}

console.log('[init_db] HOÀN TẤT: schema + seed + realtime triggers.');
