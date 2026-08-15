/**
 * migrate-tk-removal.ts — Migration script: Loại bỏ module TK, thêm DeXuat.
 * Chạy trên PRODUCTION PostgreSQL (không phải PGlite).
 *
 * Thứ tự an toàn:
 *   1. Backup dữ liệu TK → log_audit (trước khi xóa)
 *   2. Set NULL các cột FK liên quan
 *   3. Thêm cột mới (de_xuat_id) nếu chưa có
 *   4. Drop cột cũ (tk_id, bao_gia_id, danh_gia_pct) nếu tồn tại
 *   5. Drop bảng TK nếu tồn tại
 *   6. Tạo bảng de_xuat_sua_chua nếu chưa có
 *   7. Tạo indexes cho de_xuat_sua_chua
 *
 * Chạy: npx tsx packages/db/src/migrate-tk-removal.ts (cần DATABASE_URL)
 * Idempotent: kiểm tra tồn tại trước mỗi thao tác.
 */
import pg from 'pg';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

/* ---------- Helper ---------- */
async function columnExists(pool: pg.Pool, table: string, column: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`,
    [table, column]
  );
  return (r.rowCount ?? 0) > 0;
}

async function tableExists(pool: pg.Pool, table: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name=$1 AND table_type='BASE TABLE'`,
    [table]
  );
  return (r.rowCount ?? 0) > 0;
}

async function indexExists(pool: pg.Pool, indexName: string): Promise<boolean> {
  const r = await pool.query(
    `SELECT 1 FROM pg_indexes WHERE indexname=$1`,
    [indexName]
  );
  return (r.rowCount ?? 0) > 0;
}

async function audit(pool: pg.Pool, bang: string, id: string, noiDung: string): Promise<void> {
  await pool.query(
    `INSERT INTO log_audit (bang, id_dong, hanh_vi, noi_dung, nguoi, thoi_gian)
     VALUES ($1, $2, 'migrate_tk_removal', $3, 'system', now())`,
    [bang, id, noiDung]
  );
}

/* ---------- Main ---------- */
export async function migrateTkRemoval(): Promise<void> {
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

  console.log('🔄 Bắt đầu migration TK removal...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ===== 1. Backup phieu_sua.tk_id → log_audit =====
    if (await columnExists(pool, 'phieu_sua', 'tk_id')) {
      const tkRows = await client.query(
        `SELECT id, tk_id FROM phieu_sua WHERE tk_id IS NOT NULL AND tk_id <> ''`
      );
      for (const row of tkRows.rows) {
        await audit(pool, 'phieu_sua', row.id, `tk_id=${row.tk_id}`);
      }
      console.log(`  📝 Backed up ${tkRows.rowCount} phieu_sua.tk_id → log_audit`);

      // Set NULL trước khi drop
      await client.query(`UPDATE phieu_sua SET tk_id = NULL WHERE tk_id IS NOT NULL`);
      console.log('  ✅ phieu_sua.tk_id set NULL');
    }

    // ===== 2. Backup sc_vattu.bao_gia_id → log_audit =====
    if (await columnExists(pool, 'sc_vattu', 'bao_gia_id')) {
      const bgRows = await client.query(
        `SELECT id, bao_gia_id FROM sc_vattu WHERE bao_gia_id IS NOT NULL AND bao_gia_id <> ''`
      );
      for (const row of bgRows.rows) {
        await audit(pool, 'sc_vattu', row.id, `bao_gia_id=${row.bao_gia_id}`);
      }
      console.log(`  📝 Backed up ${bgRows.rowCount} sc_vattu.bao_gia_id → log_audit`);

      await client.query(`UPDATE sc_vattu SET bao_gia_id = NULL WHERE bao_gia_id IS NOT NULL`);
      console.log('  ✅ sc_vattu.bao_gia_id set NULL');
    }

    await client.query('COMMIT');

    // ===== 3. Thêm cột de_xuat_id vào phieu_sua (nếu chưa có) =====
    if (!(await columnExists(pool, 'phieu_sua', 'de_xuat_id'))) {
      await client.query(`ALTER TABLE phieu_sua ADD COLUMN de_xuat_id TEXT`);
      console.log('  ✅ Thêm cột phieu_sua.de_xuat_id');
    }

    // ===== 4. Drop cột cũ =====
    for (const [table, col] of [
      ['phieu_sua', 'tk_id'],
      ['sc_vattu', 'bao_gia_id'],
      ['xe', 'danh_gia_pct'],
    ] as const) {
      if (await columnExists(pool, table, col)) {
        await client.query(`ALTER TABLE ${table} DROP COLUMN ${col}`);
        console.log(`  🗑️  Drop ${table}.${col}`);
      }
    }

    // ===== 5. Drop indexes TK =====
    const tkIndexes = [
      'idx_yeu_cau_tham_kham_bks',
      'idx_yeu_cau_tham_kham_trang_thai',
      'idx_yeu_cau_tham_kham_ngay',
      'idx_ket_qua_bks',
      'idx_ket_qua_ngay',
      'idx_kiem_tra_bks',
      'idx_bao_duong_bks',
      'idx_bao_duong_ngay',
    ];
    for (const idx of tkIndexes) {
      if (await indexExists(pool, idx)) {
        await client.query(`DROP INDEX IF EXISTS ${idx}`);
        console.log(`  🗑️  Drop index ${idx}`);
      }
    }

    // ===== 6. Drop bảng TK (theo thứ tự phụ thuộc FK) =====
    const tkTables = ['ket_qua', 'kiem_tra', 'bao_duong', 'yeu_cau_tham_kham', 'bieu_ma'];
    for (const tbl of tkTables) {
      if (await tableExists(pool, tbl)) {
        await client.query(`DROP TABLE IF EXISTS ${tbl} CASCADE`);
        console.log(`  🗑️  Drop table ${tbl}`);
      }
    }

    // ===== 7. Tạo bảng de_xuat_sua_chua nếu chưa có =====
    if (!(await tableExists(pool, 'de_xuat_sua_chua'))) {
      await client.query(`
        CREATE TABLE de_xuat_sua_chua (
          id VARCHAR(12) PRIMARY KEY,
          bks TEXT NOT NULL,
          ngay TEXT NOT NULL DEFAULT '',
          nguoi_tao TEXT NOT NULL DEFAULT '',
          mo_ta TEXT NOT NULL DEFAULT '',
          dau_hieu TEXT NOT NULL DEFAULT '[]',
          muc_uu_tien TEXT NOT NULL DEFAULT 'Binh_thuong',
          trang_thai TEXT NOT NULL DEFAULT 'cho_duyet',
          nguoi_duyet TEXT DEFAULT '',
          ngay_duyet TEXT DEFAULT '',
          ly_do_tu_choi TEXT DEFAULT '',
          sc_id TEXT DEFAULT '',
          deleted_at TEXT DEFAULT '',
          tenant_id TEXT DEFAULT 'c1',
          CONSTRAINT chk_dx_trang_thai CHECK (trang_thai IN ('cho_duyet','da_duyet','tu_choi','da_chuyen_sc')),
          CONSTRAINT chk_dx_muc_uu_tien CHECK (muc_uu_tien IN ('Khan_cap','Xu_ly_som','Binh_thuong'))
        )
      `);
      console.log('  ✅ Tạo bảng de_xuat_sua_chua');
    }

    // ===== 8. Tạo indexes cho de_xuat_sua_chua =====
    const dxIndexes = [
      ['idx_de_xuat_bks', 'de_xuat_sua_chua', 'bks'],
      ['idx_de_xuat_trang_thai', 'de_xuat_sua_chua', 'trang_thai'],
      ['idx_de_xuat_sc_id', 'de_xuat_sua_chua', 'sc_id'],
      ['idx_de_xuat_ngay', 'de_xuat_sua_chua', 'ngay'],
    ];
    for (const [idxName, tbl, col] of dxIndexes) {
      if (!(await indexExists(pool, idxName))) {
        await client.query(`CREATE INDEX IF NOT EXISTS ${idxName} ON ${tbl} (${col})`);
        console.log(`  📇 Tạo index ${idxName}`);
      }
    }

    console.log('🎉 Migration TK removal hoàn tất!');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('❌ Migration thất bại:', e);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

/** CLI entry */
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrateTkRemoval()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
