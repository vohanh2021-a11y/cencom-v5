/**
 * chat.ts — Nhắn tin / giao việc nội bộ GĐ3 (port từ server/chat.js v3.6 — NGUYÊN logic).
 * Thay đổi so với v3.6:
 *  - mọi hàm async (pg pool); `insertMsg` dùng `RETURNING id` (thay `SELECT MAX(id)`).
 *  - `saveImg` giữ NGUYÊN hành vi ghi JPG ra đĩa local (phục vụ dev/test);
 *    production cloud dùng Supabase Storage → client gửi `img_path` trực tiếp
 *    (chatSend ưu tiên img_path nếu có).
 *  - bot lệnh nhanh gọi kho/sc async qua `api`.
 */
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from './db.js';
import type { ScApi } from './sc.js';
import type { KhoApi } from './kho.js';
import { vnd as scVnd } from './sc.js';
import * as sc from './sc.js';
import * as kho from './kho.js';
import * as deXuat from './de_xuat.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const IMG_DIR = process.env.CHAT_IMG_DIR || join(__dirname, '..', '..', '..', 'data', 'chat_imgs');

/* ---------- auth/perm helper (port giữ nguyên chat.js) ---------- */
export interface Actor {
  id: string;
  name: string;
  role: string;
  phone?: string;
  phong_ban?: string;
}
export interface AuthLike {
  current(): Actor | null;
}
export interface PermLike {
  can(db: Db, role: string, m: string, f: string): Promise<boolean>;
}
export interface ChatApi {
  db: Db;
  auth: AuthLike;
  perm: PermLike;
}

function meId(api: ChatApi): string {
  const u = api.auth.current();
  return u ? u.id : '';
}
async function checkLock(api: ChatApi, m: string, f: string): Promise<void> {
  const u = api.auth.current();
  if (!u) throw new Error('Chưa đăng nhập.');
  if (!(await api.perm.can(api.db, u.role, m, f))) throw new Error('Không đủ quyền: cần ' + m + '.' + f);
}

export function ensureFolder(): string {
  if (!existsSync(IMG_DIR)) mkdirSync(IMG_DIR, { recursive: true });
  return IMG_DIR;
}

/* ---------------- thread ---------------- */
function threadKey(a: string, b: string): string {
  return [String(a), String(b)].sort().join('|');
}

export async function getOrCreateThread(
  db: Db,
  fromId: string,
  toId: string,
  kind?: string,
  refId?: string
): Promise<Record<string, unknown>> {
  const key = threadKey(fromId, toId);
  let t = await db.row<Record<string, unknown>>('SELECT * FROM chat_threads WHERE from_id=$1 AND to_id=$2', fromId, toId);
  if (!t) t = await db.row<Record<string, unknown>>('SELECT * FROM chat_threads WHERE from_id=$1 AND to_id=$2', toId, fromId);
  if (!t) {
    const id = 'CHT-' + key.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12) + '-' + String(Date.now()).slice(-6);
    await db.run('INSERT INTO chat_threads(id, from_id, to_id, kind, ref_id, created_at) VALUES($1,$2,$3,$4,$5,$6)',
      id, fromId, toId, kind || 'text', refId || '', db.nowStamp());
    t = (await db.row<Record<string, unknown>>('SELECT * FROM chat_threads WHERE id=$1', id)) || {};
  }
  return t;
}

export async function chatPeers(api: ChatApi): Promise<Array<Record<string, unknown>>> {
  await checkLock(api, 'chat', 'xem');
  const me = meId(api);
  return api.db.rows(
    "SELECT id, name, role FROM users WHERE active=1 AND id<>$1 AND id<>'cenbot' ORDER BY role, name", me
  );
}

export async function chatThreadOpen(
  api: ChatApi,
  rec: { to?: string; kind?: string; ref_id?: string } | undefined
): Promise<{ ok: boolean; thread?: string; error?: string }> {
  await checkLock(api, 'chat', 'tao');
  rec = rec || {};
  const me = meId(api);
  const to = String(rec.to || '');
  if (!to) return { ok: false, error: 'Thiếu người nhận.' };
  if (to === me) return { ok: false, error: 'Không thể nhắn cho chính mình.' };
  const t = await getOrCreateThread(api.db, me, to, rec.kind || 'text', rec.ref_id || '');
  return { ok: true, thread: String(t.id) };
}

/* ---------------- tin nhắn ---------------- */
export async function insertMsg(
  db: Db,
  threadId: string,
  fromId: string,
  toId: string,
  body: string,
  kind: string,
  refId: string,
  imgPath: string,
  source: string,
  isRead: boolean
): Promise<number> {
  const r = await db.row<{ id: number }>(
    'INSERT INTO chat_messages(thread_id, from_id, to_id, body, kind, source, ref_id, img_path, is_read, created_at) ' +
    'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
    threadId, fromId, toId, body, kind || 'text', source || 'user', refId || '', imgPath || '',
    isRead ? 1 : 0, db.nowStamp()
  );
  const id = Number(r?.id || 0);
  if (!isRead) {
    await db.run(
      'UPDATE chat_threads SET unread = unread + 1, last_msg=$1, last_at=$2 WHERE id=$3',
      String(body).slice(0, 80), db.nowStamp(), threadId
    );
  }
  return id;
}

function msgBody(threadId: string, m: Record<string, unknown>): Record<string, unknown> {
  return {
    id: m.id, thread: m.thread_id, from: m.from_id, to: m.to_id,
    body: m.body, kind: m.kind, source: m.source, ref_id: m.ref_id,
    img_path: m.img_path, is_read: !!m.is_read, created_at: m.created_at
  };
}

export async function chatList(
  api: ChatApi
): Promise<Array<{ id: string; peer: string; unread: number; last_msg: string; n_msg: number }>> {
  await checkLock(api, 'chat', 'xem');
  const me = meId(api);
  const rows = await api.db.rows<Record<string, unknown>>(
    `SELECT t.id, t.from_id, t.to_id, t.kind, t.last_msg, t.last_at,
            (SELECT COUNT(*) FROM chat_messages m WHERE m.thread_id=t.id AND m.to_id=$1 AND m.is_read=0) unread,
            (SELECT COUNT(*) FROM chat_messages m WHERE m.thread_id=t.id) n_msg
     FROM chat_threads t WHERE t.from_id=$2 OR t.to_id=$2 ORDER BY t.last_at DESC, t.created_at DESC`,
    me, me
  );
  return rows.map((t) => {
    const peer = me === t.from_id ? String(t.to_id) : String(t.from_id);
    return {
      id: String(t.id), peer, unread: Number(t.unread) || 0,
      last_msg: String(t.last_msg || ''), n_msg: Number(t.n_msg) || 0
    };
  });
}

export async function chatMessages(
  api: ChatApi,
  rec: { thread?: string } | undefined
): Promise<Record<string, unknown>[]> {
  await checkLock(api, 'chat', 'xem');
  const me = meId(api);
  const thId = String((rec && rec.thread) || '');
  const th = await api.db.row<Record<string, unknown>>('SELECT * FROM chat_threads WHERE id=$1', thId);
  if (!th || (th.from_id !== me && th.to_id !== me)) return [];
  const rows = await api.db.rows<Record<string, unknown>>(
    'SELECT * FROM chat_messages WHERE thread_id=$1 ORDER BY id', thId
  );
  return rows.map((m) => msgBody(thId, m));
}

export function saveImg(threadId: string, b64: string): string {
  try {
    const raw = Buffer.from(String(b64 || ''), 'base64');
    if (raw.length < 8) return '';
    if (raw[0] !== 0xff || raw[1] !== 0xd8 || raw[2] !== 0xff) return '';
    const file = threadId + '-' + Date.now() + '.jpg';
    ensureFolder();
    writeFileSync(join(IMG_DIR, file), raw);
    return file;
  } catch {
    return '';
  }
}

interface ChatSendRec {
  to?: string;
  body?: string;
  kind?: string;
  ref_id?: string;
  img?: string;
  img_path?: string;
}

export async function chatSend(
  api: ChatApi,
  rec: ChatSendRec | undefined
): Promise<{ ok: boolean; id?: string; error?: string }> {
  await checkLock(api, 'chat', 'tao');
  rec = rec || {};
  const me = meId(api);
  const to = String(rec.to || '');
  const body = String(rec.body || '').trim();
  if (!to) return { ok: false, error: 'Thiếu người nhận.' };
  const isJob = rec.kind === 'job' || /^@gioviec/i.test(body);
  if (!body && !rec.img && !rec.img_path && !(isJob && rec.ref_id)) return { ok: false, error: 'Nội dung trống.' };
  const th = await getOrCreateThread(api.db, me, to, 'text', '');
  const thId = String(th.id);
  let imgPath = String(rec.img_path || '');
  if (!imgPath && rec.img) {
    imgPath = saveImg(thId, rec.img);
    if (!imgPath) return { ok: false, error: 'File không phải ảnh JPG hợp lệ.' };
  }
  const kind = rec.kind === 'job' ? 'job' : 'text';
  await insertMsg(api.db, thId, me, to, body, kind, kind === 'job' ? (rec.ref_id || '') : '', imgPath, 'user', to === me);
  await api.db.run("UPDATE chat_threads SET last_msg=$1, last_at=$2 WHERE id=$3", body || '[ảnh]', api.db.nowStamp(), thId);
  // Bot lệnh nhanh — chuyển sang cenbot
  if (/^\/(help|ton|sc|bd|log)/i.test(body)) {
    await botReply(api, thId, me, to, body);
  }
  return { ok: true, id: thId };
}

export async function chatSendImg(
  api: ChatApi,
  rec: ChatSendRec | undefined
): Promise<{ ok: boolean; id?: string; error?: string }> {
  await checkLock(api, 'chat', 'tao');
  return chatSend(api, rec);
}

export async function chatMarkRead(
  api: ChatApi,
  rec: { thread?: string } | undefined
): Promise<{ ok: boolean }> {
  await checkLock(api, 'chat', 'xem');
  const me = meId(api);
  const th = String((rec && rec.thread) || '');
  await api.db.run('UPDATE chat_messages SET is_read=1 WHERE thread_id=$1 AND to_id=$2 AND is_read=0', th, me);
  await api.db.run('UPDATE chat_threads SET unread=0 WHERE id=$1', th);
  return { ok: true };
}

export async function chatUnreadCount(api: ChatApi): Promise<{ count: number }> {
  await checkLock(api, 'chat', 'xem');
  const me = meId(api);
  const r = await api.db.row<{ c: number }>(
    'SELECT COUNT(*) c FROM chat_messages m WHERE m.to_id=$1 AND m.is_read=0', me
  );
  return { count: Number(r?.c || 0) };
}

export async function chatDeleteMsg(
  api: ChatApi,
  rec: { id?: number } | undefined
): Promise<{ ok: boolean; error?: string }> {
  await checkLock(api, 'chat', 'tao');
  const me = meId(api);
  const id = Number((rec && rec.id) || 0);
  const m = await api.db.row<{ id: number; from_id: string }>('SELECT * FROM chat_messages WHERE id=$1', id);
  if (!m) return { ok: false, error: 'Không thấy tin.' };
  if (m.from_id !== me) return { ok: false, error: 'Chỉ xóa tin của mình.' };
  await api.db.run('DELETE FROM chat_messages WHERE id=$1', id);
  return { ok: true };
}

/* ---------------- bot lệnh nhanh ---------------- */
export async function botReply(
  api: ChatApi,
  _threadId: string,
  me: string,
  _to: string,
  body: string
): Promise<void> {
  const t = await getOrCreateThread(api.db, 'cenbot', me, 'text', '');
  const cmd = String(body).trim();
  let answer = 'Xin chào! Mình là CencomBot. Gõ /help để xem lệnh.';
  const scApi: ScApi = { db: api.db, auth: api.auth, perm: api.perm as unknown as ScApi['perm'] };
  if (/^\/help/i.test(cmd)) {
    answer = '/ton — danh sách vật tư thiếu hàng\n/sc — danh sách phiếu sửa chữa chờ xử lý\n/sc cua toi — các phiếu của bạn\n/bd — xe sắp đến hạn bảo dưỡng';
  } else if (/^\/ton/i.test(cmd)) {
    try {
      const khoApi: KhoApi = { db: api.db, auth: api.auth, perm: api.perm as unknown as KhoApi['perm'] };
      const d = await kho.tonKho(khoApi);
      const low = d.rows.filter((r) => r.low);
      answer = low.length ? 'Vật tư thiếu tối thiểu:\n' + low.map((r) => `• ${r.name}: còn ${r.ton} (min ${r.ton_min})`).join('\n') : 'Không có vật tư nào dưới mức tối thiểu.';
    } catch {
      answer = 'Lỗi khi đọc tồn kho.';
    }
  } else if (/^\/sc cua /i.test(cmd)) {
    try {
      const rows = await sc.scList(scApi, {});
      const mine: Array<Record<string, unknown>> = [];
      for (const r of rows) {
        const d = await sc.scGet(scApi, String(r.id));
        if (d && (d.sc.nguoi_lap === me || (d.cong || []).some((c) => c.tho_id === me))) mine.push(r);
      }
      answer = mine.length ? mine.map((r) => `• ${r.id} ${r.bks} — ${scVnd(Number(r.tong))}`).join('\n') : 'Bạn chưa được giao phiếu nào.';
    } catch {
      answer = 'Lỗi khi đọc phiếu của bạn.';
    }
  } else if (/^\/sc/i.test(cmd)) {
    try {
      const rows = await sc.scList(scApi, {});
      const act = rows.filter((r) => ['de_xuat', 'da_duyet', 'dang_sua'].indexOf(String(r.trang_thai)) >= 0);
      answer = act.length ? act.map((r) => `• ${r.id} ${r.bks} — ${scVnd(Number(r.tong))} (${r.trang_thai})`).slice(0, 8).join('\n') : 'Không có phiếu nào cần xử lý.';
    } catch {
      answer = 'Lỗi khi đọc phiếu sửa chữa.';
    }
  } else if (/^\/dx/i.test(cmd)) {
    try {
      const dxApi: deXuat.DeXuatApi = { db: api.db, auth: api.auth, perm: api.perm as unknown as deXuat.PermLike };
      const ds = await deXuat.deXuatList(dxApi, { trang_thai: 'cho_duyet' });
      answer = ds.length ? 'Đề xuất chờ duyệt:\n' + ds.slice(0, 8).map((d) => `• ${d.id} ${d.bks} — ${String(d.mo_ta).slice(0, 40)}`).join('\n') : 'Không có đề xuất nào chờ duyệt.';
    } catch {
      answer = 'Lỗi khi đọc đề xuất sửa chữa.';
    }
  }
  await insertMsg(api.db, String(t.id), 'cenbot', me, answer, 'text', '', '', 'bot', true);
}