/**
 * tests/conformance/admin_rbac.test.ts — W4.1-core + W4-reg (registry gộp)
 * (1) lib/core/admin.ts: userList/userAdd/userSetPassword/userSetActive +
 *     thresholdsGet/Set — gate admin TRỰC TIẾP fail-closed (envelope tại lõi).
 *     W4-reg: 8 fn ĐÃ vào lib/rpc.ts FN_LIST/META/HANDLERS — section 6 kiểm
 *     quyền ở TẦNG DISPATCH qua HTTP (403 thật sự cho non-admin, KHÔNG phải
 *     envelope lõi); gateAdmin trong lõi vẫn là lớp chắn thứ hai.
 * (2) must_change ENFORCE cấp HTTP (app/api/rpc/route.ts): user mang cờ
 *     phải ăn 403 + needChangePw cho MỌI fn ngoài
 *     ['changePassword','currentUser','appInfo','logout'] (port whitelist
 *     v3.6 index.js:155 + 'logout' theo task) — và hết chặn sau khi
 *     user TỰ đổi mk bằng lib/auth.changePassword (old-verify, clear cờ).
 *
 * KHÔNG dùng /api/auth POST cho login user mới — lib.login + signSession y
 * hệt cách setup.ts mint token (tránh rate-limit middleware 5 req/5' trên
 * /api/auth, vốn tính theo IP dùng chung với các file test khác khi --runInBand).
 */
import request from 'supertest';
import { db, getTokens } from './setup';
import type { Db } from '../../lib/types';
import { login, signSession, changePassword, DEFAULT_PASSWORD } from '../../lib/auth';
import { buildApi } from '../../lib/api';
import { getRegistry } from '../../lib/rpc';
import {
  userList, userAdd, userSetPassword, userSetActive, thresholdsGet, thresholdsSet,
} from '../../lib/core/admin';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const rpc = (token: string, fn: string, args: any = {}) =>
  request(BASE).post('/api/rpc').set('Cookie', [`sid=${token}`]).send({ fn, args });

async function row1<T = any>(pool: Db, sql: string, params: any[]): Promise<T | undefined> {
  const r = await pool.query(sql, params);
  return r.rows[0] as T | undefined;
}

/* ============ actors + api context (core-level, như setup mint token) ========== */
let adminApi: ReturnType<typeof buildApi>;
let giamdocApi: ReturnType<typeof buildApi>;
let ketoanApi: ReturnType<typeof buildApi>;
let adminActorId = '';

/* Tài khoản test dùng IDENTITY 'w41' + SUFFIX riêng — sau suite dọn SẠCH
 * (hard-delete chính row mình tạo) để không nhiễm các suite chạy cùng gate. */
const SFX = String(Date.now()).slice(-7);
const mkName = (tag: string) => 'w41' + tag + SFX;

const createdIds: string[] = [];
async function remember(id: string): Promise<void> { createdIds.push(id); }

beforeAll(async () => {
  const admin = await login(db, 'admin', 'cencom@123');
  if (!admin) throw new Error('admin login failed');
  adminActorId = admin.id;
  adminApi = buildApi(admin);
  const gd = await login(db, 'giamdoc', 'cencom@123');
  if (!gd) throw new Error('giamdoc login failed');
  giamdocApi = buildApi(gd);
  const kt = await login(db, 'ketoan', 'cencom@123');
  if (!kt) throw new Error('ketoan login failed');
  ketoanApi = buildApi(kt);
});

afterAll(async () => {
  // dọn activity_log do mình ghi (actor = tài khoản phụ, FK) rồi users
  if (createdIds.length) {
    await db.query('DELETE FROM activity_log WHERE actor_id = ANY($1::text[])', [createdIds]);
    await db.query('DELETE FROM users WHERE id = ANY($1::text[])', [createdIds]);
  }
});

/* ==========================================================================
 * 1. GATE admin fail-closed TRỰC TIẾP trong core (chưa cần MATRIX module.user)
 * ========================================================================== */
describe('admin core — gate role fail-closed (envelope 401/403 tại lõi)', () => {
  test('chưa đăng nhập (actor null) → 401 trên mọi fn admin', async () => {
    const anon = buildApi(null);
    for (const call of [
      userList(anon, {}), userAdd(anon, { name: 'x1', role: 'kho' }),
      userSetPassword(anon, { id: 'U-ADMIN' }), userSetActive(anon, { id: 'U-KHO', active: false }),
      thresholdsGet(anon, {}), thresholdsSet(anon, { key: 'duyet_sc_nguong', value: 1 }),
    ]) {
      const r = await call;
      expect(r.ok).toBe(false);
      expect(r.error).toBe('401');
    }
  });

  test('role không phải admin (giamdoc/ketoan) → 403 — Kể CẢ role cao nhất sau admin', async () => {
    expect((await userList(giamdocApi, {})).error).toBe('403');
    expect((await thresholdsGet(ketoanApi, {})).error).toBe('403');
    const r = await thresholdsSet(giamdocApi, { key: 'duyet_mua_nguong', value: 10 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('403');
    const a = await userAdd(ketoanApi, { name: 'mustnotexist', role: 'kho' });
    expect(a.error).toBe('403');
    expect((await userSetActive(ketoanApi, { id: adminActorId, active: false })).error).toBe('403');
  });

  test('admin → userList OK, chỉ trả tài khoản SỐNG (seed 5 user), không lộ pass_hash', async () => {
    const r = await userList(adminApi, {});
    expect(r.ok).toBe(true);
    const users = r.result as any[];
    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThanOrEqual(5);
    for (const u of users) {
      expect(u.active).toBe(true);
      expect(u.deleted_at).toBeUndefined();
      expect(u.pass_hash).toBeUndefined(); // chỉ has_password boolean (v3.6:130)
      expect(typeof u.has_password).toBe('boolean');
      expect(['admin', 'giamdoc', 'xuong', 'ketoan', 'kho']).toContain(u.role);
    }
    const seed = users.find((u) => u.name === 'admin');
    expect(seed).toBeTruthy();
    expect(seed.must_change === true || seed.must_change === false).toBe(true); // boolean hóa
  });

  test('userList include_deleted thấy cả tài khoản đã khóa; mặc định thì không', async () => {
    // tạo + khóa một tài khoản tạm
    const add = await userAdd(adminApi, { name: mkName('dl'), role: 'kho' });
    expect(add.ok).toBe(true);
    const tmpId = (add.result as any).id as string;
    await remember(tmpId);
    const off = await userSetActive(adminApi, { id: tmpId, active: false });
    expect(off.ok).toBe(true);
    const only = (await userList(adminApi, {})).result as any[];
    expect(only.some((u) => u.id === tmpId)).toBe(false);
    const all = (await userList(adminApi, { include_deleted: true })).result as any[];
    const rowU = all.find((u: any) => u.id === tmpId);
    expect(rowU).toBeTruthy();
    expect(rowU.active).toBe(false);
    // mở lại → sống
    const on = await userSetActive(adminApi, { id: tmpId, active: true });
    expect(on.ok).toBe(true);
    const after = (await userList(adminApi, {})).result as any[];
    expect(after.some((u) => u.id === tmpId)).toBe(true);
  });

  test('userList limit chuỗi rác → mặc định 100; limit số → clamp', async () => {
    const r = await userList(adminApi, { limit: 'abc' });
    expect(r.ok).toBe(true);
    const r2 = await userList(adminApi, { limit: -5 });
    expect(r2.ok).toBe(true);
    const r3 = await userList(adminApi, { limit: 2 });
    expect((r3.result as any[]).length).toBeLessThanOrEqual(2);
  });
});

/* ==========================================================================
 * 2. userAdd — id U-…, login→cột name, must_change semantics, validate
 * ========================================================================== */
describe('userAdd — port handlers.js:142–159 (schema v5: id nextId, login=name)', () => {
  test('tạo user mới: mật khẩu mặc định → must_change=1, id U-0000NN, đăng nhập bằng name', async () => {
    const name = mkName('uc');
    const r = await userAdd(adminApi, { name, role: 'kho' });
    expect(r.ok).toBe(true);
    const res = r.result as any;
    expect(res.id).toMatch(/^U-\d{6}$/);
    expect(res.must_change).toBe(true);
    await remember(res.id);
    const row = await row1<any>(db, 'SELECT * FROM users WHERE id=$1', [res.id]);
    expect(row.name).toBe(name);
    expect(row.role).toBe('kho');
    expect(Number(row.must_change)).toBe(1);
    expect(row.deleted_at).toBe('');
    expect(row.pass_hash).toMatch(/^scrypt:/); // hashPassword v5 — không lưu plaintext
    // đăng nhập THẬT bằng mật khẩu mặc định hoạt động (login lọc deleted_at='')
    const actor = await login(db, name, DEFAULT_PASSWORD);
    expect(actor).toBeTruthy();
    expect(actor!.role).toBe('kho');
  });

  test('mật khẩu custom (không trùng default) → must_change=0', async () => {
    const name = mkName('up');
    const r = await userAdd(adminApi, { name, role: 'xuong', password: 'Sxcret#2026' });
    expect(r.ok).toBe(true);
    expect((r.result as any).must_change).toBe(false);
    await remember((r.result as any).id);
    const row = await row1<any>(db, 'SELECT must_change FROM users WHERE id=$1', [(r.result as any).id]);
    expect(Number(row.must_change)).toBe(0);
    expect(await login(db, name, 'Sxcret#2026')).toBeTruthy();
    expect(await login(db, name, DEFAULT_PASSWORD)).toBeNull();
  });

  test('tên trùng → lỗi "Đã tồn tại tài khoản" (kể cả trùng với user đã soft-delete)', async () => {
    const name = mkName('dup');
    const r1 = await userAdd(adminApi, { name, role: 'kho' });
    expect(r1.ok).toBe(true);
    await remember((r1.result as any).id);
    const r2 = await userAdd(adminApi, { name: name.toUpperCase(), role: 'kho' }); // case-insensitive
    expect(r2.ok).toBe(false);
    expect(r2.error).toContain('Đã tồn tại tài khoản');
  });

  test('role ngoài CHECK 5 giá trị → TỪ CHỐI (không fallback im lặng như v3.6)', async () => {
    for (const bad of ['tho', 'quanly', 'giam d?c', '', 'ADMIN']) {
      const r = await userAdd(adminApi, { name: mkName('r'), role: bad });
      expect(r.ok).toBe(false);
      expect(r.error).toContain('Role phải là một trong');
    }
  });

  test('login sai ký tự tự do / rỗng → chặn regex v3.6:149 + thiếu tên chặn v3.6:148', async () => {
    expect((await userAdd(adminApi, { name: 'có dấu', role: 'kho' })).error).toContain('chỉ gồm');
    expect((await userAdd(adminApi, { name: 'a;b', role: 'kho' })).error).toContain('chỉ gồm');
    expect((await userAdd(adminApi, { role: 'kho' })).error).toContain('Cần tên đăng nhập');
    expect((await userAdd(adminApi, { name: '   ', role: 'kho' })).error).toContain('Cần tên đăng nhập');
  });

  test('mật khẩu custom <6 ký tự → chặn (OWasp A7 — siết hơn v3.6 userAdd không kiểm)', async () => {
    const r = await userAdd(adminApi, { name: mkName('weak'), role: 'kho', password: '123' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('6 ký tự');
  });

  test('userAdd ghi audit activity_log (truy vết gatekeeper)', async () => {
    const name = mkName('aud');
    const r = await userAdd(adminApi, { name, role: 'giamdoc' });
    expect(r.ok).toBe(true);
    await remember((r.result as any).id);
    const audit = await row1<any>(db,
      "SELECT * FROM activity_log WHERE hanh_dong='user_add' AND doi_tuong_id=$1", [(r.result as any).id]);
    expect(audit).toBeTruthy();
    expect(audit.actor_id).toBe(adminActorId);
    expect(audit.mo_ta).toContain('Tạo tài khoản');
  });
});

/* ==========================================================================
 * 3. must_change ENFORCE HTTP + changePassword tự thân mở chặn
 * ========================================================================== */
describe('must_change enforce — whitelist v3.6 index.js:155 (+logout) cấp HTTP', () => {
  let newName: string, newId: string, userToken: string, userActor: any;

  beforeAll(async () => {
    newName = mkName('mc');
    const r = await userAdd(adminApi, { name: newName, role: 'kho' });
    expect(r.ok).toBe(true);
    newId = (r.result as any).id;
    await remember(newId);
    userActor = await login(db, newName, DEFAULT_PASSWORD); // login ĐƯỢC phép (v3.6 index.js:100–105 không chặn)
    expect(userActor).toBeTruthy();
    userToken = signSession(userActor);
  });

  test('fn dữ liệu (scList/xeList/dashboardAll) → 403 + envelope needChangePw', async () => {
    for (const fn of ['scList', 'xeList', 'vattuList', 'dashboardAll', 'thresholdsGet']) {
      const res = await rpc(userToken, fn);
      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.needChangePw).toBe(true);
      expect(res.body.error).toContain('mật khẩu mặc định');
    }
  });

  test('fn cố tình ghi (nhapKho) cũng bị chặn TRƯỚC dispatch — không thấm DB', async () => {
    const res = await rpc(userToken, 'nhapKho', {
      vattu_id: 'VT-000001', so_luong: 1, don_gia: 1000, ly_do: 'must_change test',
      ngay: new Date().toISOString().split('T')[0],
    });
    expect(res.status).toBe(403);
    expect(res.body.needChangePw).toBe(true);
    const n = await row1<any>(db, "SELECT COUNT(*)::int c FROM nhap_xuat WHERE ly_do='must_change test'", []);
    expect(n!.c).toBe(0);
  });

  test('whitelist: currentUser / appInfo / logout vẫn 200 khi đang bị chặn', async () => {
    for (const fn of ['currentUser', 'appInfo', 'logout']) {
      const res = await rpc(userToken, fn);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    }
  });

  test('admin không bị ảnh hưởng: vẫn scList 200 (setup đã clear cờ harness)', async () => {
    const res = await rpc(getTokens().admin, 'scList');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('W4-REG: "changePassword" VÀO registry — route whitelist mở cửa, dispatch security.doi_mk mọi role, lõi verify old THẬT (không còn 404 chờ-reg)', async () => {
    const res = await rpc(userToken, 'changePassword', { old_password: 'x', new_password: 'y' });
    // W4-reg hoàn tất: KHÔNG còn 404 'Unknown fn'. must_change user vẫn gọi ĐƯỢC
    // (whitelist route.ts:21–23 + META ['security','doi_mk'] mở cho kho), nhưng
    // old_password='x' SAI → lõi auth.ts:222 trả envelope business error —
    // 200 + result.ok=false (khuôn W1b+), mk KHÔNG đổi, cờ must_change GIỮ 1.
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.needChangePw).toBeUndefined();
    const env = res.body.result as { ok: boolean; error?: string } | undefined;
    expect(env?.ok).toBe(false);
    expect(env?.error).toContain('Mật khẩu cũ không đúng');
    const row = await row1<any>(db, 'SELECT must_change FROM users WHERE id=$1', [newId]);
    expect(Number(row.must_change)).toBe(1); // vẫn chặn — thử sai không mở cổng
  });

  test('lib/auth.changePassword: sai old → không đổi, không clear cờ; đủ điều kiện verify', async () => {
    const api = buildApi(userActor);
    const bad = await changePassword(api, { old_password: 'sai-quy-khoc', new_password: 'Good#12345' });
    expect(bad.ok).toBe(false);
    expect(bad.error).toContain('Mật khẩu cũ không đúng');
    const row = await row1<any>(db, 'SELECT must_change FROM users WHERE id=$1', [newId]);
    expect(Number(row.must_change)).toBe(1); // vẫn chặn
    const short = await changePassword(api, { old_password: DEFAULT_PASSWORD, new_password: '12345' });
    expect(short.error).toContain('6 ký tự');
    const sameDefault = await changePassword(api, { old_password: DEFAULT_PASSWORD, new_password: DEFAULT_PASSWORD });
    expect(sameDefault.error).toContain('mặc định'); // v3.6:566 — cấm quay về default
  });

  test('user tự đổi mk → must_change=0 →HTTP scList qua, mk mới đăng nhập được (full loop)', async () => {
    const api = buildApi(userActor);
    const ok = await changePassword(api, { old_password: DEFAULT_PASSWORD, new_password: 'Fresh#9999' });
    expect(ok.ok).toBe(true);
    const row = await row1<any>(db, 'SELECT must_change FROM users WHERE id=$1', [newId]);
    expect(Number(row.must_change)).toBe(0);
    expect(await login(db, newName, 'Fresh#9999')).toBeTruthy();
    const res = await rpc(userToken, 'scList'); // token cũ (HMAC) vẫn hiệu lực — cờ đọc sống từ DB
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const after = await row1<any>(db,
      "SELECT COUNT(*)::int c FROM activity_log WHERE hanh_dong='doi_mat_khau' AND doi_tuong_id=$1", [newId]);
    expect(after!.c).toBe(1); // audit v3.6:571
  });

  test('changePassword không đăng nhập (actor null) → envelope "Chưa đăng nhập."', async () => {
    const r = await changePassword(buildApi(null), { old_password: 'a', new_password: 'bbbbbb' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('Chưa đăng nhập.');
  });
});

/* ==========================================================================
 * 4. userSetPassword (admin) & userSetActive — semantics v3.6
 * ========================================================================== */
describe('userSetPassword admin — port handlers.js:165–172 (KHÔNG cần mk cũ; GIỮ cờ must_change)', () => {
  let tId: string, tName: string;
  beforeAll(async () => {
    tName = mkName('sp');
    const r = await userAdd(adminApi, { name: tName, role: 'ketoan' });
    tId = (r.result as any).id;
    await remember(tId);
  });

  test('reset không truyền password → đặt DEFAULT + bật must_change=1', async () => {
    const r = await userSetPassword(adminApi, { id: tId });
    expect(r.ok).toBe(true);
    expect(await login(db, tName, DEFAULT_PASSWORD)).toBeTruthy();
    const row = await row1<any>(db, 'SELECT must_change FROM users WHERE id=$1', [tId]);
    expect(Number(row.must_change)).toBe(1);
  });

  test('admin đặt mk custom cho user đang must_change → ĐỔI hash nhưng GIỮ cờ=1 (v3.6:165 không đụng mustChange)', async () => {
    const r = await userSetPassword(adminApi, { id: tId, password: 'Adm-Set#1' });
    expect(r.ok).toBe(true);
    expect(await login(db, tName, 'Adm-Set#1')).toBeTruthy();
    const row = await row1<any>(db, 'SELECT must_change FROM users WHERE id=$1', [tId]);
    expect(Number(row.must_change)).toBe(1);
  });

  test('id không tồn tại → "Không tìm thấy tài khoản." (v3.6:167); mk <6 ký tự → chặn (v3.6:168)', async () => {
    expect((await userSetPassword(adminApi, { id: 'U-ZZZZZZ', password: 'abcdef' })).error).toContain('Không tìm thấy');
    const r = await userSetPassword(adminApi, { id: tId, password: '123' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('6 ký tự');
  });

  test('audit: user_pw_reset ghi activity_log (v3.6:170)', async () => {
    const a = await row1<any>(db,
      "SELECT * FROM activity_log WHERE hanh_dong='user_pw_reset' AND doi_tuong_id=$1", [tId]);
    expect(a).toBeTruthy();
    expect(a.mo_ta).toContain('Đặt lại mật khẩu');
  });
});

describe('userSetActive — port handlers.js:175–186 (soft-delete; chặn khóa admin/chính mình)', () => {
  test('khóa CHÍNH TÀI KHOẢN đang dùng → chặn, đúng message v3.6:181', async () => {
    const r = await userSetActive(adminApi, { id: adminActorId, active: false });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('tài khoản quản trị hoặc tài khoản đang dùng');
  });

  test('khóa BẤT KỲ admin nào (kể cả không phải mình) → chặn (v3.6 chặn cả cụm admin, chống lockout)', async () => {
    const add = await userAdd(adminApi, { name: mkName('ad2'), role: 'admin' });
    expect(add.ok).toBe(true);
    await remember((add.result as any).id);
    const r = await userSetActive(adminApi, { id: (add.result as any).id, active: false });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('quản trị');
  });

  test('khóa user thường → soft deleted_at=ISO; LOGIN chết; mở lại → sống (mở KHÔNG cần admin-flag)', async () => {
    const name = mkName('lk');
    const add = await userAdd(adminApi, { name, role: 'kho' });
    await remember((add.result as any).id);
    const off = await userSetActive(adminApi, { id: (add.result as any).id, active: false });
    expect(off.ok).toBe(true);
    expect((off.result as any).active).toBe(false);
    const row = await row1<any>(db, 'SELECT deleted_at FROM users WHERE id=$1', [(add.result as any).id]);
    expect(row!.deleted_at).toBeTruthy();
    expect(row!.deleted_at).not.toBe('');
    expect(await login(db, name, DEFAULT_PASSWORD)).toBeNull(); // login lọc deleted_at=''
    const on = await userSetActive(adminApi, { id: (add.result as any).id, active: true });
    expect(on.ok).toBe(true);
    expect(await login(db, name, DEFAULT_PASSWORD)).toBeTruthy();
    const audit = await row1<any>(db,
      "SELECT COUNT(*)::int c FROM activity_log WHERE hanh_dong IN ('user_lock','user_open') AND doi_tuong_id=$1",
      [(add.result as any).id]);
    expect(audit!.c).toBe(2);
  });

  test('active kiểu rác (không true/false/1/0) → lỗi validate, không đoán mù', async () => {
    const r = await userSetActive(adminApi, { id: 'U-KHO', active: 'maybe' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('true/false');
    expect((await userSetActive(adminApi, {})).error).toBeTruthy();
  });

  test('id không tồn tại → "Không tìm thấy tài khoản." (v3.6:177)', async () => {
    const r = await userSetActive(adminApi, { id: 'U-NOTEX', active: false });
    expect(r.error).toContain('Không tìm thấy');
  });
});

/* ==========================================================================
 * 5. thresholds — whitelist key + config thật + audit (v3.6:604–618)
 * ========================================================================== */
describe('thresholdsGet/Set — ONLY admin, whitelist 3 key, đọc/ghi config thật', () => {
  const original: Record<string, string | null> = {};

  beforeAll(async () => {
    for (const k of ['duyet_sc_nguong', 'duyet_mua_nguong', 'khau_hao_nam']) {
      const row = await row1<any>(db, 'SELECT value FROM config WHERE key=$1', [k]);
      original[k] = row ? String(row.value) : null;
    }
  });
  afterAll(async () => {
    // KHÔI PHỤC đúng trạng thái cũ để sc_approve/dm_decide/asset_gttv chạy cùng gate không lệch ngưỡng
    for (const [k, v] of Object.entries(original)) {
      if (v === null) await db.query('DELETE FROM config WHERE key=$1', [k]);
      else await db.query('INSERT INTO config (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value', [k, v]);
    }
  });

  test('thresholdsGet admin → đủ 3 key số học; {key} đơn lẻ cũng OK', async () => {
    const r = await thresholdsGet(adminApi, {});
    expect(r.ok).toBe(true);
    expect(typeof r.result.duyet_sc_nguong).toBe('number');
    expect(typeof r.result.duyet_mua_nguong).toBe('number');
    expect(r.result.khau_hao_nam).toBeGreaterThanOrEqual(1); // max(1,… — v3.6 asset.js:21
    const one = await thresholdsGet(adminApi, { key: 'duyet_sc_nguong' });
    expect(one.ok).toBe(true);
    expect(typeof one.result.duyet_sc_nguong).toBe('number');
  });

  test('thresholdsSet key LẠ → từ chối + KHÔNG đụng DB (chặn poisoning counter_* của nextId)', async () => {
    const before = await row1<any>(db, 'SELECT value FROM config WHERE key=$1', ['counter_SC']);
    for (const bad of ['counter_SC', 'mcp_allow_write', '', 'duyet_sc_nguong; DROP']) {
      const r = await thresholdsSet(adminApi, { key: bad, value: '999999' });
      expect(r.ok).toBe(false);
      expect(r.error).toContain('Key không hợp lệ');
    }
    const after = await row1<any>(db, 'SELECT value FROM config WHERE key=$1', ['counter_SC']);
    expect(after?.value).toBe(before?.value);
  });

  test('thresholdsSet duyet_sc_nguong đổi THẬT: UPDATE config + values phản chiếu lại qua get (scNguong đọc cùng key)', async () => {
    const r = await thresholdsSet(adminApi, { key: 'duyet_sc_nguong', value: '123456' });
    expect(r.ok).toBe(true);
    expect(r.result.duyet_sc_nguong).toBe(123456);
    const row = await row1<any>(db, 'SELECT value FROM config WHERE key=$1', ['duyet_sc_nguong']);
    expect(row.value).toBe('123456');
    //scApprove đọc đúng key này (lib/core/sc.ts SC_NGUONG_KEY) — hợp nhất nguồn
    const r2 = await thresholdsSet(adminApi, { key: 'duyet_mua_nguong', value: 500000 });
    expect(r2.result.duyet_mua_nguong).toBe(500000);
    const a = await row1<any>(db,
      "SELECT COUNT(*)::int c FROM activity_log WHERE hanh_dong='config_set' AND doi_tuong='config'", []);
    expect(a!.c).toBeGreaterThanOrEqual(2); // 2 lần set trong test → 2 dòng audit (v3.6:616)
    const k = await row1<any>(db,
      "SELECT COUNT(*)::int c FROM activity_log WHERE hanh_dong='config_set' AND mo_ta LIKE $1", ['%(duyet_sc_nguong%']);
    expect(k!.c).toBeGreaterThanOrEqual(1); // key ghi trong mo_ta (doi_tuong_id VARCHAR(12) không chứa nổi key)
  });

  test('giá trị rác/âm → 0 cho ngưỡng duyệt (Number()||0 v3.6:613); khau_hao_nam rác → lỗi ≥1 tường minh', async () => {
    const neg = await thresholdsSet(adminApi, { key: 'duyet_sc_nguong', value: '-100' });
    expect(neg.result.duyet_sc_nguong).toBe(0);
    const junk = await thresholdsSet(adminApi, { key: 'duyet_sc_nguong', value: 'trà đá' });
    expect(junk.result.duyet_sc_nguong).toBe(0);
    const bad0 = await thresholdsSet(adminApi, { key: 'khau_hao_nam', value: 0 });
    expect(bad0.ok).toBe(false);
    expect(bad0.error).toContain('≥ 1');
    const ok5 = await thresholdsSet(adminApi, { key: 'khau_hao_nam', value: '7.9' });
    expect(ok5.result.khau_hao_nam).toBe(7); // trunc + max(1,…)
  });

  test('thresholdsSet role khác → 403; gate lõi chặn trước khi chạm config', async () => {
    expect((await thresholdsSet(giamdocApi, { key: 'duyet_sc_nguong', value: 1 })).error).toBe('403');
  });
});

/* =========================================================================
 * 6. W4-reg — 8 fn vào lib/rpc.ts: quyền MA TRẬN ở DISPATCH (HTTP 403 thật,
 *    khác envelope lõi của gateAdmin), envelope 2 tầng cho fn pass, và
 *    changePassword self-service đầu-cuối qua HTTP (kịch bản must_change →
 *    đổi mk bằng RPC → cửa dữ liệu mở lại) — đúng contract client POST /api/rpc.
 * ========================================================================= */
describe('W4-reg HTTP RPC — dispatch gate + envelope 2 tầng + self-service loop', () => {
  const { FN_LIST, META, OPEN } = getRegistry();

  test('registry: 8 fn có mặt trong FN_LIST, KHÔNG open, META đầy đủ + đúng giá trị chốt', () => {
    const fns = ['userList', 'userAdd', 'userSetPassword', 'userSetActive',
      'thresholdsGet', 'thresholdsSet', 'globalSearch', 'changePassword'];
    for (const fn of fns) {
      expect(FN_LIST).toContain(fn);
      expect(OPEN.has(fn)).toBe(false); // kể cả changePassword: handler nhân actor
      expect(META[fn]).toBeDefined(); // dispatch fail-closed nếu thiếu META
    }
    expect(META.userList).toEqual(['user', 'admin']);
    expect(META.thresholdsGet).toEqual(['config', 'admin']);
    expect(META.globalSearch).toEqual(['sc', 'xem']); // ≡ dự kiến search.ts:28
    expect(META.changePassword).toEqual(['security', 'doi_mk']);
  });

  test('anonymous → 401 trên cả 8 fn (dispatch requires actor — lib/rpc.ts:318)', async () => {
    for (const fn of ['userList', 'userAdd', 'userSetPassword', 'userSetActive',
      'thresholdsGet', 'thresholdsSet', 'globalSearch', 'changePassword']) {
      const res = await request(BASE).post('/api/rpc').send({ fn, args: {} });
      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
    }
  });

  test('giamdoc/ketoan (không admin) → 403 THẬT SỰ tại dispatch cho 6 fn user/config — DB không bị chạm', async () => {
    for (const role of ['giamdoc', 'ketoan'] as const) {
      for (const fn of ['userList', 'userAdd', 'userSetPassword', 'userSetActive',
        'thresholdsGet', 'thresholdsSet']) {
        const res = await rpc(getTokens()[role], fn, {});
        expect(res.status).toBe(403);
        // dispatch throw Error('403') → route đổi thành {'ok':false,'error':'Không đủ quyền'}
        expect(res.body.ok).toBe(false);
        expect((res.body as any).result).toBeUndefined();
      }
    }
  });

  test('admin HTTP userList → 200 + envelope 2 tầng {ok:true,result:{ok:true,result:[…]}}, không lộ pass_hash', async () => {
    const res = await rpc(getTokens().admin, 'userList', { limit: 50 });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const env = res.body.result as any;
    expect(env.ok).toBe(true);
    expect(Array.isArray(env.result)).toBe(true);
    expect(env.result.length).toBeGreaterThanOrEqual(5); // seed 5 user sống
    for (const u of env.result) expect(u.pass_hash).toBeUndefined();
  });

  test('admin HTTP thresholdsGet → đủ 3 key số; thresholdsSet key LẠ ngoài whitelist → lỗi envelope, không ghi', async () => {
    const g = await rpc(getTokens().admin, 'thresholdsGet', {});
    expect(g.status).toBe(200);
    expect(typeof (g.body.result as any).result.duyet_sc_nguong).toBe('number');
    expect(typeof (g.body.result as any).result.khau_hao_nam).toBe('number');
    const bad = await rpc(getTokens().admin, 'thresholdsSet', { key: 'counter_SC', value: 999 });
    expect(bad.status).toBe(200); // business error về ENVELOPE, không phải HTTP 4xx
    expect((bad.body.result as any).ok).toBe(false);
    expect((bad.body.result as any).error).toContain('Key không hợp lệ');
  });

  test('globalSearch HTTP — role thường (xuong) vẫn 200 (META sc.xem), đủ 4 nhóm; q cụt → lỗi envelope', async () => {
    const hit = await rpc(getTokens().xuong, 'globalSearch', { q: 'SC-', limit: 5 });
    expect(hit.status).toBe(200);
    const env = hit.body.result as any;
    expect(env.ok).toBe(true);
    for (const k of ['sc', 'xe', 'dm', 'vattu']) expect(Array.isArray(env.result[k])).toBe(true);
    const short = await rpc(getTokens().xuong, 'globalSearch', { q: 'a' });
    expect(short.status).toBe(200);
    expect((short.body.result as any).ok).toBe(false);
    expect((short.body.result as any).error).toContain('q tối thiểu 2');
  });

  test('changePassword HTTP full-loop: user must_change đổi mk bằng RPC → cửa scList mở lại (lối thoát GĐ3.6.2)', async () => {
    const name = mkName('h2');
    const add = await userAdd(adminApi, { name, role: 'kho' });
    expect(add.ok).toBe(true);
    const uid = (add.result as any).id as string;
    await remember(uid);
    const actor = await login(db, name, DEFAULT_PASSWORD);
    expect(actor).toBeTruthy();
    const token = signSession(actor!);

    const blocked = await rpc(token, 'scList');
    expect(blocked.status).toBe(403);
    expect(blocked.body.needChangePw).toBe(true);

    const ok = await rpc(token, 'changePassword', { old_password: DEFAULT_PASSWORD, new_password: 'Http#Reg99' });
    expect(ok.status).toBe(200);
    expect((ok.body.result as any).ok).toBe(true);

    const after = await rpc(token, 'scList');
    expect(after.status).toBe(200);
    expect(after.body.ok).toBe(true);
    expect(await login(db, name, 'Http#Reg99')).toBeTruthy();
    expect(await login(db, name, DEFAULT_PASSWORD)).toBeNull();
  });
});
