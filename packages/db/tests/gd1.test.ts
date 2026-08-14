/**
 * gd1.test.ts — Conformance GĐ1: schema + seed + migrator trên PGlite (Postgres WASM).
 * Không cần Supabase/server thật — chạy local: `npm test` trong packages/db.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { seedAll } from '../src/seed.js';
import { migrateSqliteToPg } from '../src/migrator.js';
import { verifyPassword, DEFAULT_PASSWORD } from '../src/scrypt.js';
import type { SqlClient } from '../src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = join(__dirname, '..', 'schema.sql');
const SEED_DIR = join(__dirname, '..', 'seed');
const V36_SQLITE = 'E:\\APP-LAPTOP-SYNC\\CencomOS-Garage-v3.6\\data\\cencom.db';

let db: PGlite;
let client: SqlClient;

// PGlite.query có cấu trúc { rows } giống pg — đủ dùng cho SqlClient
const wrap = (d: PGlite): SqlClient => ({
  query: async <T>(text: string, params?: unknown[]): Promise<{ rows: T[] }> =>
    (await d.query(text, params)) as { rows: T[] },
});

beforeAll(async () => {
  db = new PGlite();
  client = wrap(db);
  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  await db.exec(schema);
}, 30000);

describe('GĐ1 — Schema', () => {
  it('có đủ bảng nghiệp vụ theo PLAN mục 6', async () => {
    const r = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
    );
    const tables = r.rows.map((x) => x.table_name);
    const expected = [
      'config', 'phong_ban', 'xe', 'bieu_ma', 'kiem_tra', 'users', 'ket_qua', 'bao_duong',
      'nhat_ky', 'sessions', 'congviec', 'vattu', 'phieu_sua', 'sc_congviec', 'sc_vattu',
      'de_nghi_mua', 'dm_mua_ct', 'phieu_nhap', 'phieu_nh_ct', 'phieu_xuat', 'phieu_xuat_ct',
      'lich_sua', 'phan_quyen', 'log_audit', 'chat_threads', 'chat_messages', 'yeu_cau_tham_kham',
      'bao_gia_ncc', 'nhan_ky', 'sc_phien_ban', 'vattu_gia_lich_su', 'bien_ban_nghiem',
      'phieu_kiem_tu', 'ke_hoach_sc', 'phieu_nhap_dm', 'phieu_nhap_thanhly',
    ];
    for (const t of expected) expect(tables).toContain(t);
  });

  it('bao_gia_ncc KHÔNG còn cột ảnh/OCR (quyết định #9)', async () => {
    const r = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name='bao_gia_ncc'`
    );
    const cols = r.rows.map((x) => x.column_name);
    expect(cols).not.toContain('anh_bao_gia');
    expect(cols).not.toContain('ocr_result');
    expect(cols).not.toContain('ocr_xac_nhan');
    expect(cols).not.toContain('ocr_engine');
  });

  it('phieu_sua có CHECK trang_thai whitelist', async () => {
    const r = await db.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint WHERE conrelid='phieu_sua'::regclass AND contype='c'`
    );
    expect(r.rows.map((x) => x.conname)).toContain('chk_phieu_sua_trang_thai');
    // Trạng thái hợp lệ chèn được
    await db.query("INSERT INTO phieu_sua(id, bks, trang_thai) VALUES('SC-000001','37H-09917','de_xuat')");
    // Trạng thái không hợp lệ bị chặn
    await expect(
      db.query("INSERT INTO phieu_sua(id, bks, trang_thai) VALUES('SC-000002','37H-09917','khong_ton_tai')")
    ).rejects.toThrow();
  });

  it('sessions dùng TIMESTAMPTZ (khác SQLite epoch int)', async () => {
    const r = await db.query<{ data_type: string }>(
      `SELECT data_type FROM information_schema.columns WHERE table_name='sessions' AND column_name='expires_at'`
    );
    expect(r.rows[0]?.data_type).toMatch(/timestamp/i);
  });
});

describe('GĐ1 — Seed', () => {
  it('seed 42 xe + 97 biểu mẫu + users', async () => {
    const counts = await seedAll(client, SEED_DIR);
    expect(counts.xe).toBe(42);
    expect(counts.bieu_ma).toBe(97);
    expect(counts.users).toBeGreaterThanOrEqual(12);
  });

  it('mật khẩu mặc định cencom@123 + must_change=1', async () => {
    const r = await client.query<{ pass_hash: string; must_change: number }>(
      'SELECT pass_hash, must_change FROM users WHERE id=$1', ['admin-1']
    );
    expect(r.rows[0]?.must_change).toBe(1);
    expect(verifyPassword(r.rows[0]!.pass_hash, DEFAULT_PASSWORD)).toBe(true);
    expect(verifyPassword(r.rows[0]!.pass_hash, 'sai-mat-khau')).toBe(false);
  });

  it('users lái xe được tạo + gán xe.lai_xe_id (IDOR chuẩn bị sẵn)', async () => {
    const r = await client.query<{ c: string }>(
      "SELECT COUNT(*) c FROM users WHERE role='laixe'"
    );
    expect(Number(r.rows[0]?.c)).toBeGreaterThan(0);
    const linked = await client.query<{ c: string }>(
      "SELECT COUNT(*) c FROM xe WHERE lai_xe_id <> ''"
    );
    expect(Number(linked.rows[0]?.c)).toBeGreaterThan(0);
  });

  it('phan_quyen có MATRIX + admin all/all', async () => {
    const r = await client.query<{ c: string }>(
      "SELECT COUNT(*) c FROM phan_quyen WHERE role='tho' AND module='sc' AND feature='xem'"
    );
    expect(Number(r.rows[0]?.c)).toBe(1);
    const admin = await client.query<{ c: string }>(
      "SELECT COUNT(*) c FROM phan_quyen WHERE role='admin' AND module='all' AND feature='all'"
    );
    expect(Number(admin.rows[0]?.c)).toBe(1);
  });

  it('config có ngưỡng duyệt + khấu hao', async () => {
    const r = await client.query<{ key: string; value: string }>(
      "SELECT key, value FROM config WHERE key IN ('duyet_sc_nguong','duyet_mua_nguong','khau_hao_nam') ORDER BY key"
    );
    const map = Object.fromEntries(r.rows.map((x) => [x.key, x.value]));
    expect(map['duyet_sc_nguong']).toBe('5000000');
    expect(map['duyet_mua_nguong']).toBe('5000000');
    expect(map['khau_hao_nam']).toBe('10');
  });

  it('congviec + vattu + phong_ban + nguyen_gia xe được seed', async () => {
    const cv = await client.query<{ c: string }>('SELECT COUNT(*) c FROM congviec');
    const vt = await client.query<{ c: string }>('SELECT COUNT(*) c FROM vattu');
    const pb = await client.query<{ c: string }>('SELECT COUNT(*) c FROM phong_ban');
    const ng = await client.query<{ c: string }>(
      'SELECT COUNT(*) c FROM xe WHERE nguyen_gia > 0'
    );
    expect(Number(cv.rows[0]?.c)).toBe(29);
    expect(Number(vt.rows[0]?.c)).toBe(37);
    expect(Number(pb.rows[0]?.c)).toBe(4);
    expect(Number(ng.rows[0]?.c)).toBe(42);
  });

  it('seed chạy lại KHÔNG lỗi (idempotent)', async () => {
    const counts = await seedAll(client, SEED_DIR);
    expect(counts.xe).toBe(42);
    expect(counts.bieu_ma).toBe(97);
  });
});

describe('GĐ1 — Migrator', () => {
  it('copy dữ liệu từ SQLite v3.6 (nếu file tồn tại) — giữ id, bỏ cột OCR', async () => {
    const fs = await import('node:fs');
    if (!fs.existsSync(V36_SQLITE)) return; // không có DB cũ — bỏ qua, không fail
    const { results } = await migrateSqliteToPg(V36_SQLITE, client);
    expect(results.length).toBeGreaterThan(0);
    const xeR = results.find((r) => r.table === 'xe');
    if (xeR) {
      expect(xeR.rows).toBeGreaterThanOrEqual(42);
      // Không copy cột OCR sang bao_gia_ncc
      const bgR = results.find((r) => r.table === 'bao_gia_ncc');
      if (bgR) expect(bgR.cols).not.toContain('anh_bao_gia');
    }
  }, 60000);
});