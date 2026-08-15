/**
 * helpers.ts — Test helper dùng chung cho packages/core.
 * Tạo PGlite (Postgres WASM) + chạy schema.sql + seed đầy đủ (42 xe,
 * users, MATRIX, config) → trả Db và các stub auth/perm cho module port.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { seedAll } from '@cencom/db';
import { createDb, makePgliteExecutor, type Db } from '../src/db.js';
import { SCALE, SCALE_ORDER } from '../src/scoring.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(__dirname, '..', '..', 'db', 'schema.sql');
const SEED_DIR = join(__dirname, '..', '..', 'db', 'seed');

/** PGlite không hỗ trợ: extensions, PL/pgSQL, RLS, partitions. */
function isUnsupported(stmt: string): boolean {
  return (
    stmt.startsWith('CREATE EXTENSION') ||
    stmt.startsWith('CREATE OR REPLACE FUNCTION') ||
    stmt.startsWith('CREATE FUNCTION') ||
    stmt.includes('LANGUAGE plpgsql') ||
    stmt.includes('PARTITION OF') ||
    stmt.includes('ROW LEVEL SECURITY') ||
    stmt.includes('CREATE POLICY') ||
    stmt.includes('LANGUAGE sql') ||
    stmt.startsWith('$$')
  );
}

/** Parse schema.sql thành các statement, bỏ comment/trống. */
function parseSchema(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';

  for (const line of sql.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('--')) continue;

    current += line + '\n';

    const dollarMatch = line.match(/\$([^$]*)\$/);
    if (dollarMatch) {
      if (!inDollarQuote) {
        inDollarQuote = true;
        dollarTag = dollarMatch[0];
      } else if (line.includes(dollarTag)) {
        inDollarQuote = false;
        dollarTag = '';
      }
    }

    if (!inDollarQuote && trimmed.endsWith(';')) {
      statements.push(current.trim());
      current = '';
    }
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

export interface Actor {
  id: string;
  name: string;
  role: string;
  phone?: string;
  phong_ban?: string;
}

export interface TestCtx {
  pg: PGlite;
  db: Db;
  actor: Actor | null;
  /** Stub auth: current() trả actor hiện tại — test tự set qua setActor(). */
  auth: {
    current(): Actor | null;
    currentName(): string;
  };
  /** Stub perm: MATRIX mặc định — test có thể override bằng tay nếu cần. */
  perm: {
    can(db: Db, role: string, m: string, f: string): Promise<boolean>;
    canApproveSC(db: Db, role: string, tong: number): Promise<boolean>;
    canApproveMua(db: Db, role: string, tong: number): Promise<boolean>;
    canQuyetToan(role: string): boolean;
    scNguong(db: Db): Promise<number>;
    muaNguong(db: Db): Promise<number>;
  };
  setActor(a: Actor | null): void;
}

export async function makeCtx(): Promise<TestCtx> {
  const pg = new PGlite();
  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  // Parse + filter cho PGlite (bỏ extensions, functions, RLS)
  const statements = parseSchema(schema);
  for (const stmt of statements) {
    if (isUnsupported(stmt)) continue;
    try {
      await pg.query(stmt);
    } catch (e: any) {
      if (
        !e.message.includes('already exists') &&
        !e.message.includes('duplicate') &&
        !e.message.includes('syntax error')
      ) {
        console.warn('Schema skip:', stmt.slice(0, 80), '→', e.message);
      }
    }
  }
  // seedAll nhận SqlClient (query) — wrapper cho PGlite
  const client = {
    query: async <T>(text: string, params?: unknown[]): Promise<{ rows: T[] }> =>
      (await pg.query<T>(text, params as never[])) as { rows: T[] },
  };
  await seedAll(client, SEED_DIR);

  const db = createDb(makePgliteExecutor(pg));
  let actor: Actor | null = null;

  const ctx: TestCtx = {
    pg,
    db,
    actor,
    auth: {
      current: () => actor,
      currentName: () => (actor ? actor.name : ''),
    },
    // Hàm quyền MẶC ĐỊNH đọc từ bảng phan_quyen (đã seed MATRIX) + fallback
    perm: {
      async can(d, role, m, f) {
        const r = String(role || '').toLowerCase();
        if (r === 'admin') return true;
        const row = await d.row<{ one: number }>(
          'SELECT 1 AS one FROM phan_quyen WHERE role=$1 AND module=$2 AND feature=$3',
          r,
          String(m),
          String(f)
        );
        if (row) return true;
        // fallback MATRIX (giống perm.ts) — test không phụ thuộc seedPerms
        const matrix = (await import('../src/perm.js')).MATRIX;
        if (matrix[r] && matrix[r]![m] && matrix[r]![m]!.indexOf(String(f)) >= 0) return true;
        return false;
      },
      async canApproveSC(d, role, tong) {
        const r = String(role).toLowerCase();
        if (r === 'admin' || r === 'giamdoc') return true;
        if (r === 'quanly') return Number(tong) <= (Number(await d.configGet('duyet_sc_nguong', '0')) || 0);
        return false;
      },
      async canApproveMua(d, role, tong) {
        const r = String(role).toLowerCase();
        if (r === 'admin' || r === 'giamdoc') return true;
        if (r === 'ketoan') return Number(tong) <= (Number(await d.configGet('duyet_mua_nguong', '0')) || 0);
        return false;
      },
      canQuyetToan(role: string) {
        const r = String(role).toLowerCase();
        return r === 'admin' || r === 'ketoan' || r === 'giamdoc' || r === 'quanly';
      },
      async scNguong(d) {
        return Number(await d.configGet('duyet_sc_nguong', '0')) || 0;
      },
      async muaNguong(d) {
        return Number(await d.configGet('duyet_mua_nguong', '0')) || 0;
      },
    },
    setActor(a) {
      actor = a;
    },
  };

  return ctx;
}

export { SCALE, SCALE_ORDER };