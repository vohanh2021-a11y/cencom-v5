import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/cencom' });
const r = await pool.query("SELECT id FROM sc WHERE deleted_at = '' LIMIT 1");
console.log('sc_id:', r.rows[0]?.id);
const r2 = await pool.query("SELECT id FROM xe WHERE deleted_at = '' LIMIT 1");
console.log('xe_id:', r2.rows[0]?.id);
await pool.end();