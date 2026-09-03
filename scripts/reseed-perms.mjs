#!/usr/bin/env node --import tsx
/**
 * scripts/reseed-perms.mjs — Reseed phan_quyen trên live DB từ MATRIX.
 * Chạy: node --import tsx scripts/reseed-perms.mjs
 * Yêu cầu: live DB đã migrate schema (có bảng phan_quyen), kết nối qua env PG* hoặc connectionString.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const PERM_PATH = resolve(__dirname, '..', 'packages', 'core', 'src', 'perm.ts');

// Đọc MATRIX từ file TS (regex linh hoạt cho file có comment tiếng Việt)
function loadMatrix() {
  const content = readFileSync(PERM_PATH, 'utf8');
  // Match từ "export const MATRIX" đến "};" khép lại
  const start = content.indexOf('export const MATRIX');
  if (start === -1) throw new Error('Không tìm thấy MATRIX trong perm.ts');
  const after = content.slice(start);
  // Tìm dấu }; cân bằng (đơn giản: tìm lần đầu tiên "};" sau dòng cuối role)
  const xuongIdx = after.indexOf('xuong:');
  if (xuongIdx === -1) throw new Error('Không tìm thấy role xuong trong MATRIX');
  const sub = after.slice(xuongIdx);
  const endRel = sub.indexOf('};');
  if (endRel === -1) throw new Error('Không tìm thấy }; kết thúc MATRIX');
  let matrixCode = after.slice(0, xuongIdx + endRel + 2); // đến }; inclusively
  // Loại bỏ "export const MATRIX:" prefix để Function parse được
  matrixCode = matrixCode.replace(/^export\s+const\s+MATRIX\s*:\s*Record<[^>]+>\s*=/, '');
  // eslint-disable-next-line no-new-func
  return new Function('return ' + matrixCode + ';')();
}

async function main() {
  const connStr = process.env.PGCONN || 'postgresql://postgres:cencom_pass_2026_prod_2026@127.0.0.1:54322/cencom_os';
  const client = new Client({ connectionString: connStr });
  await client.connect();
  console.log('🔗 Kết nối live DB...');

  const MATRIX = loadMatrix();
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