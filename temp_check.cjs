const { Pool } = require('pg');

const pool = new Pool({ connectionString: 'postgresql://postgres:postgres@localhost:5432/cencom_os', connectionTimeoutMillis: 2000 });

pool.on('connect', (client) => {
  console.log('Connected to DB');
  client.query(`SELECT 1`, (err, res) => {
    if (err) {
      console.error('Query error:', err.message);
    } else {
      console.log('Query result:', res.rows);
    }
    pool.end();
  });
});

pool.on('error', (err) => {
  console.error('Pool error:', err.message);
  pool.end();
});