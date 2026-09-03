import fs from 'fs';
import path from 'path';
import pg from 'pg';

/**
 * GĐ9 (v5.3) — pipeline DB đầy đủ cho fresh install chạy MỘT LỆNH.
 * Trước đây chỉ chạy schema.sql; accounting.sql (ledger/kế toán) và
 * realtime_triggers.sql (NOTIFY) phải áp tay từng file → on-premise init dễ
 * thiếu bảng KetoanPage/MCP gọi. Cả 3 file đều idempotent (IF NOT EXISTS /
 * DROP+CREATE TRIGGER) → chạy lại nhiều lần an toàn (ketoan test áp riêng
 * accounting.sql phía trên — trùng lặp idempotent, không lỗi).
 * Thứ tự bắt buộc: schema → accounting (ledger được index-guard trong schema
 * qua to_regclass) → triggers (tham chiếu bảng của cả 2 file trước).
 */
const SQL_FILES = ['schema.sql', 'accounting.sql', 'realtime_triggers.sql'];

async function migrate(databaseUrl?: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: databaseUrl || process.env.DATABASE_URL });
  try {
    // schema.sql viết theo kiểu FRESH DB (CREATE TABLE thuận — globalSetup test
    // DROP SCHEMA trước khi chạy). DB đã init một lần rồi (on-premise chạy lại
    // init_db.sh) → bỏ qua schema.sql, chỉ áp phần idempotent bên dưới.
    const exists = await pool.query("SELECT to_regclass('public.users') AS t");
    const skipSchema = exists.rows[0]?.t != null;
    for (const f of SQL_FILES) {
      if (f === 'schema.sql' && skipSchema) {
        console.log('[migrate] schema.sql BO QUA (users da ton tai — DB khoi tao lan 1)');
        continue;
      }
      const sql = fs.readFileSync(path.join(__dirname, f), 'utf8');
      await pool.query(sql);
      console.log(`[migrate] ${f} OK`);
    }
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
