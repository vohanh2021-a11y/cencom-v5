/**
 * clean-load.mjs — Dọn các dòng SC tạo bởi k6 load test (marker mo_ta 'k6-load-*').
 * Chạy sau mỗi lần load test: node scripts/clean-load.mjs
 */
import pg from 'pg';
const url = 'postgresql://postgres:cencom_pass_2026_prod_2026@127.0.0.1:54322/cencom_os';
const p = new pg.Pool({ connectionString: url });
const r = await p.query("DELETE FROM phieu_sua WHERE mo_ta LIKE 'k6-load-%' OR mo_ta LIKE 'k6-heavy-%' RETURNING id");
console.log('deleted k6-load SC rows:', r.rowCount);
await p.end();
