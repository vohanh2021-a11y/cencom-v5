/**
 * seed.ts — Nạp dữ liệu mẫu cho cencomOS_gara_4.0_supa (GĐ1).
 * 42 xe (seed_xe.json) + users mặc định + phan_quyen + config + counter.
 * Idempotent: ON CONFLICT DO NOTHING.
 * Library: await seedAll(client, seedDir) — dùng trong test (PGlite client).
 * CLI: npx tsx packages/db/src/seed.ts (cần DATABASE_URL trong .env).
 */
import pg from 'pg';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SqlClient {
  query<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }>;
}

async function loadJson<T>(seedDir: string, relPath: string): Promise<T> {
  const full = path.join(seedDir, relPath);
  const txt = await fs.readFile(full, 'utf-8');
  return JSON.parse(txt) as T;
}

async function exec(client: SqlClient, sql: string, params?: any[]): Promise<void> {
  await client.query(sql, params);
}

/** Seed config (ngưỡng duyệt, khấu hao, counter) */
async function seedConfig(client: SqlClient): Promise<void> {
  const configs = [
    ['duyet_sc_nguong', '5000000'],
    ['duyet_mua_nguong', '5000000'],
    ['khau_hao_nam', '10'],
    ['counter_XE', '0'],
    ['counter_KT', '0'],
    ['counter_SC', '0'],
    ['counter_DX', '0'],
    ['counter_DNM', '0'],
    ['counter_PXN', '0'],
    ['counter_PXX', '0'],
    ['counter_BD', '0'],
  ];
  for (const [k, v] of configs) {
    await exec(client,
      `INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      [k, v]
    );
  }
  console.log('��� config seeded');
}

/** Seed phòng ban */
async function seedPhongBan(client: SqlClient): Promise<void> {
  const pb = [
    ['pb1', 'DX', 'Đội xe đầu kéo', 'Quản lý xe đầu kéo'],
    ['pb2', 'KT', 'Kế toán', 'Phòng kế toán'],
    ['pb3', 'KHO', 'Kho vật tư', 'Quản lý kho'],
    ['pb4', 'XL', 'Xưởng sửa chữa', 'Xưởng'],
  ];
  for (const [id, code, name, note] of pb) {
    await exec(client,
      `INSERT INTO phong_ban (id, code, name, note, deleted_at) VALUES ($1,$2,$3,$4,'') ON CONFLICT (id) DO NOTHING`,
      [id, code, name, note]
    );
  }
  console.log('��� phong_ban seeded');
}

/** Seed 42 xe từ seed_xe.json */
async function seedXe(client: SqlClient, seedDir: string): Promise<void> {
  const xeData = await loadJson<any[]>(seedDir, 'seed_xe.json');
  for (const x of xeData) {
    await exec(client,
      `INSERT INTO xe (id, bks, bien_so_cu, hang, dong, nam_sx, lai_xe, phong_ban, trang_thai, loai_pt, ghi_chu, nguyen_gia, lai_xe_id, deleted_at, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'',0,$11,'','c1')
       ON CONFLICT (id) DO NOTHING`,
      [
        x.id, x.bks, x.bien_so_cu || '', x.hang, x.dong, x.nam_sx,
        x.lai_xe || '', x.phong_ban, x.trang_thai,
        x.loai_pt, x.lai_xe_id || ''
      ]
    );
  }
  console.log(`��� ${xeData.length} xe seeded`);
}

/** Seed users mặc định (mật khẩu: cencom@123, must_change=1) */
async function seedUsers(client: SqlClient): Promise<void> {
  const passHash = 'scrypt:salt123:0705035993af61b00c27f0a003991fcfc0bef17199637781e1c8ffd470e65e5763ad6c59459be983b39523685400695e7815e3876ec5986582af384487ff7a0b';

  const users = [
    ['admin-1', 'Admin', 'admin', '', passHash, 1, 1, 'IT'],
    ['tho-1', 'Thợ 1', 'tho', '', passHash, 1, 1, 'Xưởng'],
    ['tho-2', 'Thợ 2', 'tho', '', passHash, 1, 1, 'Xưởng'],
    ['tho-3', 'Thợ 3', 'tho', '', passHash, 1, 1, 'Xưởng'],
    ['tho-4', 'Thợ 4', 'tho', '', passHash, 1, 1, 'Xưởng'],
    ['tho-5', 'Thợ 5', 'tho', '', passHash, 1, 1, 'Xưởng'],
    ['khoa-1', 'Thủ kho', 'khoa', '', passHash, 1, 1, 'Kho'],
    ['ketoan-1', 'Kế toán', 'ketoan', '', passHash, 1, 1, 'Kế toán'],
    ['quanly-1', 'Quản lý', 'quanly', '', passHash, 1, 1, 'Đội xe'],
    ['giamdoc-1', 'Giám đốc', 'giamdoc', '', passHash, 1, 1, 'Ban giám đốc'],
    ['xuong-1', 'Quản lý xưởng', 'xuong', '', passHash, 1, 1, 'Xưởng'],
  ];

  for (const [id, name, role, phone, hash, active, mustChange, pb] of users) {
    await exec(client,
      `INSERT INTO users (id, name, role, phone, pass_hash, active, must_change, phong_ban, deleted_at, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'','c1')
       ON CONFLICT (id) DO NOTHING`,
      [id, name, role, phone, hash, active, mustChange, pb]
    );
  }
  console.log(`��� ${users.length} users seeded`);
}

/** Seed phan_quyen từ MATRIX (7 vai × 12 module) */
async function seedPhanQuyen(client: SqlClient): Promise<void> {
  const matrix: Record<string, Record<string, string[]>> = {
    tho: { sc: ['xem', 'tao', 'sua'], asset: ['xem'], kho: ['xem'], xe: ['xem'], report: ['xem'], chat: ['xem', 'tao', 'sua'], gd2: ['xem', 'tao', 'sua'] },
    khoa: { kho: ['xem', 'tao', 'sua', 'xuat'], mua: ['xem', 'tao'], sc: ['xem'], xe: ['xem'], chat: ['xem', 'tao', 'sua'], gd2: ['xem'] },
    ketoan: { mua: ['xem', 'tao', 'duy'], asset: ['xem', 'quyet'], sc: ['xem', 'tao', 'kehoach'], kho: ['xem'], xe: ['xem'], report: ['xem'], chat: ['xem', 'tao', 'sua'], gd2: ['xem'] },
    quanly: { sc: ['xem', 'duy', 'kehoach'], asset: ['xem', 'quyet'], kho: ['xem'], mua: ['xem'], xe: ['xem'], report: ['xem'], chat: ['xem', 'tao', 'sua'], de_xuat: ['xem', 'duy'], xuong: ['xem'], gd2: ['xem', 'tao', 'sua'] },
    giamdoc: { sc: ['xem', 'duy', 'kehoach'], asset: ['xem', 'duy'], kho: ['xem'], mua: ['xem', 'duy'], xe: ['xem'], report: ['xem'], chat: ['xem', 'tao', 'sua'], de_xuat: ['xem', 'duy'], xuong: ['xem'], gd2: ['xem', 'tao', 'sua'] },
    xuong: { de_xuat: ['xem', 'tao', 'sua'], xuong: ['xem'], sc: ['xem', 'tao', 'sua', 'kehoach'], asset: ['xem'], kho: ['xem'], xe: ['xem'], report: ['xem'], chat: ['xem', 'tao', 'sua'], gd2: ['xem', 'tao', 'sua'] },
    admin: { all: ['xem', 'tao', 'sua', 'xoa', 'duy', 'quyet', 'kehoach', 'xuat'] },
  };

  for (const [role, modules] of Object.entries(matrix)) {
    for (const [module, features] of Object.entries(modules)) {
      for (const feature of features) {
        if (feature === 'all') {
          const allModules = ['sc', 'kho', 'mua', 'asset', 'xe', 'report', 'help', 'chat', 'de_xuat', 'xuong', 'gd2'];
          const allFeatures = ['xem', 'tao', 'sua', 'xoa', 'duy', 'quyet', 'kehoach', 'xuat'];
          for (const m of allModules) {
            for (const f of allFeatures) {
              await exec(client,
                `INSERT INTO phan_quyen (role, module, feature) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
                [role, m, f]
              );
            }
          }
        } else {
          await exec(client,
            `INSERT INTO phan_quyen (role, module, feature) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
            [role, module, feature]
          );
        }
      }
    }
  }
  console.log('��� phan_quyen seeded');
}

/** Seed vật tư mẫu (dùng cho test kho) */
async function seedVattu(client: SqlClient): Promise<void> {
  const vattuData: any[] = [
    { id: 1, code: 'VT001', name: 'Lốp xe đầu kéo', nhom: 'Lốp', don_vi: 'cái', gia: 52000, ton: 60, ton_min: 2 },
    { id: 2, code: 'VT002', name: 'Nhớt động cơ', nhom: 'Dầu nhớt', don_vi: 'can', gia: 35000, ton: 20, ton_min: 5 },
    { id: 3, code: 'VT003', name: 'Phanh đĩa', nhom: 'Phanh', don_vi: 'bộ', gia: 120000, ton: 8, ton_min: 2 },
    { id: 4, code: 'VT004', name: 'Bạc đạn bánh xe', nhom: 'Bạc đạn', don_vi: 'cái', gia: 45000, ton: 15, ton_min: 3 },
    { id: 5, code: 'VT005', name: 'Bugi', nhom: 'Đánh lửa', don_vi: 'cái', gia: 15000, ton: 30, ton_min: 10 },
    { id: 6, code: 'VT006', name: 'Dây curoa', nhom: 'Truyền động', don_vi: 'sợi', gia: 22000, ton: 12, ton_min: 3 },
    { id: 7, code: 'VT007', name: 'Lọc gió', nhom: 'Lọc', don_vi: 'cái', gia: 18000, ton: 18, ton_min: 4 },
    { id: 8, code: 'VT008', name: 'Lọc dầu', nhom: 'Lọc', don_vi: 'cái', gia: 16000, ton: 14, ton_min: 4 },
    { id: 9, code: 'VT009', name: 'Lọc nhiên liệu', nhom: 'Lọc', don_vi: 'cái', gia: 19000, ton: 11, ton_min: 3 },
    { id: 10, code: 'VT010', name: 'Cần gạt nước', nhom: 'Khác', don_vi: 'cái', gia: 12000, ton: 22, ton_min: 5 },
    { id: 11, code: 'VT011', name: 'Ắc quy', nhom: 'Điện', don_vi: 'cái', gia: 85000, ton: 9, ton_min: 2 },
    { id: 12, code: 'VT012', name: 'Đèn pha', nhom: 'Điện', don_vi: 'cái', gia: 43000, ton: 7, ton_min: 2 },
    { id: 13, code: 'VT013', name: 'Cầu chì', nhom: 'Điện', don_vi: 'cái', gia: 8000, ton: 40, ton_min: 15 },
    { id: 14, code: 'VT014', name: 'Relay', nhom: 'Điện', don_vi: 'cái', gia: 11000, ton: 35, ton_min: 12 },
    { id: 15, code: 'VT015', name: 'Bơm nước', nhom: 'Làm mát', don_vi: 'cái', gia: 38000, ton: 6, ton_min: 2 },
    { id: 16, code: 'VT016', name: 'Van hằng nhiệt', nhom: 'Làm mát', don_vi: 'cái', gia: 27000, ton: 8, ton_min: 2 },
    { id: 17, code: 'VT017', name: 'Trợ lực lái', nhom: 'Lái', don_vi: 'bộ', gia: 95000, ton: 5, ton_min: 1 },
    { id: 18, code: 'VT018', name: 'Cổ lọc gió', nhom: 'Lọc', don_vi: 'cái', gia: 21000, ton: 13, ton_min: 4 },
    { id: 19, code: 'VT019', name: 'Má phanh', nhom: 'Phanh', don_vi: 'bộ', gia: 33000, ton: 10, ton_min: 3 },
    { id: 20, code: 'VT020', name: 'Giảm xóc', nhom: 'Khung gầm', don_vi: 'cái', gia: 67000, ton: 7, ton_min: 2 },
    { id: 21, code: 'VT021', name: 'Càng xe', nhom: 'Khung gầm', don_vi: 'cái', gia: 142000, ton: 4, ton_min: 1 },
    { id: 22, code: 'VT022', name: 'Bánh răng', nhom: 'Truyền động', don_vi: 'cái', gia: 29000, ton: 16, ton_min: 5 },
    { id: 23, code: 'VT023', name: 'Xích tải', nhom: 'Truyền động', don_vi: 'sợi', gia: 31000, ton: 9, ton_min: 3 },
    { id: 24, code: 'VT024', name: 'Vòng bi', nhom: 'Bạc đạn', don_vi: 'cái', gia: 17000, ton: 25, ton_min: 8 },
    { id: 25, code: 'VT025', name: 'Cảm biến ABS', nhom: 'Điện', don_vi: 'cái', gia: 78000, ton: 6, ton_min: 2 },
    { id: 26, code: 'VT026', name: 'Bơm cao áp', nhom: 'Nhiên liệu', don_vi: 'bộ', gia: 210000, ton: 3, ton_min: 1 },
    { id: 27, code: 'VT027', name: 'Kim phun', nhom: 'Nhiên liệu', don_vi: 'cái', gia: 56000, ton: 11, ton_min: 3 },
  ];
  for (const v of vattuData) {
    await exec(client,
      `INSERT INTO vattu (id, code, name, nhom, donvi, gia, ton, ton_min, ton_cu_hong, active, deleted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,1,'') ON CONFLICT (id) DO NOTHING`,
      [v.id, v.code, v.name, v.nhom, v.don_vi, v.gia, v.ton, v.ton_min]
    );
  }
  // Cập nhật sequence để INSERT tự động (không id) không trùng PK
  await exec(client, `SELECT setval(pg_get_serial_sequence('vattu','id'), (SELECT MAX(id) FROM vattu))`);
  console.log(`✅ ${vattuData.length} vattu seeded`);
}

/** Library entry: seedAll(client, seedDir) — dùng trong test và script khác. */
export async function seedAll(client: SqlClient, seedDir: string): Promise<void> {
  console.log('���� Bắt đầu seed dữ liệu...');
  await seedConfig(client);
  await seedPhongBan(client);
  await seedXe(client, seedDir);
  await seedVattu(client);
  await seedUsers(client);
  await seedPhanQuyen(client);
  console.log('��� Seed hoàn tất!');
}

/** CLI entry: chỉ chạy khi file được execute trực tiếp (tsx seed.ts). */
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { Pool } = pg;
  const DATABASE_URL = process.env['DATABASE_URL'];
  if (!DATABASE_URL) {
    console.error('��� Thiếu DATABASE_URL trong .env');
    process.exit(1);
  }
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: 10,
    ssl: DATABASE_URL.includes('supabase') ? { rejectUnauthorized: false } : false,
  });
  const client: SqlClient = {
    query: async <T>(text: string, params?: any[]): Promise<{ rows: T[] }> =>
      (await pool.query<T>(text, params)) as { rows: T[] },
  };
  const seedDir = path.join(__dirname, '..', 'seed');
  await seedAll(client, seedDir)
    .then(() => pool.end())
    .catch((e) => {
      console.error('��� Seed l��i:', e);
      pool.end();
      process.exit(1);
    });
}