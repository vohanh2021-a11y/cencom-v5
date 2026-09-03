const fs = require('fs');
const pg = require('pg');
const txt = fs.readFileSync('.env.local', 'utf16le');
const m = txt.match(/DATABASE_URL=(.+)/);
const url = m ? m[1].trim() : process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString: url });
(async () => {
  const r = await pool.query(
    "SELECT id, sc_id, so_chung_tu, ghi_chu, is_test, ngay FROM ho_so WHERE sc_id='SC-000002' ORDER BY ngay DESC LIMIT 5"
  );
  console.log('HO_SO_ROWS_FOR_SC-000002=', r.rows.length);
  r.rows.forEach((x) => console.log('  ', JSON.stringify(x)));
  await pool.end();
})().catch((e) => {
  console.log('ERR', e.message);
  process.exit(1);
});
