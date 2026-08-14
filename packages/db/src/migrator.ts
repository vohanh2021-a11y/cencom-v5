/**
 * migrator.ts — Chuyển dữ liệu từ SQLite cũ (v3.6) sang PostgreSQL (v4).
 *
 * Nguyên tắc (PLAN mục 13 GĐ1):
 *  - Đọc `v3.6/data/cencom.db` bằng node:sqlite (offline, script — không phải server runtime).
 *  - Map 1-1: giữ id, ngày TEXT `YYYY-MM-DD`, JSON TEXT.
 *  - Chỉ copy các cột TỒN TẠI trong schema PG (thông qua information_schema) —
 *    tự động BỎ cột ảnh/OCR (`anh_bao_gia`, `ocr_result`, `ocr_xac_nhan`, `ocr_engine`)
 *    mà không cần hardcode danh sách.
 *  - `sessions.created_at/expires_at`: SQLite INTEGER (epoch ms) → PG TIMESTAMPTZ.
 *  - Sau khi copy: setval sequence cho bảng BIGSERIAL để id mới không đụng id cũ.
 *  - KHÔNG reset dữ liệu PG — chỉ INSERT ... ON CONFLICT DO NOTHING (idempotent).
 */
import { DatabaseSync } from './sqlite.js';
import type { SqlClient } from './types.js';

const EPOCH_MS_COLS: Record<string, string[]> = {
  sessions: ['created_at', 'expires_at'],
};

const toIso = (v: unknown): unknown => {
  if (v === null || v === undefined || v === '') return v;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? new Date(n).toISOString() : v;
};

interface TableCopyResult {
  table: string;
  rows: number;
  cols: string[];
}

async function pgColumns(client: SqlClient): Promise<Map<string, string[]>> {
  const r = await client.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public' ORDER BY ordinal_position`
  );
  const map = new Map<string, string[]>();
  for (const row of r.rows) {
    const t = row.table_name;
    if (!map.has(t)) map.set(t, []);
    map.get(t)!.push(row.column_name);
  }
  return map;
}

/**
 * Copy toàn bộ dữ liệu từ SQLite sang PG.
 * @param sqlitePath đường dẫn file .db cũ (v3.6/data/cencom.db)
 * @param client client PG đã kết nối (transaction hoặc pool)
 * @param tableWhitelist danh sách bảng cần copy (mặc định: tất cả bảng có trong cả 2 DB)
 */
export async function migrateSqliteToPg(
  sqlitePath: string,
  client: SqlClient,
  tableWhitelist?: string[]
): Promise<{ results: TableCopyResult[]; totalRows: number }> {
  const src = new DatabaseSync(sqlitePath, { readOnly: true });
  const pgCols = await pgColumns(client);

  // Bảng trong SQLite (loại bỏ bảng hệ thống)
  const sqliteTables = (src.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  ).all() as Array<{ name: string }>).map((r) => r.name);

  const results: TableCopyResult[] = [];
  let totalRows = 0;

  for (const table of sqliteTables) {
    if (tableWhitelist && !tableWhitelist.includes(table)) continue;
    const pgColList = pgCols.get(table);
    if (!pgColList) continue; // bảng không tồn tại trong PG schema — bỏ qua

    // Cột chung (SQLite ∩ PG) — tự động loại cột ảnh/OCR vì chúng không có trong PG
    const srcCols = (src.prepare(`PRAGMA table_info(${JSON.stringify(table)})`).all() as Array<{ name: string }>)
      .map((c) => c.name);
    const cols = srcCols.filter((c) => pgColList.includes(c));
    if (cols.length === 0) continue;

    const rows = src.prepare(`SELECT ${cols.map((c) => JSON.stringify(c)).join(',')} FROM ${JSON.stringify(table)}`).all() as Record<string, unknown>[];
    if (rows.length === 0) continue;

    const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
    const insertSql = `INSERT INTO ${table}(${cols.join(',')}) VALUES(${placeholders}) ON CONFLICT DO NOTHING`;
    const epCols = EPOCH_MS_COLS[table] || [];

    for (const row of rows) {
      const params = cols.map((c) => (epCols.includes(c) ? toIso(row[c]) : row[c]));
      await client.query(insertSql, params);
    }
    totalRows += rows.length;
    results.push({ table, rows: rows.length, cols });
  }

  // Đồng bộ sequence cho bảng BIGSERIAL để id mới không đụng id đã copy.
  // Chỉ chạy khi bảng có cột `id` với default nextval (bảng con BIGSERIAL —
  // tránh lỗi với bảng id TEXT hoặc bảng không có id như config/phan_quyen).
  for (const table of results.map((r) => r.table)) {
    const col = await client.query<{ col_default: string | null }>(
      `SELECT column_default AS col_default FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 AND column_name='id'`, [table]
    );
    if (!col.rows[0]?.col_default || !col.rows[0].col_default.startsWith('nextval')) continue;
    const seq = await client.query<{ seq: string | null }>(
      `SELECT pg_get_serial_sequence($1, 'id') AS seq`, [table]
    );
    if (!seq.rows[0]?.seq) continue;
    await client.query(
      `SELECT setval($1, COALESCE(MAX(id), 1)) FROM ${table}`, [seq.rows[0].seq]
    );
  }

  src.close();
  return { results, totalRows };
}