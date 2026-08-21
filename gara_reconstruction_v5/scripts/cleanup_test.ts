import { Pool } from 'pg';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

/**
 * Check if a table exists in the public schema.
 */
async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  try {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      ) AS exists`,
      [tableName]
    );
    return result.rows[0].exists;
  } catch {
    return false;
  }
}

/**
 * Check if a column exists in a table.
 */
async function columnExists(pool: Pool, tableName: string, columnName: string): Promise<boolean> {
  try {
    const result = await pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
      ) AS exists`,
      [tableName, columnName]
    );
    return result.rows[0].exists;
  } catch {
    return false;
  }
}

/**
 * Count test records (is_test != 0) in a table, optionally filtered by age.
 * For tables with ngay_tao: only count records older than 1 day where deleted_at = ''.
 * For tables without ngay_tao: count all un-deleted test records.
 */
async function countTestRecords(pool: Pool, tableName: string): Promise<number> {
  const isTestExists = await columnExists(pool, tableName, 'is_test');
  const delAtExists = await columnExists(pool, tableName, 'deleted_at');

  if (!isTestExists || !delAtExists) {
    return 0; // Skip if required columns don't exist
  }

  const ngayTaoExists = await columnExists(pool, tableName, 'ngay_tao');

  let query: string;
  const params: any[] = [];

  if (ngayTaoExists) {
    // Filter: is_test != 0, not yet soft-deleted, and created older than 1 day
    query = `SELECT COUNT(*) FROM ${tableName} WHERE is_test != 0 AND deleted_at = '' AND CAST(ngay_tao AS DATE) < CURRENT_DATE - 1`;
  } else {
    // No creation date column: count all un-deleted test records
    query = `SELECT COUNT(*) FROM ${tableName} WHERE is_test != 0 AND deleted_at = ''`;
  }

  try {
    const result = await pool.query(query, params);
    return parseInt(result.rows[0].count, 10);
  } catch (err) {
    console.error(`Warning: Error counting test records in ${tableName}:`, (err as Error).message);
    return 0;
  }
}

/**
 * Soft-delete test records: set deleted_at = CURRENT_TIMESTAMP.
 * For tables with ngay_tao: only soft-delete records older than 1 day.
 * For tables without ngay_tao: soft-delete all un-deleted test records.
 */
async function softDeleteTestRecords(pool: Pool, tableName: string): Promise<number> {
  const isTestExists = await columnExists(pool, tableName, 'is_test');
  const delAtExists = await columnExists(pool, tableName, 'deleted_at');

  if (!isTestExists || !delAtExists) {
    return 0;
  }

  const ngayTaoExists = await columnExists(pool, tableName, 'ngay_tao');

  let query: string;

  if (ngayTaoExists) {
    // Soft-delete: is_test != 0, not yet soft-deleted, created older than 1 day
    query = `UPDATE ${tableName} SET deleted_at = CURRENT_TIMESTAMP WHERE is_test != 0 AND deleted_at = '' AND CAST(ngay_tao AS DATE) < CURRENT_DATE - 1`;
  } else {
    // No creation date column: soft-delete all un-deleted test records
    query = `UPDATE ${tableName} SET deleted_at = CURRENT_TIMESTAMP WHERE is_test != 0 AND deleted_at = ''`;
  }

  try {
    const result = await pool.query(query);
    return result.rowCount || 0;
  } catch (err) {
    console.error(`Warning: Error soft-deleting test records in ${tableName}:`, (err as Error).message);
    return 0;
  }
}

async function main() {
  // Tables mentioned in the task, but we only process those that exist in schema
  // and have both is_test and deleted_at columns.
  // From db/schema.sql the actual tables with both columns are:
  //   - sc (has ngay_tao for age filtering)
  //   - sc_vattu
  //   - baogia
  //   - ho_so
  // Tables to check (will be skipped if missing required columns):
  //   - sc_congviec: has deleted_at but NO is_test → skip
  //   - activity_log: has is_test but NO deleted_at → skip
  //   - xuat_kho: not in schema → skip
  const tables = ['sc', 'sc_vattu', 'baogia', 'ho_so'];

  const results: { table: string; testCount: number; deletedCount: number }[] = [];
  let totalDeleted = 0;

  for (const table of tables) {
    const exists = await tableExists(pool, table);
    if (!exists) {
      console.log(`Table ${table}: does not exist, skipping.`);
      results.push({ table, testCount: 0, deletedCount: 0 });
      continue;
    }

    const testCount = await countTestRecords(pool, table);
    const deletedCount = await softDeleteTestRecords(pool, table);

    results.push({ table, testCount, deletedCount });
    totalDeleted += deletedCount;
    console.log(`Table ${table}: ${deletedCount} records soft-deleted (test records available: ${testCount})`);
  }

  // Also try tables that might exist but were not in the original list
  // (e.g., if schema has been extended). Check for xuat_kho and activity_log
  // just to report, but skip if columns missing.
  const extraTables = ['xuat_kho', 'activity_log', 'sc_congviec'];
  for (const table of extraTables) {
    const exists = await tableExists(pool, table);
    if (!exists) {
      console.log(`Table ${table}: does not exist, skipping.`);
      results.push({ table, testCount: 0, deletedCount: 0 });
      continue;
    }

    const testCount = await countTestRecords(pool, table);
    const deletedCount = await softDeleteTestRecords(pool, table);

    results.push({ table, testCount, deletedCount });
    totalDeleted += deletedCount;
    console.log(`Table ${table}: ${deletedCount} records soft-deleted (test records available: ${testCount})`);
  }

  // Summary
  console.log(`\n=== Cleanup Summary ===`);
  console.log(`Total soft-deleted: ${totalDeleted} records`);
  console.log(`Processed ${results.length} tables:`);
  for (const r of results) {
    console.log(`  - ${r.table}: ${r.deletedCount} (test available: ${r.testCount})`);
  }

  await pool.end();
  console.log('Cleanup completed successfully.');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error during cleanup:', err);
  try { pool.end(); } catch {}
  process.exit(1);
});