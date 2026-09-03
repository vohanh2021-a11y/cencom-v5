import { Pool } from 'pg';

const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/cencom_os' });

const tables = ['sc', 'sc_cong_viec', 'sc_vattu', 'baogia', 'ho_so', 'activity_log', 'xuat_kho'];

pool.query(
  `SELECT tablename, column_name FROM information_schema.columns WHERE tablename = ANY($1) ORDER BY tablename, column_name`,
  [tables],
  (err, res) => {
    if (err) {
      console.error(err);
      pool.end();
      process.exit(1);
    }
    const rows = res.rows;
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.tablename]) grouped[row.tablename] = [];
      grouped[row.tablename].push(row.column_name);
    }
    for (const t of tables) {
      console.log(t + ': ' + (grouped[t] ? grouped[t].join(', ') : 'NOT FOUND'));
    }
    pool.end();
  }
);