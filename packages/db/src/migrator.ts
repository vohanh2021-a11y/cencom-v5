/**
 * migrator.ts — Chuyển dữ liệu từ SQLite v3.6 (cencom.db) → PostgreSQL v4.
 * - Giữ nguyên id, ngày (TEXT), JSON (TEXT).
 * - Bỏ cột ảnh/OCR khỏi bao_gia_ncc.
 * - Map tên bảng/cột lowercase cho PG.
 * Library: import { migrate } from '@cencom/db' — cần pgPool đã init.
 * CLI: npx tsx packages/db/src/migrator.ts (cần DATABASE_URL + SQLITE_PATH trong .env).
 */
import pg from 'pg';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SQLITE_PATH_DEFAULT = path.join(__dirname, '..', '..', '..', 'CencomOS-Garage-v3.6', 'data', 'cencom.db');

/** Lazy-init pool — chỉ tạo khi chạy CLI, không crash khi import trong test. */
let pgPool: pg.Pool | null = null;
let sqlitePath: string = SQLITE_PATH_DEFAULT;

/** Danh sách bảng cần migrate (theo thứ tự phụ thuộc khóa ngoại) */
const TABLES = [
  'config', 'phong_ban', 'xe', 'users',
  'nhat_ky', 'sessions',
  'congviec', 'vattu', 'phieu_sua', 'sc_congviec', 'sc_vattu',
  'de_nghi_mua', 'dm_mua_ct', 'phieu_nhap', 'phieu_nh_ct', 'phieu_xuat',
  'phieu_xuat_ct', 'lich_sua', 'phan_quyen', 'log_audit',
  'chat_threads', 'chat_messages',
  'bao_gia_ncc', 'nhan_ky', 'sc_phien_ban', 'vattu_gia_lich_su',
  'bien_ban_nghiem', 'phieu_kiem_tu', 'ke_hoach_sc',
  'phieu_nhap_dm', 'phieu_nhap_thanhly',
];

/** Cột cần bỏ khi migrate (ảnh/OCR đã chốt BỎ ở v4) */
const DROP_COLUMNS: Record<string, string[]> = {
  bao_gia_ncc: ['anh_bao_gia', 'ocr_result', 'ocr_xac_nhan', 'ocr_engine'],
};

async function getSqliteColumns(db: any, table: string): Promise<string[]> {
  const info = await db.all(`PRAGMA table_info(${table})`);
  return info.map((c: any) => c.name);
}

export async function migrate(): Promise<void> {
  if (!pgPool) {
    throw new Error('pgPool chưa được khởi tạo. Gọi từ CLI hoặc truyền pool trước khi gọi migrate().');
  }

  console.log(`🔄 Migrate từ ${sqlitePath} → PG...`);

  const sqlite = await open({ filename: sqlitePath, driver: sqlite3.Database });
  const pgClient = await pgPool.connect();

  try {
    await pgClient.query('BEGIN');

    for (const table of TABLES) {
      const exists = await sqlite.get(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, table
      );
      if (!exists) {
        console.log(`  ⏭ ${table}: không có trong SQLite, bỏ qua`);
        continue;
      }

      const cols = await getSqliteColumns(sqlite, table);
      const dropCols = DROP_COLUMNS[table] || [];
      const keepCols = cols.filter((c) => !dropCols.includes(c));

      if (keepCols.length === 0) {
        console.log(`  ⏭ ${table}: không còn cột sau khi bỏ, bỏ qua`);
        continue;
      }

      const count = await sqlite.get(`SELECT COUNT(*) as c FROM ${table}`);
      console.log(`  📦 ${table}: ${count.c} dòng, ${keepCols.length} cột`);

      if (count.c === 0) continue;

      const batchSize = 500;
      for (let offset = 0; offset < count.c; offset += batchSize) {
        const rows = await sqlite.all(
          `SELECT ${keepCols.join(',')} FROM ${table} LIMIT ${batchSize} OFFSET ${offset}`
        );

        if (rows.length === 0) break;

        const placeholders = keepCols.map((_, i) => `$${i + 1}`).join(',');
        const colList = keepCols.join(',');
        const sql = `INSERT INTO ${table} (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

        for (const row of rows) {
          const vals = keepCols.map((c) => row[c]);
          if (table === 'sessions') {
            const createdIdx = keepCols.indexOf('created_at');
            const expiresIdx = keepCols.indexOf('expires_at');
            if (createdIdx >= 0 && typeof vals[createdIdx] === 'number') {
              vals[createdIdx] = new Date(vals[createdIdx]).toISOString();
            }
            if (expiresIdx >= 0 && typeof vals[expiresIdx] === 'number') {
              vals[expiresIdx] = new Date(vals[expiresIdx]).toISOString();
            }
          }
          try {
            await pgClient.query(sql, vals);
          } catch (e: any) {
            console.error(`    ❌ Lỗi insert ${table}:`, e.message);
            throw e;
          }
        }
      }
      console.log(`  ✅ ${table}: done`);
    }

    await pgClient.query('COMMIT');
    console.log('🎉 Migrate hoàn tất!');
  } catch (e) {
    await pgClient.query('ROLLBACK');
    throw e;
  } finally {
    pgClient.release();
    await sqlite.close();
  }
}

/** CLI entry: chỉ chạy khi file được execute trực tiếp. */
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const DATABASE_URL = process.env['DATABASE_URL'];
  if (!DATABASE_URL) {
    console.error('❌ Thiếu DATABASE_URL trong .env');
    process.exit(1);
  }
  sqlitePath = process.env['SQLITE_PATH'] || SQLITE_PATH_DEFAULT;

  pgPool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: 10,
    ssl: DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false,
  });

  migrate()
    .then(() => pgPool!.end())
    .catch((e) => {
      console.error('❌ Migrate thất bại:', e);
      pgPool!.end();
      process.exit(1);
    });
}
