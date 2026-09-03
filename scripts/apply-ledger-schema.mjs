/**
 * apply-ledger-schema.mjs — Áp dụng schema kế toán (GĐ1) vào live DB.
 * Chạy idempotent: DDL dùng IF NOT EXISTS, seed dùng ON CONFLICT.
 *
 * Cách chạy (từ thư mục gốc dự án):
 *   node scripts/apply-ledger-schema.mjs
 * Hoặc chỉ định DATABASE_URL:
 *   DATABASE_URL=postgresql://user:pass@host:5432/db node scripts/apply-ledger-schema.mjs
 *
 * KHÔNG hardcode secret: đọc từ env DATABASE_URL, fallback local Supabase dev.
 */
import { readFileSync } from 'node:fs';
import { Client } from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:cencom_pass_2026_prod_2026@127.0.0.1:54322/cencom_os';

const FILES = ['packages/db/src/accounting.sql', 'packages/db/src/coa_seed.sql'];

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    for (const f of FILES) {
      const sql = readFileSync(f, 'utf8');
      for (const stmt of sql.split(';')) {
        const s = stmt.trim();
        if (!s) continue;
        try {
          await client.query(s);
          console.log('OK   :', s.slice(0, 70).replace(/\s+/g, ' '));
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // Bỏ qua lỗi "already exists" (idempotent)
          if (/already exists|duplicate/i.test(msg)) {
            console.log('SKIP :', s.slice(0, 70).replace(/\s+/g, ' '), '→', msg.split('\n')[0]);
          } else {
            console.warn('FAIL :', s.slice(0, 70).replace(/\s+/g, ' '), '→', msg.split('\n')[0]);
            throw e;
          }
        }
      }
    }
    console.log('\n✅ Áp dụng schema kế toán GĐ1 xong.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error('Lỗi migration:', e);
  process.exit(1);
});
