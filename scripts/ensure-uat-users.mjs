/**
 * scripts/ensure-uat-users.mjs — Đảm bảo có user UAT cho các vai mới (pttb, laixe).
 * Chạy: node scripts/ensure-uat-users.mjs
 * Dùng ON CONFLICT DO NOTHING nên an toàn khi chạy nhiều lần.
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const DATABASE_URL =
  process.env['DATABASE_URL'] ||
  'postgresql://postgres:cencom_pass_2026_prod_2026@localhost:54322/cencom_os';

// passHash mặc định của seed (plaintext tương ứng: cencom@123)
const PASS_HASH =
  'scrypt:salt123:0705035993af61b00c27f0a003991fcfc0bef17199637781e1c8ffd470e65e5763ad6c59459be983b39523685400695e7815e3876ec5986582af384487ff7a0b';

const users = [
  ['pttb-1', 'Phòng TB', 'pttb', 'PTTB'],
  ['laixe-1', 'Lái xe', 'laixe', 'Đội xe'],
];

const { Pool } = pg;
const pool = new Pool({ connectionString: DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    // Đưa must_change=0 cho MỌI user UAT để login thẳng được (seed mặc định có thể set 1)
    const ALL_UAT = ['admin-1', 'giamdoc-1', 'xuong-1', 'khoa-1', 'ketoan-1', 'pttb-1', 'laixe-1'];
    await client.query(
      `UPDATE users SET must_change = 0 WHERE id = ANY($1)`,
      [ALL_UAT],
    );
    for (const [id, name, role, pb] of users) {
      await client.query(
        `INSERT INTO users (id, name, role, phone, pass_hash, active, must_change, phong_ban, deleted_at, tenant_id)
         VALUES ($1,$2,$3,'',$4,1,0,$5,'','c1')
         ON CONFLICT (id) DO NOTHING`,
        [id, name, role, PASS_HASH, pb],
      );
      console.log(`✔ đảm bảo user ${id} (${role}) — phân quyền theo role có sẵn trong MATRIX`);
    }
    console.log('✅ Xong.');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
