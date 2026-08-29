import fs from 'fs';
import pg from 'pg';

// Load DATABASE_URL từ .env.local (utf16le) — cùng cách app Next load
const txt = fs.readFileSync('.env.local', 'utf16le');
const m = txt.match(/DATABASE_URL=(.+)/);
const url = m ? m[1].trim() : process.env.DATABASE_URL;
const pool = new pg.Pool({ connectionString: url });

const DDL = `
CREATE TABLE IF NOT EXISTS ke_hoach_sc (
  id VARCHAR(12) PRIMARY KEY, sc_id VARCHAR(12) NOT NULL REFERENCES sc(id),
  mo_ta TEXT, nguoi_lap VARCHAR(12) REFERENCES users(id), ngay TEXT,
  is_test SMALLINT DEFAULT 0, deleted_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_kh_sc ON ke_hoach_sc(sc_id);
CREATE TABLE IF NOT EXISTS phieu_kiem_tu (
  id VARCHAR(12) PRIMARY KEY, sc_id VARCHAR(12) NOT NULL REFERENCES sc(id),
  mo_ta TEXT, nguoi_kiem VARCHAR(12) REFERENCES users(id), ngay TEXT,
  is_test SMALLINT DEFAULT 0, deleted_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_kt_sc ON phieu_kiem_tu(sc_id);
CREATE TABLE IF NOT EXISTS bien_ban_nghiem (
  id VARCHAR(12) PRIMARY KEY, sc_id VARCHAR(12) NOT NULL REFERENCES sc(id),
  ngay_nghiem TEXT, nguoi_nghiem VARCHAR(12) REFERENCES users(id),
  tong_vat_tu NUMERIC(14,2) DEFAULT 0, tong_nhan_cong NUMERIC(14,2) DEFAULT 0,
  is_test SMALLINT DEFAULT 0, deleted_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_nn_sc ON bien_ban_nghiem(sc_id);
CREATE TABLE IF NOT EXISTS bao_gia_ncc (
  id VARCHAR(12) PRIMARY KEY, sc_id VARCHAR(12) REFERENCES sc(id),
  ncc TEXT, ngay TEXT, tong NUMERIC(14,2) DEFAULT 0,
  ocr_xac_nhan SMALLINT DEFAULT 0, anh_bao_gia TEXT DEFAULT '',
  nguoi_tao VARCHAR(12) REFERENCES users(id), is_test SMALLINT DEFAULT 0, deleted_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_bgn_sc ON bao_gia_ncc(sc_id);
`;

async function run(): Promise<void> {
  await pool.query(DDL);
  console.log('tables ensured (ke_hoach_sc, phieu_kiem_tu, bien_ban_nghiem, bao_gia_ncc)');

  // Mirror baogia -> bao_gia_ncc (bước 3 hồ sơ 8 bước), de-dupe theo sc_id+ncc+tong
  const bg = await pool.query(
    'SELECT id, sc_id, ncc, ngay, tong, nguoi_tao, is_test FROM baogia WHERE sc_id IS NOT NULL AND deleted_at=$1',
    ['']
  );
  let inserted = 0;
  for (const r of bg.rows) {
    const exists = await pool.query(
      'SELECT 1 FROM bao_gia_ncc WHERE sc_id=$1 AND ncc IS NOT DISTINCT FROM $2 AND tong=$3 AND deleted_at=$4 LIMIT 1',
      [r.sc_id, r.ncc, r.tong, '']
    );
    if (exists.rows.length > 0) continue;
    const next = await pool.query(
      "INSERT INTO config (key, value) VALUES ('counter_BGN', 1) ON CONFLICT (key) DO UPDATE SET value = (config.value::int + 1)::text RETURNING value"
    );
    const n = Number(next.rows[0].value);
    const id = 'BGN-' + String(n).padStart(6, '0');
    await pool.query(
      'INSERT INTO bao_gia_ncc (id, sc_id, ncc, ngay, tong, ocr_xac_nhan, anh_bao_gia, nguoi_tao, is_test, deleted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [id, r.sc_id, r.ncc, r.ngay, r.tong, 1, '', r.nguoi_tao, r.is_test, '']
    );
    inserted++;
  }
  console.log('mirrored bao_gia_ncc rows:', inserted);
  await pool.end();
}

run().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
