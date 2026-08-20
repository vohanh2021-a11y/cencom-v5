/**
 * cleanup_test.ts — Xóa dữ liệu test (is_test = 1) đã tạo quá 1 ngày.
 * Dùng trong cron/CLI định kỳ để giữ DB sạch.
 * Library: await cleanupTestData(client) — trả về tổng số bản ghi đã xóa.
 * CLI: npx tsx packages/db/src/cleanup_test.ts (cần DATABASE_URL trong .env).
 *
 * BẢO MẬT: chỉ xóa bản ghi is_test = 1; tên bảng là hằng (whitelist),
 * không từ input người dùng → an toàn SQL injection ở phần tên bảng.
 */
import pg from 'pg';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as path from 'node:path';
import type { SqlClient } from './types.js';

/** Đồng bộ alias Db với SqlClient (chuẩn module db). */
type Db = SqlClient;

/** Danh sách bảng có cột (is_test, ts_created) — hằng, whitelist. */
const TEST_TABLES: readonly string[] = [
  'xe',
  'phieu_sua',
  'vattu',
  'de_nghi_mua',
  'bao_gia_ncc',
  'phieu_nhap',
  'phieu_xuat',
  'ho_so',
  'activity_log',
];

/**
 * Xóa bản ghi test cũ quá 1 ngày.
 * @returns tổng số bản ghi đã xóa trên tất cả bảng
 */
export async function cleanupTestData(db: Db): Promise<number> {
  let total = 0;

  for (const t of TEST_TABLES) {
    try {
      // Tên bảng là hằng số whitelist → an toàn khi dùng template string.
      // Phần WHERE dùng literal is_test=1 và INTERVAL hằng định.
      const r = await db.query<{ n: number }>(
        `DELETE FROM ${t} WHERE is_test = 1 AND ts_created < NOW() - INTERVAL '1 day' RETURNING 1`,
        []
      );
      const deleted = r.rows.length;
      total += deleted;
      console.log(`✅ ${t}: đã xóa ${deleted} bản ghi test cũ`);
    } catch (err) {
      // 1 bảng lỗi → log và tiếp tục bảng khác, không throw làm dừng hàm.
      console.error(`⚠️ ${t}: lỗi khi xóa dữ liệu test:`, err);
    }
  }

  console.log(`✅ Tổng cộng đã xóa ${total} bản ghi test cũ`);
  return total;
}

/** CLI entry: chỉ chạy khi file được execute trực tiếp (tsx cleanup_test.ts). */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const DATABASE_URL = process.env['DATABASE_URL'];
  if (!DATABASE_URL) {
    console.error('❌ Thiếu DATABASE_URL trong .env');
    process.exit(1);
  }
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: 10,
    ssl: DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false,
  });
  const client: Db = {
    query: async <T>(text: string, params?: any[]): Promise<{ rows: T[] }> => {
      const r = await pool.query(text, params);
      return { rows: r.rows as T[] };
    },
  };
  await cleanupTestData(client)
    .then((n) => {
      console.log(`✅ Cleanup hoàn tất: ${n} bản ghi`);
      pool.end();
    })
    .catch((e) => {
      console.error('❌ Cleanup lỗi:', e);
      pool.end();
      process.exit(1);
    });
}
