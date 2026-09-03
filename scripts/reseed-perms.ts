#!/usr/bin/env npx tsx
/**
 * scripts/reseed-perms.ts — Reseed phan_quyen trên live DB từ MATRIX.
 * Chạy: npx tsx scripts/reseed-perms.ts
 */
import { Client } from 'pg';
import { MATRIX } from '../packages/core/src/perm.js';

async function main() {
  const connStr = process.env.PGCONN || 'postgresql://postgres:cencom_pass_2026_prod_2026@127.0.0.1:54322/cencom_os';
  const client = new Client({ connectionString: connStr });
  await client.connect();
  console.log('🔗 Kết nối live DB...');
  console.log('📋 Đọc MATRIX:', Object.keys(MATRIX).join(', '));

  // DELETE cũ
  await client.query('DELETE FROM phan_quyen');
  console.log('🗑️ Đã xóa phan_quyen cũ.');

  // INSERT mới
  let count = 0;
  for (const [role, modules] of Object.entries(MATRIX)) {
    for (const [mod, features] of Object.entries(modules)) {
      for (const feat of features) {
        await client.query(
          'INSERT INTO phan_quyen(role, module, feature) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
          [role, mod, feat]
        );
        count++;
      }
    }
  }
  console.log(`✅ Đã seed ${count} quyền từ MATRIX.`);

  // Verify
  const r = await client.query('SELECT count(*) AS n FROM phan_quyen');
  console.log(`📊 Tổng phan_quyen trong DB: ${r.rows[0].n}`);

  await client.end();
  console.log('🏁 Hoàn tất reseed permissions.');
}

main().catch((e) => {
  console.error('❌ Lỗi:', e.message);
  process.exit(1);
});