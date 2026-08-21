import fs from 'fs';
import path from 'path';
import pg from 'pg';

const schemaPath = path.join(__dirname, 'schema.sql');

async function migrate(): Promise<void> {
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(schemaSql);
    console.log('schema migrated');
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  migrate().then(
    () => process.exit(0),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}

export { migrate };
