/**
 * db.ts — Lớp dữ liệu GĐ2 (PostgreSQL async) — port từ server/db.js v3.6.
 * Thay đổi cốt lõi so với v3.6:
 *  - `node:sqlite` sync → `pg` async pool (mọi hàm trả Promise — await đủ).
 *  - `nextId(prefix)`: dùng bảng `config` counter với `FOR UPDATE` trong transaction
 *    (thay `db.nextId` sync cũ — tránh race khi nhiều user tạo phiếu đồng thời).
 *  - `db.audit`: INSERT `log_audit` trong CÙNG transaction (gọi qua `tx.audit`).
 *  - Soft-delete `deleted_at TEXT DEFAULT ''` — giữ NGUYÊN quy ước v3.6.
 * Ghi chú bảo mật: `table`/`idCol` của softDelete/restoreRow là HẰNG SỐ nội bộ
 * (module gọi với tên bảng cố định) — vẫn validate regex để chặn SQLi nếu lỡ truyền sai.
 */
import type { Pool } from 'pg';

export interface SqlExecutor {
  query<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
  transaction<T>(fn: (q: SqlExecutor) => Promise<T>): Promise<T>;
}

/* ---------------- Hook xoá cache khi ghi DB (giữ nguyên db.js) ----------------
   BỎ QUA ghi session/audit/nhật_ký/config/chat (không ảnh hưởng cache, tránh xoá
   cache khi login đồng loạt dưới tải). */
const _writeHooks: Array<() => void> = [];
const _SKIP_CACHE_CLEAR =
  /(^|\s)(INSERT|UPDATE|DELETE|REPLACE)\s+INTO\s+(sessions|log_audit|nhat_ky|config|chat_messages|chat_threads)\b/i;
function fireWrite(sql: string): void {
  if (sql && _SKIP_CACHE_CLEAR.test(sql)) return;
  for (const h of _writeHooks) {
    try {
      h();
    } catch {
      /* hook lỗi không làm sập luồng */
    }
  }
}
export function onWrite(fn: () => void): void {
  _writeHooks.push(fn);
}

/* ---------------- Executor cho pg Pool (production) ---------------- */
export function makePgExecutor(pool: Pool): SqlExecutor {
  return {
    async query<T>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number | null }> {
      const r = await pool.query(text, params as never[]);
      return { rows: r.rows as T[], rowCount: r.rowCount };
    },
    async transaction<T>(fn: (q: SqlExecutor) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const q: SqlExecutor = {
          async query<T2>(text: string, params?: unknown[]) {
            const r = await client.query(text, params as never[]);
            return { rows: r.rows as T2[], rowCount: r.rowCount };
          },
          async transaction<T2>(): Promise<T2> {
            throw new Error('Nested transaction không được hỗ trợ.');
          },
        };
        const out = await fn(q);
        await client.query('COMMIT');
        return out;
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

/* ---------------- Executor cho PGlite (test local — Postgres WASM) ---------------- */
export function makePgliteExecutor(d: {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[]; affectedRows?: number | null }>;
  exec(text: string): Promise<unknown>;
}): SqlExecutor {
  return {
    async query<T>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number | null }> {
      const r = await d.query<T>(text, params);
      return { rows: r.rows, rowCount: r.affectedRows ?? null };
    },
    async transaction<T>(fn: (q: SqlExecutor) => Promise<T>): Promise<T> {
      await d.exec('BEGIN');
      try {
        const q: SqlExecutor = {
          async query<T2>(text: string, params?: unknown[]) {
            const r = await d.query<T2>(text, params);
            return { rows: r.rows, rowCount: r.affectedRows ?? null };
          },
          async transaction<T2>(): Promise<T2> {
            throw new Error('Nested transaction không được hỗ trợ.');
          },
        };
        const out = await fn(q);
        await d.exec('COMMIT');
        return out;
      } catch (e) {
        await d.exec('ROLLBACK').catch(() => {});
        throw e;
      }
    },
  };
}

/* ---------------- Kiểu Db — bề mặt cho mọi module core ---------------- */
export interface Db {
  row<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T | undefined>;
  rows<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]>;
  run(sql: string, ...params: unknown[]): Promise<{ rowCount: number | null }>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  nextId(prefix: string): Promise<string>;
  today(): string;
  nowStamp(): string;
  logNhatKy(noiDung: string, nguoi?: string): Promise<void>;
  configGet(key: string, def?: string): Promise<string>;
  configSet(key: string, value: string): Promise<void>;
  softDelete(table: string, idCol: string, id: string | number, user: string, bangLabel?: string): Promise<void>;
  restoreRow(table: string, idCol: string, id: string | number, user: string): Promise<void>;
  audit(hanhVi: string, bang: string, idDong: string | number, nguoi: string, noiDung?: string): Promise<void>;
  auditList(q?: { bang?: string; nguoi?: string; tu?: string; den?: string; limit?: number }): Promise<unknown[]>;
  xeByBks(bks: string): Promise<import('./types.js').XeRow | undefined>;
  usersList(role?: string): Promise<import('./types.js').UserRow[]>;
  userByLogin(login: string): Promise<import('./types.js').UserRow | undefined>;
  userByName(name: string): Promise<import('./types.js').UserRow | undefined>;
  bieuMaGroups(): Promise<import('./types.js').BieuMaGroup[]>;
  itemMap(): Promise<Record<number, number>>;
  phieuList(): Promise<import('./types.js').PhieuRow[]>;
  phieuByBks(bks: string): Promise<import('./types.js').PhieuRow[]>;
  phieuById(id: string): Promise<import('./types.js').PhieuRow | undefined>;
  ketQuaByPhieu(phieuId: string): Promise<import('./types.js').KetQuaRow[]>;
  ketQuaByBks(bks: string): Promise<import('./types.js').KetQuaJoinedRow[]>;
  deleteKetQua(phieuId: string): Promise<void>;
  deletePhieu(id: string): Promise<void>;
}

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function createDb(executor: SqlExecutor): Db {
  async function row<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
    const r = await executor.query<T>(sql, params);
    return r.rows[0];
  }
  async function rows<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    const r = await executor.query<T>(sql, params);
    return r.rows;
  }
  async function run(sql: string, ...params: unknown[]): Promise<{ rowCount: number | null }> {
    const r = await executor.query(sql, params);
    fireWrite(sql);
    return { rowCount: r.rowCount ?? null };
  }
  function today(): string {
    const d = new Date();
    const p2 = (n: number): string => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  }
  function nowStamp(): string {
    return new Date().toISOString();
  }

  const db: Db = {
    row,
    rows,
    run,
    transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
      return executor.transaction((q) => fn(createDb(q)));
    },
    async nextId(prefix: string): Promise<string> {
      // FOR UPDATE trong transaction — tránh trùng số khi 2 user tạo phiếu đồng thời.
      // Hàm nghiệp vụ BẮT BUỘC bọc transaction quanh nextId + các INSERT liên quan
      // (vd scCreate gọi db.transaction). Dùng executor hiện tại để tránh nested transaction.
      await db.run("INSERT INTO config(key, value) VALUES($1, '0') ON CONFLICT (key) DO NOTHING", prefix);
      const c = await db.row<{ value: string }>(
        'SELECT value FROM config WHERE key=$1 FOR UPDATE',
        prefix
      );
      const v = (Number(c?.value) || 0) + 1;
      await db.run('UPDATE config SET value=$1 WHERE key=$2', String(v), prefix);
      return prefix + '-' + String(v).padStart(6, '0');
    },
    today,
    nowStamp,
    async logNhatKy(noiDung: string, nguoi?: string): Promise<void> {
      await run('INSERT INTO nhat_ky(thoi_gian, noi_dung, nguoi) VALUES($1,$2,$3)', nowStamp(), noiDung, nguoi || '');
    },
    async configGet(key: string, def?: string): Promise<string> {
      const r = await row<{ value: string }>('SELECT value FROM config WHERE key=$1', key);
      return r === undefined ? (def === undefined ? '' : def) : r.value;
    },
    async configSet(key: string, value: string): Promise<void> {
      await run(
        'INSERT INTO config(key, value) VALUES($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        key,
        String(value)
      );
    },
    async softDelete(table: string, idCol: string, id: string | number, user: string, bangLabel?: string): Promise<void> {
      if (!SAFE_IDENT.test(table) || !SAFE_IDENT.test(idCol)) throw new Error('Tên bảng/cột không hợp lệ.');
      await run(`UPDATE ${table} SET deleted_at = $1 WHERE ${idCol} = $2`, nowStamp(), id);
      await db.audit('delete', table, id, user, bangLabel || table);
    },
    async restoreRow(table: string, idCol: string, id: string | number, user: string): Promise<void> {
      if (!SAFE_IDENT.test(table) || !SAFE_IDENT.test(idCol)) throw new Error('Tên bảng/cột không hợp lệ.');
      await run(`UPDATE ${table} SET deleted_at = '' WHERE ${idCol} = $1`, id);
      await db.audit('restore', table, id, user);
    },
    async audit(hanhVi: string, bang: string, idDong: string | number, nguoi: string, noiDung?: string): Promise<void> {
      try {
        await run(
          'INSERT INTO log_audit(thoi_gian, nguoi, bang, id_dong, hanh_vi, noi_dung) VALUES($1,$2,$3,$4,$5,$6)',
          nowStamp(),
          nguoi || '',
          bang || '',
          String(idDong ?? ''),
          hanhVi || '',
          noiDung || ''
        );
      } catch {
        /* log lỗi không làm sập luồng */
      }
    },
    async auditList(q?: { bang?: string; nguoi?: string; tu?: string; den?: string; limit?: number }): Promise<unknown[]> {
      let sql = 'SELECT * FROM log_audit WHERE 1=1';
      const args: unknown[] = [];
      if (q && q.bang) {
        sql += ' AND bang = $' + (args.length + 1);
        args.push(q.bang);
      }
      if (q && q.nguoi) {
        sql += ' AND nguoi = $' + (args.length + 1);
        args.push(q.nguoi);
      }
      if (q && q.tu) {
        sql += ' AND thoi_gian >= $' + (args.length + 1);
        args.push(q.tu + 'T00:00:00');
      }
      if (q && q.den) {
        sql += ' AND thoi_gian <= $' + (args.length + 1);
        args.push(q.den + 'T23:59:59');
      }
      const limit = q && q.limit ? Math.min(+(q.limit) || 200, 2000) : 200;
      sql += ' ORDER BY thoi_gian DESC LIMIT ' + limit;
      return rows(sql, ...args);
    },
    async xeByBks(bks: string): Promise<import('./types.js').XeRow | undefined> {
      return row<import('./types.js').XeRow>('SELECT * FROM xe WHERE upper(bks) = upper($1)', bks);
    },
    async usersList(role?: string): Promise<import('./types.js').UserRow[]> {
      if (role) return rows<import('./types.js').UserRow>('SELECT * FROM users WHERE active = 1 AND role = $1 ORDER BY name', role);
      return rows<import('./types.js').UserRow>('SELECT * FROM users WHERE active = 1 ORDER BY role, name');
    },
    async userByLogin(login: string): Promise<import('./types.js').UserRow | undefined> {
      return row<import('./types.js').UserRow>(
        'SELECT * FROM users WHERE upper(id) = upper($1) OR upper(name) = upper($2)',
        login,
        login
      );
    },
    async userByName(name: string): Promise<import('./types.js').UserRow | undefined> {
      return row<import('./types.js').UserRow>('SELECT * FROM users WHERE upper(name) = upper($1)', name);
    },
    async bieuMaGroups(): Promise<import('./types.js').BieuMaGroup[]> {
      const raws = await rows<import('./types.js').BieuMaRow>('SELECT * FROM bieu_ma ORDER BY group_id, item_id');
      const map: Record<number, import('./types.js').BieuMaGroup> = {};
      raws.forEach((r) => {
        if (!map[r.group_id]) {
          map[r.group_id] = { group_id: r.group_id, name: r.group_name, short: r.group_short, items: [] };
        }
        map[r.group_id]!.items.push({ item_id: r.item_id, name: r.item_name, priority: r.priority || 'Bình thường' });
      });
      return Object.keys(map)
        .sort((a, b) => +a - +b)
        .map((k) => map[+k]!);
    },
    async itemMap(): Promise<Record<number, number>> {
      const out: Record<number, number> = {};
      const raws = await rows<{ item_id: number; group_id: number }>('SELECT item_id, group_id FROM bieu_ma');
      raws.forEach((r) => {
        out[r.item_id] = r.group_id;
      });
      return out;
    },
    async phieuList(): Promise<import('./types.js').PhieuRow[]> {
      return rows<import('./types.js').PhieuRow>('SELECT * FROM kiem_tra ORDER BY ngay DESC, id DESC');
    },
    async phieuByBks(bks: string): Promise<import('./types.js').PhieuRow[]> {
      return rows<import('./types.js').PhieuRow>(
        'SELECT * FROM kiem_tra WHERE upper(bks)=upper($1) ORDER BY ngay DESC, id DESC',
        bks
      );
    },
    async phieuById(id: string): Promise<import('./types.js').PhieuRow | undefined> {
      return row<import('./types.js').PhieuRow>('SELECT * FROM kiem_tra WHERE id = $1', id);
    },
    async ketQuaByPhieu(phieuId: string): Promise<import('./types.js').KetQuaRow[]> {
      return rows<import('./types.js').KetQuaRow>('SELECT * FROM ket_qua WHERE phieu_id = $1 ORDER BY item_id', phieuId);
    },
    async ketQuaByBks(bks: string): Promise<import('./types.js').KetQuaJoinedRow[]> {
      return rows<import('./types.js').KetQuaJoinedRow>(
        `SELECT k.*, p.ngay, p.mode AS p_mode
         FROM ket_qua k JOIN kiem_tra p ON p.id = k.phieu_id
         WHERE upper(k.bks) = upper($1)
         ORDER BY k.item_id, p.ngay, p.id`,
        bks
      );
    },
    async deleteKetQua(phieuId: string): Promise<void> {
      await run('DELETE FROM ket_qua WHERE phieu_id = $1', phieuId);
    },
    async deletePhieu(id: string): Promise<void> {
      await run('DELETE FROM kiem_tra WHERE id = $1', id);
    },
  };

  return db;
}

export default { createDb, makePgExecutor, makePgliteExecutor, onWrite };