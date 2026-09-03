import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { hashPassword } from '../lib/auth';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

interface XeSeed {
  id: string;
  bks?: string;
  bien_so?: string;
  chu_xe?: string;
  nam_sx?: unknown;
  nguyen_gia?: unknown;
}

interface UserSeed {
  id: string;
  name: string;
  role: string;
}

const COUNTERS = [
  'counter_XE',
  'counter_SC',
  'counter_VT',
  'counter_DM',
  'counter_BG',
  'counter_HS',
  'counter_NX',
];

export async function seed(): Promise<{ xe: number; users: UserSeed[]; counters: string[] }> {
  // 1) Nạp danh sách xe mẫu
  const jsonPath = resolve(__dirname, 'seed_xe.json');
  const xeList = JSON.parse(readFileSync(jsonPath, 'utf8')) as XeSeed[];

  let xeCount = 0;
  for (const x of xeList) {
    const bien_so = (x.bks ?? x.bien_so ?? '').toString();
    const chu_xe = x.chu_xe != null ? x.chu_xe.toString() : null;
    const nam_sx = Number(x.nam_sx) || null;
    const nguyen_gia = Number(x.nguyen_gia) || 0;
    await pool.query(
      `INSERT INTO xe (id, bien_so, chu_xe, nam_sx, nguyen_gia, is_test, deleted_at)
       VALUES ($1, $2, $3, $4, $5, 0, '')
       ON CONFLICT (id) DO NOTHING`,
      [x.id, bien_so, chu_xe, nam_sx, nguyen_gia]
    );
    xeCount++;
  }

  // 2) Tạo 5 users (mật khẩu chung, bắt buộc đổi lần đầu)
  const users: UserSeed[] = [
    { id: 'U-ADMIN', name: 'admin', role: 'admin' },
    { id: 'U-GIAMDOC', name: 'giamdoc', role: 'giamdoc' },
    { id: 'U-XUONG', name: 'xuong', role: 'xuong' },
    { id: 'U-KETOAN', name: 'ketoan', role: 'ketoan' },
    { id: 'U-KHO', name: 'kho', role: 'kho' },
  ];
  const pass = 'cencom@123';
  const pass_hash = hashPassword(pass);
  for (const u of users) {
    await pool.query(
      `INSERT INTO users (id, name, role, pass_hash, must_change, deleted_at)
       VALUES ($1, $2, $3, $4, 1, '')
       ON CONFLICT (id) DO NOTHING`,
      [u.id, u.name, u.role, pass_hash]
    );
  }

// 3) Seed vattu (2 mẫu) — dùng cho scAddVatTu, nhapKho, xuatKho, dmCreate tests
  // vattuList filter: is_test=0 → seed với is_test=0
  const vattuSeeds = [
    { id: 'VT-000001', ten: 'Bộ lọc dầu', don_vi: 'cái', ton: 50, gia: 120000, ton_min: 10 },
    { id: 'VT-000002', ten: 'Buggi phanh', don_vi: 'bộ', ton: 20, gia: 500000, ton_min: 5 },
  ];
  for (const vt of vattuSeeds) {
    await pool.query(
      `INSERT INTO vattu (id, ten, don_vi, ton, gia, ton_min, is_test, deleted_at)
       VALUES ($1, $2, $3, $4, $5, $6, 0, '')
       ON CONFLICT (id) DO NOTHING`,
      [vt.id, vt.ten, vt.don_vi, vt.ton, vt.gia, vt.ton_min]
    );
  }

  // 4) Khởi tạo counters trong bảng config
  for (const c of COUNTERS) {
    await pool.query(
      `INSERT INTO config (key, value) VALUES ($1, '0')
       ON CONFLICT (key) DO NOTHING`,
      [c]
    );
  }
  // counter_VT = 2 vì seed đã tạo VT-000001, VT-000002
  await pool.query(
    `UPDATE config SET value='2' WHERE key='counter_VT'`
  );

  return { xe: xeCount, users, counters: COUNTERS };
}

// Allow direct execution: `tsx db/seed.ts` or `node db/seed.js`
// Use require.main === module (CommonJS) or check process.argv
const isMain = typeof require !== 'undefined' && require.main === module;

if (isMain) {
  seed()
    .then(async (r) => {
      console.log(`[seed] Da nap ${r.xe} xe + ${r.users.length} users + ${r.counters.length} counters`);
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[seed] Loi:', err);
      try {
        await pool.end();
      } catch {
        /* ignore */
      }
      process.exit(1);
    });
}