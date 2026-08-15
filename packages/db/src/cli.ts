/**
 * cli.ts — CLI cho packages/db: schema | seed | migrate | reset.
 * Chạy: npx tsx packages/db/src/cli.ts <command>
 */
import pg from 'pg';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

const DATABASE_URL = process.env['DATABASE_URL'];
const SQLITE_PATH = process.env['SQLITE_PATH'] || path.join(__dirname, '..', '..', '..', 'CencomOS-Garage-v3.6', 'data', 'cencom.db');
const ALLOW_RESET = process.env['ALLOW_RESET'] === '1';

if (!DATABASE_URL) {
  console.error('��� Thiếu DATABASE_URL trong .env');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 10,
  ssl: DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false,
});

async function runSchema(): Promise<void> {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = await fs.readFile(schemaPath, 'utf-8');
  // Tách các statement bằng ;
  const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    if (stmt.startsWith('--')) continue;
    try {
      await pool.query(stmt);
    } catch (e: any) {
      // Bỏ qua l��i "already exists" cho CREATE
      if (!e.message.includes('already exists') && !e.message.includes('duplicate')) {
        console.error('��� Lỗi schema:', e.message);
        console.error('Statement:', stmt.slice(0, 200));
        throw e;
      }
    }
  }
  console.log('��� Schema áp dụng xong');
}

async function runSeed(): Promise<void> {
  // Import động seed.ts để tránh circular
  const { seedAll } = await import('./seed.js');
  await seedAll();
}

async function runMigrate(): Promise<void> {
  const { migrate } = await import('./migrator.js');
  await migrate();
}

async function runReset(): Promise<void> {
  if (!ALLOW_RESET) {
    console.error('��� Reset bị chặn. Set ALLOW_RESET=1 để cho phép.');
    process.exit(1);
  }
  console.log('��� Reset DB...');
  // Drop tất cả bảng (trừ extensions)
  const tables = await pool.query(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `);
  for (const row of tables.rows) {
    await pool.query(`DROP TABLE IF EXISTS ${row.tablename} CASCADE`);
  }
  console.log('��� Đã drop tất cả bảng');
  await runSchema();
  await runSeed();
  console.log('���� Reset hoàn tất');
}

const cmd = process.argv[2];
const commands: Record<string, () => Promise<void>> = {
  schema: runSchema,
  seed: runSeed,
  migrate: runMigrate,
  reset: runReset,
};

if (!cmd || !commands[cmd]) {
  console.log(`
Usage: npx tsx cli.ts <command>

Commands:
  schema   - Tạo schema PostgreSQL từ schema.sql
  seed     - Nạp dữ liệu mẫu (42 xe, 97 biểu mẫu, users, phan_quyen, config)
  migrate  - Chuyển dữ liệu từ SQLite v3.6 (SQLITE_PATH) → PostgreSQL
  reset    - Drop all → schema → seed (cần ALLOW_RESET=1)
  `);
  process.exit(1);
}

try {
  await commands[cmd]();
  await pool.end();
} catch (e) {
  console.error('��� Lỗi:', e);
  await pool.end();
  process.exit(1);
}