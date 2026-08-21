#!/usr/bin/env node
// scripts/seed-demo-data.mjs — Seed is_test=0 demo data for UAT video
// All demo rows use is_test=0 so they are VISIBLE in the UI lists.

import pg from 'pg';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const ENV_PATH = resolve(PROJECT_ROOT, '.env.local');

// Load .env.local (UTF-16/UTF-8 aware)
function loadEnv() {
  if (!existsSync(ENV_PATH)) {
    console.error('[seed-demo] .env.local not found');
    process.exit(1);
  }
  const buffer = readFileSync(ENV_PATH);
  let content;
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    content = buffer.toString('utf16le').slice(1);
  } else if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    content = buffer.toString('utf16be').slice(1);
  } else {
    content = buffer.toString('utf8');
  }
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key && !process.env[key]) process.env[key] = value;
  }
  console.log('[seed-demo] Loaded .env.local');
}

let pool; // assigned in main() after loadEnv()

// Mirror lib/db.ts nextId (counter in config table, FOR UPDATE)
async function nextId(prefix) {
  const key = `counter_${prefix}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query('SELECT value FROM config WHERE key = $1 FOR UPDATE', [key]);
    let next;
    if (r.rows.length === 0) {
      next = 1;
      await client.query('INSERT INTO config (key, value) VALUES ($1, $2)', [key, 0]);
    } else {
      next = Number(r.rows[0].value) + 1;
    }
    await client.query('UPDATE config SET value = $1 WHERE key = $2', [next, key]);
    await client.query('COMMIT');
    return `${prefix}-${String(next).padStart(6, '0')}`;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function main() {
  loadEnv();
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  console.log('[seed-demo] Connecting to DB...');

  // Idempotent: skip if demo (is_test=0) SC already present
  const existing = await pool.query("SELECT COUNT(*) FROM sc WHERE is_test=0 AND id LIKE 'SC-DEMO%'");
  if (parseInt(existing.rows[0].count) > 0) {
    console.log('[seed-demo] Demo data already exists, skipping');
    await pool.end();
    return;
  }

  const xeRes = await pool.query("SELECT id FROM xe WHERE deleted_at='' AND is_test=0 LIMIT 10");
  const xeIds = xeRes.rows.map(r => r.id);
  if (xeIds.length === 0) {
    console.error('[seed-demo] No xe found');
    process.exit(1);
  }

  const vtRes = await pool.query("SELECT id FROM vattu WHERE deleted_at='' AND is_test=0 LIMIT 5");
  const vtIds = vtRes.rows.map(r => r.id);

  const userRes = await pool.query("SELECT id, role FROM users WHERE deleted_at=''");
  const usersByRole = {};
  for (const u of userRes.rows) usersByRole[u.role] = u.id;

  const scStatuses = ['de_xuat', 'dang_sua', 'da_hoan', 'da_quyet', 'tu_choi'];
  for (let i = 0; i < 5; i++) {
    const xeId = xeIds[i % xeIds.length];
    const trang_thai = scStatuses[i];
    const ngay = new Date(Date.now() - (4 - i) * 86400000).toISOString().split('T')[0];

    const scRealId = `SC-DEMO${String(i + 1).padStart(2, '0')}`;
    await pool.query(
      `INSERT INTO sc (id, xe_id, ngay_tao, nguoi_tao, trang_thai, is_test, deleted_at)
       VALUES ($1, $2, $3, $4, $5, 0, '')`,
      [scRealId, xeId, ngay, usersByRole.xuong || usersByRole.admin, trang_thai]
    );
    console.log(`[seed-demo] Created SC ${scRealId} (${trang_thai})`);

    // cong viec
    for (let j = 0; j < 2 + (i % 2); j++) {
      const cvId = await nextId('CV');
      await pool.query(
        `INSERT INTO sc_congviec (id, sc_id, stt, mo_ta, loai_xu_ly, tt, so_luong, don_gia, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '')`,
        [cvId, scRealId, j + 1, `Công việc ${j + 1} cho ${scRealId}`, 'sua_chua', 'hoan', 1, 150000 + j * 50000]
      );
    }

    // vattu (first 3 SC)
    if (i < 3 && vtIds.length > 0) {
      for (let j = 0; j < 2 && j < vtIds.length; j++) {
        const vtId = await nextId('VT');
        await pool.query(
          `INSERT INTO sc_vattu (id, sc_id, vattu_id, so_luong) VALUES ($1, $2, $3, $4)`,
          [vtId, scRealId, vtIds[j], 1 + j]
        );
      }
    }

    // baogia (first 2 SC)
    if (i < 2) {
      const bgId = await nextId('BG');
      await pool.query(
        `INSERT INTO baogia (id, sc_id, ncc, ngay, tong, nguoi_tao, is_test, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, 0, '')`,
        [bgId, scRealId, `NCC Demo ${i + 1}`, ngay, 500000, usersByRole.ketoan || usersByRole.admin]
      );
      const ctId = await nextId('BGCT');
      await pool.query(
        `INSERT INTO baogia_chitiet (id, baogia_id, ten, so_luong, don_gia) VALUES ($1, $2, $3, $4, $5)`,
        [ctId, bgId, `Hạng mục báo giá ${i + 1}`, 1, 500000]
      );
    }

    // ho so (first 2 SC)
    if (i < 2) {
      const hsId = await nextId('HS');
      await pool.query(
        `INSERT INTO ho_so (id, sc_id, so_chung_tu, ngay, ghi_chu, nguoi_lap, is_test, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, 0, '')`,
        [hsId, scRealId, `CT-DEMO-${String(i + 1).padStart(3, '0')}`, ngay, 'Hồ sơ demo UAT', usersByRole.ketoan || usersByRole.admin]
      );
    }
  }

  await pool.query("UPDATE users SET must_change=0 WHERE role='admin'");
  console.log('[seed-demo] ✅ Demo data seeded (is_test=0, visible in UI)');
  await pool.end();
}

main().catch(err => {
  console.error('[seed-demo] ❌ FAILED:', err.message);
  process.exit(1);
});
