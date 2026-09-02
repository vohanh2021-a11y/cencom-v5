/**
 * lib/core/admin.ts — W4.1-core: QUẢN TRỊ TÀI KHOẢN + NGƯỠNG DUYỆT (config).
 * Port v3.6:
 *  - handlers.js:127–186  userList / userAdd / userSetPassword / userSetActive
 *  - handlers.js:604–618  thresholds / thresholdsSet
 *  - auth.js:110–120      setMustChange / mustChange (helper ở lib/auth.ts)
 *
 * ─────────────────────────────────────────────────────────────────────────
 * QUYỀN — KIỂM TRA TRỰC TIẾP role==='admin', fail-closed ngay trong core:
 *   MATRIX (lib/perm.ts) CHƯA có module 'user'/'config' — file thuộc quyền
 *   worker-d (vừa xong W3.5, cấm sửa ở task này) và dispatch lib/rpc.ts
 *   cấm sửa (reg gộp đợt sau). Toàn bộ fn ở đây TỰ chặn:
 *     chưa đăng nhập → envelope {ok:false,error:'401'}
 *     role ≠ admin   → envelope {ok:false,error:'403'} (kể cả khi sau này
 *     reg META lỏng — core là lớp chắn cuối, chuẩn 2 AGENTS: kiểm quyền
 *     TRONG hàm xử lý, không chỉ ẩn UI).
 *   TODO(W4.1-reg): thêm module 'user' + 'config' vào MATRIX lib/perm.ts rồi
 *   chuyển gate về api.perm.can(role,'user','...') thay vì so role trực tiếp.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LỆCH SCHEMA v3.6 → v5 (db/schema.sql dòng 4–11) — CÁN BỘ port:
 *  - users KHÔNG có cột `active` (v3.6 db.js:52) → khóa/mở = SOFT-DELETE
 *    `deleted_at = '' | ISO` (quy ước toàn v5 — dmDelete dùng cùng giá trị).
 *  - users.name CHÍNH LÀ tên đăng nhập: login() lọc `WHERE name=$1 AND
 *    deleted_at=''` (lib/auth.ts:114) → userAdd lưu `login` vào cột name.
 *  - KHÔNG có cột phone/display riêng → bỏ khỏi projection (v3.6 trả phone;
 *    v5 schema không có — port theo schema THẬT, không thêm cột).
 *  - id sinh bằng nextId('U') → 'U-000001' (pattern seed 'U-ADMIN' + chuẩn
 *    PREFIX-000001 AGENTS.md), KHÁC v3.6 id=login hạ chữ thường.
 *  - role CHECK 5 giá trị (admin|giamdoc|xuong|ketoan|kho) — v3.6 có 8 role
 *    + fallback 'tho'; v5 fallback KHÔNG TỒN TẠI ⇒ role sai = TỪ CHỐI
 *    (fail-closed, im lặng gán role thấp nhất của v3.6 là hành vi không còn
 *    nghĩa trong vũ trụ 5 vai).
 *
 * userAdd tạo tài khoản bằng mật khẩu mặc định →
 * must_change=1 (v3.6:156 nguyên văn); admin set mật khẩu KHÔNG xóa cờ
 * (handlers.js:165 không đụng mustChange) — LỐI THOÁT DUY NHẤT là
 * changePassword tự thân (lib/auth.ts, whitelist index.js:155).
 *
 * RPC reg: fn ở đây CHƯA có mặt trong lib/rpc.ts FN_LIST/META/HANDLERS
 * (cấm theo task — reg gộp đợt sau kèm contracts.ts/tool-docs).
 */

import type { Api, Actor } from '../types';
import { nextId, q } from '../db';
import { DEFAULT_PASSWORD, hashPassword, setPasswordFor, setMustChange } from '../auth';
import { logActivity } from './activity';
import { createScopedLogger } from '../observability';

const log = createScopedLogger('admin');

/** 5 vai theo CHECK users.role (db/schema.sql:7) + ROLES (lib/perm.ts:3). */
const USER_ROLES: readonly string[] = ['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'];

/**
 * Whitelist key config ĐỌC/ĐƯỢC qua thresholdsGet/Set — đúng 3 key v3.6
 * thresholdsSet bản gốc (handlers.js:613–615: duyet_sc_nguong, duyet_mua_nguong,
 * khau_hao_nam). Key ngoài danh sách → TỪ CHỐI (v3.6 im lặng ignore các
 * key lạ vì hardcode 3 dòng; v5 thiết kế {key,value} đơn nên phải chặn
 * tường minh — KHÔNG cho ghi key tùy ý vào config, chặn poisoning counter
 * `counter_*` của nextId và mọi key hệ thống khác).
 */
const THRESHOLD_KEYS = ['duyet_sc_nguong', 'duyet_mua_nguong', 'khau_hao_nam'] as const;
type ThresholdKey = (typeof THRESHOLD_KEYS)[number];

/** Default 3 ngưỡng theo v3.6 seed.js:259–261 (config trống → tự đảm). */
const THRESHOLD_DEFAULTS: Record<ThresholdKey, string> = {
  duyet_sc_nguong: '5000000',
  duyet_mua_nguong: '5000000',
  khau_hao_nam: '10',
};

type Envelope = { ok: boolean; result?: any; error?: string };

/**
 * Phán quyết admin TRỰC TIẾP (xem header — TODO chuyển api.perm.can khi
 * module 'user' có trong MATRIX). Trả actor hoặc envelope lỗi 401/403.
 */
function gateAdmin(api: Api): { actor: Actor; err?: undefined } | { actor: null; err: Envelope } {
  const actor = api.auth.current();
  if (!actor) return { actor: null, err: { ok: false, error: '401' } };
  if (actor.role !== 'admin') return { actor: null, err: { ok: false, error: '403' } };
  return { actor, err: undefined };
}

/** Chuỗi 1..max ký tự đã trim (validate input chuẩn 2 — chặn null byte/oversize). */
function str(v: any, max = 40): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s || s.length > max || s.includes('\u0000')) return null;
  return s;
}

/* ============================================================
 * userList — port handlers.js:127–132 (projection theo schema v5).
 * Mặc định CHỈ tài khoản đang sống (deleted_at=''); admin truyền
 * include_deleted=true để xem cả tài khoản đã khóa (soft-delete).
 * ============================================================ */
export async function userList(
  api: Api,
  p: { include_deleted?: any; limit?: any } = {}
): Promise<Envelope> {
  const g = gateAdmin(api);
  if (!g.actor) return g.err || { ok: false, error: '401' };
  // limit clamp 1..500, rác → 100 (đọc sạch kiểu scNguong: Number.isFinite)
  let limit = Math.trunc(Number(p?.limit));
  if (!Number.isFinite(limit) || limit < 1) limit = 100;
  if (limit > 500) limit = 500;
  const includeDeleted = p?.include_deleted === true || p?.include_deleted === 1 || p?.include_deleted === '1';
  // has_password: không lộ hash, chỉ boolean (v3.6:130 `hasPassword: !!u.pass_hash`).
  const sql = includeDeleted
    ? `SELECT id, name, role, must_change, deleted_at, (pass_hash <> '') AS has_password
       FROM users ORDER BY role, name LIMIT $1`
    : `SELECT id, name, role, must_change, deleted_at, (pass_hash <> '') AS has_password
       FROM users WHERE deleted_at = '' ORDER BY role, name LIMIT $1`;
  const rows = (await q(sql, [limit])).rows;
  const users = rows.map((r: any) => ({
    id: r.id,
    name: r.name, // = đăng nhập (login cột name — header)
    role: r.role,
    must_change: !!Number(r.must_change ?? 0),
    active: String(r.deleted_at ?? '') === '', // v5 không có cột active → suy từ deleted_at
    has_password: !!r.has_password,
  }));
  return { ok: true, result: users };
}

/* ============================================================
 * userAdd — port handlers.js:142–159.
 * v3.6 id=login hạ chữ thường; v5 id=nextId('U'), login lưu vào name
 * (login() đọc đúng cột đó — lib/auth.ts:114). Mật khẩu:
 *   - truyền thiếu → DEFAULT_PASSWORD + must_change=1 (v3.6:153–156)
 *   - custom      → phải ≥6 ký tự (CHẶT HƠN có chủ đích vs v3.6 userAdd
 *     không kiểm — cùng chuẩn với v3.6 userSetPassword:168/changePassword:562;
 *     admin tạo acc mk 1 ký tự là lỗ hổng OWASP A7, Gatekeeper không port lỗi)
 *   - custom TRÙNG DEFAULT → vẫn must_change=1 (đọc credential-mặc-định
 *     công khai được → phải buộc đổi — nhất quán GĐ3.6.2).
 * ============================================================ */
export async function userAdd(
  api: Api,
  p: { name?: any; login?: any; role?: any; password?: any } = {}
): Promise<Envelope> {
  const g = gateAdmin(api);
  if (!g.actor) return g.err || { ok: false, error: '401' };
  const name = str(p?.name, 32);
  const login = str(p?.login, 32) ?? name; // login alias — mặc định = name
  if (!login || !name) {
    return { ok: false, error: 'Cần tên đăng nhập và tên hiển thị.' }; // v3.6:148
  }
  if (!/^[a-zA-Z0-9\-_]+$/.test(login)) {
    return { ok: false, error: 'Tên đăng nhập chỉ gồm chữ, số, gạch nối.' }; // v3.6:149
  }
  const role = String(p?.role ?? '').trim();
  if (!USER_ROLES.includes(role)) {
    return { ok: false, error: 'Role phải là một trong: ' + USER_ROLES.join(', ') + '.' };
  }
  const pw = p?.password === undefined || p?.password === null || p?.password === ''
    ? DEFAULT_PASSWORD
    : typeof p.password === 'string' ? p.password : null;
  if (pw === null) return { ok: false, error: 'Mật khẩu phải là chuỗi.' };
  if (pw.length < 6) {
    return { ok: false, error: 'Mật khẩu mới phải từ 6 ký tự.' }; // siết thêm (xem doc-block)
  }
  // Unique login — quét CẢ bảng kể cả soft-deleted (v3.6 userByLogin:451 không
  // lọc active — tên đã dùng là tên đã dùng; mở khóa lại phải qua userSetActive).
  const dup = (await q('SELECT id FROM users WHERE lower(name) = lower($1)', [login])).rows;
  if (dup.length > 0) {
    return { ok: false, error: 'Đã tồn tại tài khoản: ' + login }; // v3.6:150
  }
  const id = await nextId('U');
  const mustChange = pw === DEFAULT_PASSWORD ? 1 : 0; // v3.6:156 (đảo chiều DB default 1 → ghi tường minh)
  await q(
    `INSERT INTO users (id, name, role, pass_hash, must_change, deleted_at)
     VALUES ($1, $2, $3, $4, $5, '')`,
    [id, login, role, hashPassword(pw), mustChange]
  );
  try {
    await logActivity(api.db, {
      actor_id: g.actor.id, actor_role: g.actor.role, hanh_dong: 'user_add',
      doi_tuong: 'user', doi_tuong_id: id,
      mo_ta: 'Tạo tài khoản ' + id + ' (' + role + ') là ' + name, // v3.6:157 nguyên văn
    });
  } catch (e) {
    log.logError('userAdd: logActivity failed', e, { id });
  }
  log.logInfo('userAdd OK', { id, role, by: g.actor.id }); // INFO không kèm pw
  return { ok: true, result: { id, name: login, role, must_change: mustChange === 1 } };
}

/* ============================================================
 * userSetPassword — port handlers.js:165–172 (ADMIN reset).
 *  - KHÔNG cần mật khẩu cũ (bản chất fn admin — khác changePassword
 *    tự thân ở lib/auth.ts vốn verify old).
 *  - password thiếu → đặt về DEFAULT_PASSWORD và BẬT must_change=1
 *    (giao credential mặc định công khai ⇒ buộc đổi — nhất quán
 *    userAdd/v3.6:156; v3.6 không có nhánh omitted vì bắt buộc newPw).
 *  - password custom → KHÔNG ĐỤNG must_change (v3.6:165–172 nguyên văn:
 *    admin đặt mk thì cờ giữ nguyên — "giữ 1 khi admin đặt"; bất kể ai gọi.
 *    CHỈ changePassword tự thân (lib/auth.ts) mới xóa cờ — đúng GĐ3.6.2).
 * ============================================================ */
export async function userSetPassword(
  api: Api,
  p: { id?: any; password?: any } = {}
): Promise<Envelope> {
  const g = gateAdmin(api);
  if (!g.actor) return g.err || { ok: false, error: '401' };
  const id = str(p?.id, 12);
  if (!id) return { ok: false, error: 'Thiếu id tài khoản.' };
  const u = (await q(
    "SELECT id, name, must_change FROM users WHERE id = $1 AND deleted_at = ''",
    [id]
  )).rows[0];
  if (!u) {
    return { ok: false, error: 'Không tìm thấy tài khoản.' }; // v3.6:167
  }
  const custom = p?.password !== undefined && p?.password !== null && p?.password !== '';
  let pw: string;
  if (custom) {
    if (typeof p.password !== 'string') {
      return { ok: false, error: 'Mật khẩu phải là chuỗi.' };
    }
    if (p.password.length < 6) {
      return { ok: false, error: 'Mật khẩu mới phải từ 6 ký tự.' }; // v3.6:168
    }
    pw = p.password;
  } else {
    pw = DEFAULT_PASSWORD;
    await setMustChange(id, true); // nhánh v5-only (xem doc-block): phát default → buộc đổi
  }
  if (custom && pw === DEFAULT_PASSWORD) {
    // Admin cố tình đặt đúng mk mặc định → vẫn phải buộc đổi (GĐ3.6.2).
    await setMustChange(id, true);
  }
  await setPasswordFor(id, pw);
  try {
    await logActivity(api.db, {
      actor_id: g.actor.id, actor_role: g.actor.role, hanh_dong: 'user_pw_reset',
      doi_tuong: 'user', doi_tuong_id: id,
      mo_ta: 'Đặt lại mật khẩu cho ' + id, // v3.6:170 nguyên văn
    });
  } catch (e) {
    log.logError('userSetPassword: logActivity failed', e, { id });
  }
  log.logInfo('userSetPassword OK (admin reset)', { id, by: g.actor.id }); // INFO không kèm pw
  return { ok: true, result: { id } };
}

/* ============================================================
 * userSetActive — port handlers.js:175–186.
 * v5 không có cột active → KHÓA = soft-delete deleted_at=ISO,
 * MỞ = deleted_at='' (quy ước dmDelete kho.ts:1263).
 * CHẶN theo v3.6:180–182: mọi tài khoản role admin (không chỉ "admin
 * cuối" — v3.6 chặn cả cụm quản trị để không tự cô lập lockout) và
 * chính tài khoản đang đăng nhập.
 * Ghi chú parity session: v3.6 cũng KHÔNG đá session khi khóa
 * (sessionUser auth.js:95 không lọc active) → v5 giữ hành vi; thu hồi
 * session tích cực = việc riêng (nêu ở Production Check).
 * ============================================================ */
export async function userSetActive(
  api: Api,
  p: { id?: any; active?: any } = {}
): Promise<Envelope> {
  const g = gateAdmin(api);
  if (!g.actor) return g.err || { ok: false, error: '401' };
  const id = str(p?.id, 12);
  if (!id) return { ok: false, error: 'Thiếu id tài khoản.' };
  let on: boolean;
  if (p?.active === true || p?.active === 1 || p?.active === '1' || p?.active === 'true') on = true;
  else if (p?.active === false || p?.active === 0 || p?.active === '0' || p?.active === 'false') on = false;
  else return { ok: false, error: 'active phải là true/false.' }; // whitelist kiểu — không truthy mù kiểu v3.6
  // Đọc cả bản ghi đã soft-deleted để MỞ được khóa (v3.6 userByLogin không lọc active).
  const u = (await q('SELECT id, name, role, deleted_at FROM users WHERE id = $1', [id])).rows[0];
  if (!u) {
    return { ok: false, error: 'Không tìm thấy tài khoản.' }; // v3.6:177
  }
  if (!on && (u.role === 'admin' || u.id === g.actor.id)) {
    return { ok: false, error: 'Không thể khóa tài khoản quản trị hoặc tài khoản đang dùng.' }; // v3.6:181
  }
  await q('UPDATE users SET deleted_at = $2 WHERE id = $1', [id, on ? '' : new Date().toISOString()]);
  try {
    await logActivity(api.db, {
      actor_id: g.actor.id, actor_role: g.actor.role, hanh_dong: on ? 'user_open' : 'user_lock',
      doi_tuong: 'user', doi_tuong_id: id,
      mo_ta: (on ? 'Mở khóa' : 'Khóa') + ' tài khoản ' + id, // v3.6:184 nguyên văn
    });
  } catch (e) {
    log.logError('userSetActive: logActivity failed', e, { id });
  }
  log.logInfo('userSetActive OK', { id, active: on, by: g.actor?.id });
  return { ok: true, result: { id, active: on } };
}

/* ============================================================
 * NGƯỠNG (config) — port handlers.js:604–618 + perm.js:109–110 + asset.js:21.
 * Đọc/ghi BẰNG TABLE config thật (key TEXT PK, value TEXT — schema:315).
 * ============================================================ */

/** Đọc 1 ngưỡng + đảm default idempotent nếu key chưa tồn tại
 *  (pattern sc.ts:826 scNguong / kho.ts:1311 muaNguong — ON CONFLICT DO
 *  NOTHING rồi SELECT; KHÔNG được xóa key hệ thống: chỉ 3 key whitelist). */
async function readThreshold(key: ThresholdKey): Promise<number> {
  await q(
    'INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
    [key, THRESHOLD_DEFAULTS[key]]
  );
  const r = (await q('SELECT value FROM config WHERE key = $1', [key])).rows[0];
  const n = Number(r?.value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * thresholdsGet — trả cả 3 ngưỡng (shape v3.6 thresholds():604–609) hoặc
 * MỘT key nếu truyền {key} (hỗn hợp v3.6 + signature task). ONLY admin theo
 * task spec (v3.6 để lộ value qua appInfo cho mọi user — giá trị ngưỡng là
 * thông tin nghiệp vụ nhạy cảm "trần duyệt", siết về admin có chủ đích;
 * appInfo v5 current NOT expose thresholds).
 */
export async function thresholdsGet(
  api: Api,
  p: { key?: any } = {}
): Promise<Envelope> {
  const g = gateAdmin(api);
  if (!g.actor) return g.err || { ok: false, error: '401' };
  if (p?.key !== undefined && p?.key !== null && p?.key !== '') {
    const key = String(p.key);
    if (!(THRESHOLD_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: 'Key không hợp lệ. Chỉ: ' + THRESHOLD_KEYS.join(', ') + '.' };
    }
    return { ok: true, result: { [key]: await readThreshold(key as ThresholdKey) } };
  }
  return {
    ok: true,
    result: {
      duyet_sc_nguong: await readThreshold('duyet_sc_nguong'),
      duyet_mua_nguong: await readThreshold('duyet_mua_nguong'),
      khau_hao_nam: await readThreshold('khau_hao_nam'),
    },
  };
}

/**
 * thresholdsSet — {key,value}, ONLY admin, whitelist chặn ghi key lạ
 * (xem doc THRESHOLD_KEYS — poisoning `counter_*` sẽ phá nextId()).
 * Chuẩn hóa giá trị ĐÚNG v3.6:613–615:
 *   - ngưỡng duyệt : Number(value)||0 — rác/0 âm → 0 (fail-closed: ngưỡng
 *     0 nghĩa là không ai trong ngưỡng, giamdoc/admin vẫn qua được; v3.6
 *     giữ số âm nếu truyền — v5 CHẶT hơn có chủ đích: clamp ≥0, lưu số
 *     nguyên, round như dmDecide/scApprove dùng Number()).
 *   - khau_hao_nam : Math.max(1, Number(value)) (v3.6 max(1, Number||10);
 *     rác → LỖI thay vì âm thầm 10 — input phải validate tường minh,
 *     chuẩn 2 AGENTS).
 * Audit + trả snapshot mới (v3.6:616–617 `{ok:true,...thresholds()}`).
 */
export async function thresholdsSet(
  api: Api,
  p: { key?: any; value?: any } = {}
): Promise<Envelope> {
  const g = gateAdmin(api);
  if (!g.actor) return g.err || { ok: false, error: '401' };
  const key = str(p?.key, 32);
  if (!key || !(THRESHOLD_KEYS as readonly string[]).includes(key)) {
    return { ok: false, error: 'Key không hợp lệ. Chỉ: ' + THRESHOLD_KEYS.join(', ') + '.' };
  }
  let stored: number;
  if (key === 'khau_hao_nam') {
    const n = Number(p?.value);
    if (!Number.isFinite(n) || n < 1) {
      return { ok: false, error: 'khau_hao_nam phải là số nguyên ≥ 1.' };
    }
    stored = Math.max(1, Math.trunc(n));
  } else {
    const n = Number(p?.value);
    stored = Number.isFinite(n) && n > 0 ? n : 0; // v3.6:613–614 Number()||0 (+clamp 0 thay vì âm)
  }
  await q(
    'INSERT INTO config (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
    [key, String(stored)]
  );
  try {
    await logActivity(api.db, {
      actor_id: g.actor.id, actor_role: g.actor.role, hanh_dong: 'config_set',
      doi_tuong: 'config',
      // doi_tuong_id VARCHAR(12) — key config 15 ký tự KHÔNG nhét vừa; v3.6:616
      // cũng để trống (''), tên key đưa vào mo_ta (truy vết vẫn đủ).
      mo_ta: 'Cập nhật ngưỡng duyệt / khấu hao (' + key + '=' + stored + ')',
    });
  } catch (e) {
    log.logError('thresholdsSet: logActivity failed', e, { key });
  }
  log.logInfo('thresholdsSet OK', { key, value: stored, by: g.actor.id });
  const snap = await thresholdsGet(api, {}); // v3.6:617 spread thresholds()
  return { ok: true, result: snap.result };
}
