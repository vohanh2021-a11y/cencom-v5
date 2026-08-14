/**
 * cli.ts — Command line cho GĐ1: apply schema + seed + migrate từ SQLite.
 * Cách chạy:
 *   node --import tsx packages/db/src/cli.ts schema   # apply schema.sql
 *   node --import tsx packages/db/src/cli.ts seed     # seed dữ liệu (idempotent)
 *   node --import tsx packages/db/src/cli.ts migrate  # copy dữ liệu từ SQLite cũ
 *   node --import tsx packages/db/src/cli.ts reset    # TRUNCATE tất cả bảng (dev)
 *
 * Env: DATABASE_URL bắt buộc (trừ `reset` cũng cần). Không hardcode secret.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { seedAll } from './seed.js';
import { migrateSqliteToPg } from './migrator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(__dirname, '..', 'schema.sql');
const SEED_DIR = join(__dirname, '..', 'seed');
const DEFAULT_SQLITE = 'E:\\APP-LAPTOP-SYNC\\CencomOS-Garage-v3.6\\data\\cencom.db';

function requireUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[cli] Thiếu DATABASE_URL. Tạo file .env từ .env.example và set trước khi chạy.');
    process.exit(1);
  }
  return url;
}

function makePool(): pg.Pool {
  return new pg.Pool({ connectionString: requireUrl(), max: 5 });
}

async function applySchema(pool: pg.Pool): Promise<void> {
  const sql = readFileSync(SCHEMA_PATH, 'utf8');
  await pool.query(sql);
  console.log('[cli] Đã apply schema:', SCHEMA_PATH);
}

async function runSeed(pool: pg.Pool): Promise<void> {
  const { xe, bieu_ma, users } = await seedAll(pool, SEED_DIR);
  console.log(`[cli] Seed xong: xe=${xe}, bieu_ma=${bieu_ma}, users=${users}`);
}

async function runMigrate(pool: pg.Pool): Promise<void> {
  const srcPath = process.env.SQLITE_PATH || DEFAULT_SQLITE;
  const { results, totalRows } = await migrateSqliteToPg(srcPath, pool);
  console.log(`[cli] Migrate xong: ${totalRows} dòng trên ${results.length} bảng`);
  for (const r of results) console.log(`  - ${r.table}: ${r.rows} dòng (${r.cols.length} cột)`);
}

const ALL_TABLES = [
  'config', 'phong_ban', 'xe', 'bieu_ma', 'kiem_tra', 'users', 'ket_qua', 'bao_duong',
  'nhat_ky', 'sessions', 'congviec', 'vattu', 'phieu_sua', 'sc_congviec', 'sc_vattu',
  'de_nghi_mua', 'dm_mua_ct', 'phieu_nhap', 'phieu_nh_ct', 'phieu_xuat', 'phieu_xuat_ct',
  'lich_sua', 'phan_quyen', 'log_audit', 'chat_threads', 'chat_messages', 'yeu_cau_tham_kham',
  'bao_gia_ncc', 'nhan_ky', 'sc_phien_ban', 'vattu_gia_lich_su', 'bien_ban_nghiem',
  'phieu_kiem_tu', 'ke_hoach_sc', 'phieu_nhap_dm', 'phieu_nhap_thanhly',
];

async function runReset(pool: pg.Pool): Promise<void> {
  if (process.env.ALLOW_RESET !== '1') {
    console.error('[cli] Reset bị chặn. Set ALLOW_RESET=1 để cho phép (chỉ dùng local/dev).');
    process.exit(1);
  }
  await pool.query('BEGIN');
  try {
    for (const t of ALL_TABLES) await pool.query(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`);
    await pool.query('COMMIT');
    console.log('[cli] Đã truncate tất cả bảng (RESTART IDENTITY).');
  } catch (e) {
    await pool.query('ROLLBACK');
    throw e;
  }
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  const pool = makePool();
  try {
    switch (cmd) {
      case 'schema': await applySchema(pool); break;
      case 'seed': await applySchema(pool); await runSeed(pool); break;
      case 'migrate': await applySchema(pool); await runMigrate(pool); break;
      case 'reset': await runReset(pool); break;
      default:
        console.error('[cli] Lệnh không hợp lệ. Dùng: schema | seed | migrate | reset');
        process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('[cli] Lỗi:', e);
  process.exit(1);
});