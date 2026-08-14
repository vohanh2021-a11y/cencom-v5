/**
 * seed.ts — Seed dữ liệu khởi tạo GĐ1 (port từ server/seed.js v3.6, giữ hành vi).
 * Nạp: phòng ban, 42 xe (seed_xe.json), 97 mục biểu mẫu (seed_biemau.json),
 * users mặc định + user lái xe, phân quyền (MATRIX), config ngưỡng/khấu hao,
 * danh mục công việc + vật tư, nguyên giá xe, nhật ký.
 *
 * Lưu ý parity: ensureLaixe tạo user cho MỌI lai_xe khác rỗng trong bảng xe
 * (kể cả giá trị đặc biệt như 'Chờ Thanh Lý') — giữ nguyên hành vi v3.6.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hashPassword, DEFAULT_PASSWORD } from './scrypt.js';
import type { SqlClient } from './types.js';

const DEFAULT_PHONGBAN = [
  { code: 'PXBT', name: 'Nha may be tong' },
  { code: 'XCD', name: 'Xe cau - Doi ep coc' },
  { code: 'DXK', name: 'Doi xe dau keo' },
  { code: 'DXT', name: 'Doi xe ban tai' },
];

const DEFAULT_USERS = [
  { id: 'tho-1', name: 'To Van Minh', role: 'tho', phone: '0913.123.001' },
  { id: 'tho-2', name: 'Le Van Hung', role: 'tho', phone: '0913.123.002' },
  { id: 'tho-3', name: 'Nguyen Van Duc', role: 'tho', phone: '0913.123.003' },
  { id: 'tho-4', name: 'Pham Van Thanh', role: 'tho', phone: '0913.123.004' },
  { id: 'tho-5', name: 'Tran Van Loi', role: 'tho', phone: '0913.123.005' },
  { id: 'kho-1', name: 'Vu Thi Lan', role: 'khoa', phone: '0913.123.009' },
  { id: 'ketoan-1', name: 'Tran Thi Mai', role: 'ketoan', phone: '0913.123.006' },
  { id: 'quanly-1', name: 'Nguyen Duc Tri', role: 'quanly', phone: '0913.123.007' },
  { id: 'xuong-1', name: 'Le Quoc Khanh', role: 'xuong', phone: '0913.123.011' },
  { id: 'giamdoc-1', name: 'Trinh Nhat Ha', role: 'giamdoc', phone: '0913.123.010' },
  { id: 'admin-1', name: 'Admin', role: 'admin', phone: '0913.123.008' },
  { id: 'cenbot', name: 'CencomBot', role: 'bot', phone: '' },
];

/* Danh mục công việc sửa chữa mặc định (GĐ3) — [code, name, nhom, donvi, don_gia] */
const DEFAULT_CONGVIEC: [string, string, string, string, number][] = [
  ['CV01', 'Bao duong dinh ky', 'Dinh ky', 'lan', 1200000],
  ['CV02', 'Thay dau + loc dong co', 'Dong co', 'lan', 350000],
  ['CV03', 'Xu ly he thong phanh', 'Phanh', 'lan', 600000],
  ['CV04', 'Xu ly he thong lai', 'Lai', 'lan', 700000],
  ['CV05', 'Xu ly he thong truyen dong - cau', 'Truyen dong', 'lan', 1500000],
  ['CV06', 'Sua he thong dien', 'Dien', 'lan', 400000],
  ['CV07', 'Son - dao gam', 'Khung gam', 'lan', 900000],
  ['CV08', 'Thay - can chinh lop', 'Lop', 'lan', 250000],
  ['CV09', 'Thay piston + bac + sec-mang', 'Dong co', 'lan', 2800000],
  ['CV10', 'Dai tu dong co', 'Dong co', 'lan', 5500000],
  ['CV11', 'Thay vong bi + mat bich co', 'Dong co', 'lan', 450000],
  ['CV12', 'Ve sinh kim phun nhien lieu', 'Dong co', 'lan', 350000],
  ['CV13', 'Can chinh van (suppape)', 'Dong co', 'lan', 500000],
  ['CV14', 'Thay ma phanh + cum xi lanh', 'Phanh', 'lan', 450000],
  ['CV15', 'Ve sinh + ra ro moa phanh', 'Phanh', 'lan', 320000],
  ['CV16', 'Bom may thay vong bi moay o', 'Truyen dong', 'lan', 280000],
  ['CV17', 'Thay vong bi con lan truc', 'Truyen dong', 'lan', 420000],
  ['CV18', 'Can chinh truc cac dang', 'Truyen dong', 'lan', 550000],
  ['CV19', 'Thay vong bi moay-o cum banh xe', 'Truyen dong', 'lan', 350000],
  ['CV20', 'Han xi gam + son chong giet', 'Khung gam', 'lan', 700000],
  ['CV21', 'Thay cum nhip', 'Khung gam', 'lan', 950000],
  ['CV22', 'Thay cao su giam chan gam', 'Khung gam', 'lan', 250000],
  ['CV23', 'Sua dien cabin - hop dien trung tam', 'Dien', 'lan', 600000],
  ['CV24', 'Thay bo den pha', 'Dien', 'lan', 350000],
  ['CV25', 'Sua may phat - bo nap ac quy', 'Dien', 'lan', 500000],
  ['CV26', 'Kiem tra he thong nap', 'Dien', 'lan', 250000],
  ['CV27', 'Thay lop moi + can bang', 'Lop', 'lan', 350000],
  ['CV28', 'Khac phuc mon lech - can chinh lai', 'Lop', 'lan', 280000],
  ['CV29', 'Bao duong he thong truyen dong - cau', 'Truyen dong', 'lan', 850000],
];

/* Danh mục vật tư mặc định (GĐ3) — [code, name, nhom, donvi, gia, ton, ton_min] */
const DEFAULT_VATTU: [string, string, string, string, number, number, number][] = [
  ['VT001', 'Dau dong co 15W-40', 'Nhut', 'lit', 52000, 60, 30],
  ['VT002', 'Dau cap so ATF', 'Nhut', 'lit', 110000, 40, 20],
  ['VT003', 'Dau thuy luc', 'Nhut', 'lit', 98000, 40, 20],
  ['VT004', 'Loc dau', 'Loc', 'cai', 95000, 25, 15],
  ['VT005', 'Loc nhien lieu', 'Loc', 'cai', 160000, 20, 10],
  ['VT006', 'Loc khi', 'Loc', 'cai', 210000, 15, 8],
  ['VT007', 'Ma phanh truoc', 'Phanh', 'bo', 680000, 12, 6],
  ['VT008', 'Ma phanh sau', 'Phanh', 'bo', 620000, 12, 6],
  ['VT009', 'Xi lanh phanh cum', 'Phanh', 'bo', 480000, 8, 4],
  ['VT010', 'Dau phanh DOT3', 'Phanh', 'lit', 85000, 12, 6],
  ['VT011', 'Cao su romoai phanh', 'Phanh', 'bo', 220000, 15, 8],
  ['VT012', 'La nhip hau', 'Khung gam', 'bo', 650000, 20, 8],
  ['VT013', 'Cum nhip truoc', 'Khung gam', 'bo', 2400000, 6, 2],
  ['VT014', 'Cao su giam chan', 'Khung gam', 'cai', 180000, 15, 6],
  ['VT015', 'Ron gam - cao su hoi', 'Khung gam', 'bo', 120000, 10, 4],
  ['VT016', 'Chan may dong co', 'Khung gam', 'cai', 350000, 10, 4],
  ['VT017', 'Vong bi cum may o', 'Truyen dong', 'cai', 280000, 20, 10],
  ['VT018', 'Vong bi con lan truc', 'Truyen dong', 'cai', 390000, 12, 6],
  ['VT019', 'Vong bi cac dang', 'Truyen dong', 'cai', 310000, 10, 5],
  ['VT020', 'Bac dong co', 'Dong co', 'bo', 520000, 8, 3],
  ['VT021', 'Xu pap - tay bien', 'Dong co', 'bo', 680000, 10, 4],
  ['VT022', 'Bom dau', 'Dong co', 'cai', 750000, 6, 3],
  ['VT023', 'Ac quy 12V - 220Ah', 'Dien', 'cai', 2500000, 6, 3],
  ['VT024', 'Bong den pha H4', 'Dien', 'cai', 120000, 20, 10],
  ['VT025', 'Bong den H1', 'Dien', 'cai', 95000, 18, 8],
  ['VT026', 'Cong tac dieu khien den', 'Dien', 'cai', 180000, 10, 4],
  ['VT027', 'Cap chay cac loai', 'Dien', 'bo', 45000, 20, 10],
  ['VT028', 'Day dien cabin', 'Dien', 'bo', 900000, 4, 2],
  ['VT029', 'Ro le dong lon', 'Dien', 'cai', 150000, 10, 5],
  ['VT030', 'May khoi dong (starter)', 'Dien', 'cai', 1100000, 3, 1],
  ['VT031', 'Lop 12.00 R20', 'Lop', 'quang', 4200000, 10, 4],
  ['VT032', 'Lop 11.00 R20', 'Lop', 'quang', 3800000, 8, 3],
  ['VT033', 'Sam trong 12.00', 'Lop', 'cai', 350000, 12, 5],
  ['VT034', 'Lop du phong', 'Lop', 'cai', 1800000, 4, 2],
  ['VT035', 'Truc cac dang', 'Truyen dong', 'cai', 2200000, 3, 1],
  ['VT036', 'Bo ly hop', 'Truyen dong', 'bo', 1800000, 4, 2],
  ['VT037', 'Vong bi romoai', 'Truyen dong', 'cai', 240000, 10, 4],
];

/* Ma trận phân quyền mặc định (perm.js MATRIX — admin toàn quyền) */
const MATRIX: Record<string, Record<string, string[]>> = {
  tho: { sc: ['xem', 'tao', 'sua'], asset: ['xem'], kho: ['xem'], xe: ['xem'], report: ['xem'], chat: ['xem', 'tao', 'sua'], tk: ['xem', 'sua'], gd2: ['xem', 'tao', 'sua'] },
  khoa: { kho: ['xem', 'tao', 'sua', 'xuat'], mua: ['xem', 'tao'], sc: ['xem'], xe: ['xem'], chat: ['xem', 'tao', 'sua'], gd2: ['xem'] },
  ketoan: { mua: ['xem', 'tao', 'duy'], asset: ['xem', 'quyet'], sc: ['xem', 'tao', 'kehoach'], kho: ['xem'], xe: ['xem'], report: ['xem'], chat: ['xem', 'tao', 'sua'], tk: ['xem'], gd2: ['xem'] },
  quanly: { sc: ['xem', 'duy', 'kehoach'], asset: ['xem', 'quyet'], kho: ['xem'], mua: ['xem'], xe: ['xem'], report: ['xem'], chat: ['xem', 'tao', 'sua'], tk: ['xem', 'duy'], xuong: ['xem'], gd2: ['xem', 'tao', 'sua'] },
  giamdoc: { sc: ['xem', 'duy', 'kehoach'], asset: ['xem', 'duy'], kho: ['xem'], mua: ['xem', 'duy'], xe: ['xem'], report: ['xem'], chat: ['xem', 'tao', 'sua'], tk: ['xem', 'duy'], xuong: ['xem'], gd2: ['xem', 'tao', 'sua'] },
  xuong: { tk: ['xem', 'duy', 'sua'], xuong: ['xem'], sc: ['xem', 'tao', 'sua', 'kehoach'], asset: ['xem'], kho: ['xem'], xe: ['xem'], report: ['xem'], chat: ['xem', 'tao', 'sua'], gd2: ['xem', 'tao', 'sua'] },
  laixe: { tk: ['xem', 'tao', 'sua'], xe: ['xem'], chat: ['xem', 'tao'] },
};

const readJSON = <T>(dir: string, f: string): T =>
  JSON.parse(readFileSync(join(dir, f), 'utf8')) as T;

const nowStamp = () => new Date().toISOString();

/** Lấy id tiếp theo từ counter trong config (giống db.nextId v3.6) */
async function nextId(client: SqlClient, prefix: string): Promise<string> {
  const r = await client.query<{ value: string }>('SELECT value FROM config WHERE key = $1', [prefix]);
  const v = Number(r.rows[0]?.value) || 0;
  const nv = v + 1;
  await client.query(
    'INSERT INTO config(key, value) VALUES($1, $2) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [prefix, String(nv)]
  );
  return `${prefix}-${String(nv).padStart(6, '0')}`;
}

async function seedPhongBan(client: SqlClient): Promise<void> {
  // id cố định PB-000001..4 + ON CONFLICT để idempotent (seed chạy lại không trùng)
  for (let i = 0; i < DEFAULT_PHONGBAN.length; i++) {
    const p = DEFAULT_PHONGBAN[i]!;
    const id = `PB-${String(i + 1).padStart(6, '0')}`;
    await client.query(
      'INSERT INTO phong_ban(id, code, name, note) VALUES($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING',
      [id, p.code, p.name, '']
    );
  }
}

async function seedXe(client: SqlClient, seedDir: string): Promise<void> {
  const xes = readJSON<Array<Record<string, unknown>>>(seedDir, 'seed_xe.json');
  for (const x of xes) {
    await client.query(
      `INSERT INTO xe(id, bks, bien_so_cu, hang, dong, nam_sx, lai_xe, danh_gia_pct,
                      phong_ban, trang_thai, loai_pt, ghi_chu)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO NOTHING`,
      [
        x.id || (await nextId(client, 'XE')),
        x.bks, x.bien_so_cu || '', x.hang || '', x.dong || '',
        x.nam_sx || 0, x.lai_xe || '', x.danh_gia_pct || 0,
        x.phong_ban || 'Đội xe đầu kéo', x.trang_thai || 'hoạt động',
        x.loai_pt || 'Đầu kéo', x.ghi_chu || '',
      ]
    );
  }
  // Nguyên giá mặc định theo năm sản xuất (giữ logic seed.js)
  await client.query(
    `UPDATE xe SET nguyen_gia = CASE
       WHEN nam_sx >= 2020 THEN 900000000
       WHEN nam_sx >= 2016 THEN 600000000
       WHEN nam_sx >= 2010 THEN 400000000
       ELSE 250000000 END
     WHERE (nguyen_gia IS NULL OR nguyen_gia = 0)`
  );
}

async function seedBieuMa(client: SqlClient, seedDir: string): Promise<void> {
  const data = readJSON<{ records: Array<Record<string, unknown>> }>(seedDir, 'seed_biemau.json');
  for (const r of data.records) {
    await client.query(
      'INSERT INTO bieu_ma(item_id, group_id, group_name, group_short, item_name, priority) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (item_id) DO NOTHING',
      [r.item_id, r.group_id, r.group_name, r.group_short, r.item_name, 'Bình thường']
    );
  }
}

async function seedUsers(client: SqlClient): Promise<void> {
  for (const u of DEFAULT_USERS) {
    await client.query(
      'INSERT INTO users(id, name, role, phone, pass_hash, active, must_change) VALUES($1,$2,$3,$4,$5,1,1) ON CONFLICT (id) DO NOTHING',
      [u.id, u.name, u.role, u.phone, hashPassword(DEFAULT_PASSWORD)]
    );
  }
}

/** Tạo user laixe cho từng lái xe trong bảng xe + gán xe.lai_xe_id (giữ hành vi v3.6) */
async function ensureLaixe(client: SqlClient): Promise<number> {
  const r = await client.query<{ name: string }>(
    `SELECT upper(lai_xe) AS u, MIN(lai_xe) AS name FROM xe
     WHERE lai_xe <> '' AND deleted_at = ''
     GROUP BY upper(lai_xe) ORDER BY upper(lai_xe)`
  );
  let n = 0;
  for (const row of r.rows) {
    const exist = await client.query<{ id: string }>(
      "SELECT id FROM users WHERE role='laixe' AND upper(name)=upper($1)", [row.name]
    );
    let uid = exist.rows[0]?.id;
    if (!uid) {
      n += 1;
      uid = `laixe-${n}`;
      await client.query(
        "INSERT INTO users(id, name, role, phone, pass_hash, active, must_change) VALUES($1,$2,'laixe','',$3,1,1)",
        [uid, row.name, hashPassword(DEFAULT_PASSWORD)]
      );
    }
    await client.query(
      "UPDATE xe SET lai_xe_id=$1 WHERE upper(lai_xe)=upper($2) AND deleted_at=''", [uid, row.name]
    );
  }
  return n;
}

async function seedPerms(client: SqlClient): Promise<void> {
  await client.query('DELETE FROM phan_quyen');
  for (const [role, mods] of Object.entries(MATRIX)) {
    for (const [m, feats] of Object.entries(mods)) {
      for (const f of feats) {
        await client.query('INSERT INTO phan_quyen(role, module, feature) VALUES($1,$2,$3)', [role, m, f]);
      }
    }
  }
  await client.query('INSERT INTO phan_quyen(role, module, feature) VALUES($1,$2,$3)', ['admin', 'all', 'all']);
}

async function seedConfig(client: SqlClient): Promise<void> {
  const items: Array<[string, string]> = [
    ['duyet_sc_nguong', '5000000'],
    ['duyet_mua_nguong', '5000000'],
    ['khau_hao_nam', '10'],
  ];
  for (const [k, v] of items) {
    await client.query(
      'INSERT INTO config(key, value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [k, v]
    );
  }
}

async function seedCongviec(client: SqlClient): Promise<void> {
  for (const [code, name, nhom, donvi, gia] of DEFAULT_CONGVIEC) {
    const exist = await client.query<{ id: number }>('SELECT id FROM congviec WHERE code = $1', [code]);
    if (exist.rows[0]) {
      await client.query(
        'UPDATE congviec SET name=$1, nhom=$2, donvi=$3, don_gia=$4 WHERE code=$5',
        [name, nhom, donvi, gia, code]
      );
    } else {
      await client.query(
        'INSERT INTO congviec(code, name, nhom, donvi, don_gia, mo_ta, active) VALUES($1,$2,$3,$4,$5,$6,1)',
        [code, name, nhom, donvi, gia, '']
      );
    }
  }
}

async function seedVattu(client: SqlClient): Promise<void> {
  for (const [code, name, nhom, donvi, gia, ton, tonMin] of DEFAULT_VATTU) {
    const exist = await client.query<{ id: number }>('SELECT id FROM vattu WHERE code = $1', [code]);
    if (exist.rows[0]) {
      await client.query(
        'UPDATE vattu SET name=$1, nhom=$2, donvi=$3, gia=$4, ton_min=$5 WHERE code=$6',
        [name, nhom, donvi, gia, tonMin, code]
      );
    } else {
      await client.query(
        'INSERT INTO vattu(code, name, nhom, donvi, gia, ton, ton_min, active) VALUES($1,$2,$3,$4,$5,$6,$7,1)',
        [code, name, nhom, donvi, gia, ton, tonMin]
      );
    }
  }
}

/**
 * Seed toàn bộ (tương đương seedAll + ensureGd3 v3.6).
 * KHÔNG xoá dữ liệu cũ — chỉ insert idempotent (INSERT ... ON CONFLICT) để
 * chạy an toàn nhiều lần. Reset dữ liệu do người dùng chủ động qua CLI.
 */
export async function seedAll(client: SqlClient, seedDir: string): Promise<{ xe: number; bieu_ma: number; users: number }> {
  await seedPhongBan(client);
  await seedXe(client, seedDir);
  await seedBieuMa(client, seedDir);
  await seedUsers(client);
  const nLaiXe = await ensureLaixe(client);
  await seedPerms(client);
  await seedConfig(client);
  await seedCongviec(client);
  await seedVattu(client);

  const xe = await client.query<{ c: string }>('SELECT COUNT(*) AS c FROM xe');
  const bm = await client.query<{ c: string }>('SELECT COUNT(*) AS c FROM bieu_ma');
  const us = await client.query<{ c: string }>('SELECT COUNT(*) AS c FROM users');

  await client.query('INSERT INTO nhat_ky(thoi_gian, noi_dung, nguoi) VALUES($1,$2,$3)', [
    nowStamp(),
    `Khởi tạo dữ liệu seed: ${xe.rows[0]?.c} xe, ${bm.rows[0]?.c} hạng mục, ${us.rows[0]?.c} người dùng (${nLaiXe} TK lái xe).`,
    'Hệ thống',
  ]);

  return { xe: Number(xe.rows[0]?.c), bieu_ma: Number(bm.rows[0]?.c), users: Number(us.rows[0]?.c) };
}