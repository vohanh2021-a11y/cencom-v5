import pg from 'pg';
import type { Db } from './types';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export const db: Db = pool;

let pgNotificationClient: pg.Client | null = null;

export function getPgNotificationClient(): pg.Client {
  if (!pgNotificationClient) {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    pgNotificationClient = client;
    // connect() trả về Promise — phải bắt lỗi để tránh unhandledRejection
    // (LISTEN client mất kết nối không được phép làm crash process chính)
    client.connect().catch((e) => {
      console.error(`[db] LISTEN client connect failed: ${e?.message || e}`);
      if (pgNotificationClient === client) pgNotificationClient = null;
    });
  }
  return pgNotificationClient;
}

export async function q(text: string, params?: any[]): Promise<{ rows: any[] }> {
  return pool.query(text, params);
}

export async function row<T = any>(text: string, params?: any[]): Promise<T | undefined> {
  const r = await pool.query(text, params);
  return r.rows[0] as T | undefined;
}

export async function run(text: string, params?: any[]): Promise<void> {
  await pool.query(text, params);
}

export async function nextId(prefix: string): Promise<string> {
  const key = `counter_${prefix}`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query('SELECT value FROM config WHERE key = $1 FOR UPDATE', [key]);
    let next: number;
    if (r.rows.length === 0) {
      next = 1;
      await client.query('INSERT INTO config (key, value) VALUES ($1, $2)', [key, 0]);
    } else {
      next = Number(r.rows[0].value) + 1;
    }
    await client.query('UPDATE config SET value = $1 WHERE key = $2', [next, key]);
    await client.query('COMMIT');
    return `${prefix}-${String(next).padStart(6, '0')}`;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Chạy fn trong MỘT transaction Postgres: BEGIN → fn(client) → COMMIT.
 * fn ném lỗi → ROLLBACK rồi re-throw (giữ nguyên lỗi gốc); finally luôn release client.
 *
 * QUI TẮC (chống hết pool): khi callback đang chạy, KHÔNG được gọi pool
 * (q/row/run/nextId/logActivity) — mọi truy vấn bắt buộc đi qua `client` được
 * truyền vào. Pool max=10; 10 tx song song mà mỗi tx còn chờ thêm connection
 * thứ hai sẽ deadlock tại pool.connect().
 */
export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr: any) {
      // ROLLBACK lỗi (connection gãy) → ghi log nhưng KHÔNG che lỗi nghiệp vụ gốc
      console.error(`[db] ROLLBACK failed: ${rollbackErr?.message || rollbackErr}`);
    }
    throw e;
  } finally {
    client.release();
  }
}
