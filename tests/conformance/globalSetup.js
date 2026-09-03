const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Global variables to store state
let pg;
let db;
const tokens = { admin: '', giamdoc: '', xuong: '', ketoan: '', kho: '' };

// Schema parsing functions
function parseSchema(sql) {
  const statements = [];
  let current = '';
  let inDollarQuote = false;
  let dollarTag = '';

  const norm = sql.replace(/\r\n/g, '\n');
  for (const line of norm.split('\n')) {
    const noComment = line.replace(/--.*$/, '');
    const trimmed = noComment.trim();
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

function isUnsupported(stmt) {
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

// Password hashing (matches seed.ts)
const SALT = 'salt123';
const PASS_HASH = 'scrypt:' + SALT + ':' + crypto.scryptSync('cencom@123', SALT, 64).toString('hex');

// Seed functions - inline from seed.ts
async function seedConfig(client) {
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
    ['counter_HO', '0'],
  ];
  for (const [k, v] of configs) {
    await client.query(
      `INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      [k, v]
    );
  }
  console.log('✅ config seeded');
}

async function seedPhongBan(client) {
  const pb = [
    ['pb1', 'DX', 'Đội xe đầu kéo', 'Quản lý xe đầu kéo'],
    ['pb2', 'KT', 'Kế toán', 'Phòng kế toán'],
    ['pb3', 'KHO', 'Kho vật tư', 'Quản lý kho'],
    ['pb4', 'XL', 'Xưởng sửa chữa', 'Xưởng'],
  ];
  for (const [id, code, name, note] of pb) {
    await client.query(
      `INSERT INTO phong_ban (id, code, name, note, deleted_at) VALUES ($1,$2,$3,$4,'') ON CONFLICT (id) DO NOTHING`,
      [id, code, name, note]
    );
  }
  console.log('✅ phong_ban seeded');
}

async function seedXe(client, seedDir) {
  const seedPath = path.join(seedDir, 'seed_xe.json');
  const xeData = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));
  for (const x of xeData) {
    await client.query(
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
  console.log(`✅ ${xeData.length} xe seeded`);
}

async function seedVattu(client) {
  const vattuData = [
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
    await client.query(
      `INSERT INTO vattu (id, code, name, nhom, donvi, gia, ton, ton_min, ton_cu_hong, active, deleted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,1,'') ON CONFLICT (id) DO NOTHING`,
      [v.id, v.code, v.name, v.nhom, v.don_vi, v.gia, v.ton, v.ton_min]
    );
  }
  await client.query(`SELECT setval(pg_get_serial_sequence('vattu','id'), (SELECT MAX(id) FROM vattu))`);
  console.log(`✅ ${vattuData.length} vattu seeded`);
}

async function seedCoA(client) {
  const coaPath = path.join(__dirname, '../../packages/db/src/coa_seed.sql');
  const sql = fs.readFileSync(coaPath, 'utf-8');
  for (const stmt of sql.split(';')) {
    const s = stmt.trim();
    if (!s) continue;
    await client.query(s);
  }
  console.log('✅ CoA (kế toán) seeded');
}

async function seedUsers(client) {
  const users = [
    ['U-ADMIN', 'Quản trị viên', 'admin', '', PASS_HASH, 1, 1, ''],
    ['U-GIAMDOC', 'Giám đốc', 'giamdoc', '', PASS_HASH, 1, 1, 'Ban giám đốc'],
    ['U-XUONG', 'Xưởng trưởng', 'xuong', '', PASS_HASH, 1, 1, 'Xưởng'],
    ['U-KETOAN', 'Kế toán', 'ketoan', '', PASS_HASH, 1, 1, 'Kế toán'],
    ['U-KHO', 'Thủ kho', 'kho', '', PASS_HASH, 1, 1, 'Kho'],
  ];
  for (const [id, name, role, phone, hash, active, mustChange, pb] of users) {
    try {
      const result = await client.query(
        `INSERT INTO users (id, name, role, phone, pass_hash, active, must_change, phong_ban, deleted_at, tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'','c1')
         ON CONFLICT (id) DO NOTHING`,
        [id, name, role, phone, hash, active, mustChange, pb]
      );
      console.log(`  Insert user ${name} (${id}):`, result);
    } catch (e) {
      console.error(`  Failed to insert user ${name}:`, e.message);
    }
  }
  console.log(`✅ ${users.length} users seeded`);
  
  // Verify users
  const check = await client.query('SELECT id, name, role, pass_hash FROM users WHERE active = 1');
  console.log('Users in DB:', check.rows);
}

async function seedPhanQuyen(client) {
  const matrix = {
    tho: { sc: ['xem', 'tao', 'sua'], asset: ['xem'], kho: ['xem'], xe: ['xem'], report: ['xem'], chat: ['xem', 'tao', 'sua'], gd2: ['xem', 'tao', 'sua'] },
    khovattu: { kho: ['xem', 'tao', 'sua', 'xuat'], mua: ['xem', 'tao'], sc: ['xem'], xe: ['xem'], chat: ['xem', 'tao', 'sua'], gd2: ['xem'] },
    pttb: { sc: ['xem', 'duy', 'kehoach'], mua: ['xem', 'duy', 'tao'], de_xuat: ['xem', 'duy'], kho: ['xem'], asset: ['xem'], xe: ['xem'], report: ['xem'], chat: ['xem', 'tao', 'sua'], xuong: ['xem'], gd2: ['xem'], search: ['xem'], ke_toan: ['xem'] },
    laixe: { de_xuat: ['xem', 'tao', 'sua'], xe: ['xem'], sc: ['xem'], chat: ['xem', 'tao'], gd2: ['xem'], search: ['xem'] },
    ketoan: { mua: ['xem', 'tao', 'duy'], asset: ['xem', 'quyet'], sc: ['xem', 'tao', 'kehoach'], kho: ['xem'], xe: ['xem'], report: ['xem'], chat: ['xem', 'tao', 'sua'], gd2: ['xem'] },
    quanly: { sc: ['xem', 'duy', 'kehoach'], asset: ['xem', 'quyet'], kho: ['xem'], mua: ['xem'], xe: ['xem'], report: ['xem'], chat: ['xem', 'tao', 'sua'], de_xuat: ['xem', 'duy'], xuong: ['xem'], gd2: ['xem', 'tao', 'sua'] },
    giamdoc: { sc: ['xem', 'duy', 'kehoach'], asset: ['xem', 'duy'], kho: ['xem'], mua: ['xem', 'duy'], xe: ['xem'], report: ['xem'], chat: ['xem', 'tao', 'sua'], de_xuat: ['xem', 'duy'], xuong: ['xem'], gd2: ['xem', 'tao', 'sua'] },
    xuong: { de_xuat: ['xem', 'tao', 'sua'], xuong: ['xem'], sc: ['xem', 'tao', 'sua', 'kehoach'], asset: ['xem'], kho: ['xem'], xe: ['xem'], report: ['xem'], chat: ['xem', 'tao', 'sua'], gd2: ['xem', 'tao', 'sua'] },
    kho: { kho: ['xem', 'tao', 'sua', 'xuat'], mua: ['xem', 'tao'], sc: ['xem'], xe: ['xem'], chat: ['xem', 'tao', 'sua'], gd2: ['xem'] },
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
              await client.query(
                `INSERT INTO phan_quyen (role, module, feature) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
                [role, m, f]
              );
            }
          }
        } else {
          await client.query(
            `INSERT INTO phan_quyen (role, module, feature) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
            [role, module, feature]
          );
        }
      }
    }
  }
  console.log('✅ phan_quyen seeded');
}

// Auth functions - inline from auth.ts
function newToken() {
  return crypto.randomBytes(24).toString('hex');
}

async function createSession(client, userId) {
  try {
    await pg.query('DELETE FROM sessions WHERE expires_at < now()');
  } catch (e) {
    console.log('DELETE sessions error (ignored):', e.message);
  }
  const token = newToken();
  try {
    const result = await pg.query(
      "INSERT INTO sessions(token, user_id, expires_at) VALUES($1,$2, now() + ($3 || ' days')::interval)",
      [token, userId, 14]
    );
    console.log('createSession result:', result);
  } catch (e) {
    console.log('INSERT session error:', e.message, e.stack);
    throw e;
  }
  return token;
}

async function authenticatePassword(client, login, pw) {
  if (!login) return null;
  const user = await client.query(
    'SELECT * FROM users WHERE active = 1 AND (upper(id) = upper($1) OR upper(name) = upper($2))',
    [login, login]
  );
  console.log('authenticatePassword query result:', { login, rowCount: user.rows?.length, rows: user.rows });
  if (!user.rows.length) return null;
  const u = user.rows[0];
  
  // Verify password
  if (!u.pass_hash || !pw) return null;
  const parts = String(u.pass_hash).split(':');
  if (parts[0] !== 'scrypt' || parts.length !== 3) return null;
  const [, salt, hashHex] = parts;
  const a = Buffer.from(hashHex, 'hex');
  const b = crypto.scryptSync(String(pw), salt, 64);
  console.log('password verify:', { salt, hashHex, pw, match: a.length === b.length && crypto.timingSafeEqual(a, b) });
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  
  return {
    id: u.id,
    name: u.name,
    role: u.role,
    phone: u.phone,
    phong_ban: u.phong_ban || '',
    must_change: !!u.must_change,
  };
}

async function loginUser(client, name) {
  const actor = await authenticatePassword(client, name, 'cencom@123');
  if (!actor) throw new Error(`Login failed for ${name}`);
  const token = await createSession(client, actor.id);
  return token;
}

// Main globalSetup function
async function globalSetup() {
  // Disable rate limiting for tests
  process.env.LOGIN_RATE_LIMIT = '0';

  pg = new PGlite();

  const SCHEMA_PATH = path.resolve(__dirname, '../../packages/db/schema.sql');
  const SEED_DIR = path.resolve(__dirname, '../../packages/db/seed');

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const statements = parseSchema(schema);
  for (const stmt of statements) {
    if (isUnsupported(stmt)) continue;
    try {
      await pg.query(stmt);
    } catch (e) {
      if (
        !e.message.includes('already exists') &&
        !e.message.includes('duplicate') &&
        !e.message.includes('syntax error')
      ) {
        console.warn('Schema skip:', stmt.slice(0, 80), '→', e.message);
      }
    }
  }

  const client = {
    query: async (text, params) => {
      const result = await pg.query(text, params);
      return { rows: result.rows || result };
    },
  };

  await seedConfig(client);
  await seedPhongBan(client);
  await seedXe(client, SEED_DIR);
  await seedVattu(client);
  await seedCoA(client);
  await seedUsers(client);
  await seedPhanQuyen(client);
  console.log('✅ Seed hoàn tất!');

  // Create a simple db wrapper
  db = {
    query: async (text, params) => {
      const result = await pg.query(text, params);
      return { rows: result.rows || result };
    },
    row: async (text, params) => {
      const result = await pg.query(text, params);
      return result.rows?.[0] || null;
    },
    rows: async (text, params) => {
      const result = await pg.query(text, params);
      return result.rows || [];
    },
    run: async (text, params) => {
      const result = await pg.query(text, params);
      return { rowCount: result.affectedRows || result.rowCount || 0 };
    },
    audit: async (action, table, id, actor, note) => {
      await pg.query(
        `INSERT INTO log_audit (bang, id_bang, hanh_vi, nguoi, ghi_chu, created_at) VALUES ($1,$2,$3,$4,$5,now())`,
        [table, id, action, actor, note]
      );
    },
    auditList: async ({ bang, nguoi, tu, den, limit }) => {
      let sql = 'SELECT * FROM log_audit WHERE 1=1';
      const params = [];
      if (bang) { params.push(bang); sql += ` AND bang = $${params.length}`; }
      if (nguoi) { params.push(nguoi); sql += ` AND nguoi = $${params.length}`; }
      if (tu) { params.push(tu); sql += ` AND created_at >= $${params.length}`; }
      if (den) { params.push(den); sql += ` AND created_at <= $${params.length}`; }
      sql += ' ORDER BY created_at DESC';
      if (limit) { params.push(limit); sql += ` LIMIT $${params.length}`; }
      const result = await pg.query(sql, params);
      return result.rows || [];
    },
  };

  const USERS = [
    { login: 'U-ADMIN', role: 'admin' },
    { login: 'U-GIAMDOC', role: 'giamdoc' },
    { login: 'U-XUONG', role: 'xuong' },
    { login: 'U-KETOAN', role: 'ketoan' },
    { login: 'U-KHO', role: 'kho' },
  ];

  for (const u of USERS) {
    const token = await loginUser(client, u.login);
    tokens[u.role] = token;
  }

  console.log('✅ Global Setup: 5 users logged in');

  // Store in global for tests to access
  global.__TEST_DB__ = db;
  global.__TEST_PG__ = pg;
  global.__TEST_TOKENS__ = tokens;
}

// Export for Jest
module.exports = globalSetup;