/**
 * scripts/apply-migrations.mjs — Áp dụng các file migration SQL theo thứ tự.
 * Chạy: node scripts/apply-migrations.mjs
 * Cần biến môi trường DATABASE_URL (hoặc sửa LOCAL_DB bên dưới).
 *
 * Các file migration dùng "IF NOT EXISTS" nên có thể chạy nhiều lần an toàn.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIG_DIR = join(__dirname, '..', 'packages', 'db', 'migrations');

// Ưu tiên env, nếu không có dùng local dev (theo PLAN_14.08 / on-premise).
const DATABASE_URL =
  process.env['DATABASE_URL'] ||
  'postgresql://postgres:cencom_pass_2026_prod_2026@localhost:54322/cencom_os';

const files = readdirSync(MIG_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.log('Không có file migration nào trong', MIG_DIR);
  process.exit(0);
}

const { Pool } = pg;
const pool = new Pool({ connectionString: DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    for (const f of files) {
      const sql = readFileSync(join(MIG_DIR, f), 'utf8');
      console.log(`▶ Áp dụng ${f} ...`);
      await client.query(sql);
      console.log(`  ✔ ${f} xong`);
    }
    console.log('✅ Hoàn tất áp dụng migration.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌ Lỗi áp dụng migration:', err.message);
  process.exit(1);
});
