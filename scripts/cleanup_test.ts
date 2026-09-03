import { Pool } from 'pg';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ Thiếu DATABASE_URL trong .env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  ssl: DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false,
});

// Tables to process (check existence & columns at runtime)
const TABLES = ['sc', 'sc_cong_viec', 'sc_vattu', 'baogia', 'ho_so', 'activity_log', 'xuat_kho'];

async function runCleanup() {
  const client = await pool.connect();
  try {
    let totalDeleted = 0;
    
    for (const table of TABLES) {
      // Check if table exists and get its columns
      const columnsResult = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
        [table]
      );
      const columnNames = columnsResult.rows.map(r => r.column_name);
      
      console.log(`\n🔍 Kiểm tra bảng "${table}": có ${columnNames.length} cột - ${columnNames.join(', ')}`);
      
      const hasIsTest = columnNames.includes('is_test');
      const hasDeletedAt = columnNames.includes('deleted_at');
      
      if (!hasIsTest || !hasDeletedAt) {
        console.log(`⏭️ Bỏ qua "${table}": không có cả cột is_test VÀ deleted_at`);
        console.log(`   - has is_test: ${hasIsTest}, has deleted_at: ${hasDeletedAt}`);
        continue;
      }
      
      // Determine age filter based on available timestamp columns
      // Check for ts_created, created_at, or ngay columns
      const ageCondition = buildAgeCondition(columnNames);
      
      // Soft-delete: update deleted_at to current timestamp
      // Only target records where is_test is set (non-zero) and not already soft-deleted
      const query = `
        UPDATE "${table}"
        SET deleted_at = CURRENT_TIMESTAMP
        WHERE is_test != 0
        AND deleted_at = ''
        ${ageCondition}
      `;
      
      const result = await client.query(query);
      const deletedCount = result.rowCount || 0;
      totalDeleted += deletedCount;
      
      console.log(`🗑️ "${table}": đã soft-delete ${deletedCount} bản ghi (is_test != 0)`);
      if (ageCondition) {
        console.log(`   Điều kiện tuổi: ${ageCondition}`);
      }
    }
    
    console.log(`\n✅ Cleanup hoàn tất: tổng ${totalDeleted} bản ghi đã được soft-delete`);
    pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Cleanup lỗi:', err);
    pool.end();
    process.exit(1);
  }
}

function buildAgeCondition(columnNames: string[]): string {
  // Check for timestamp columns to determine "older than 1 day"
  const tsColumns = ['ts_created', 'created_at', 'ngay'];
  for (const col of tsColumns) {
    if (columnNames.includes(col)) {
      // Use this column for age check - records older than 1 day
      return ` AND "${col}" < NOW() - INTERVAL '1 day'`;
    }
  }
  // No timestamp column found - just delete all is_test records without age filter
  return '';
}

runCleanup();