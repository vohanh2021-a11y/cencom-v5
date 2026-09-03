/**
 * ledger.ts — Sổ cái kép (GĐ1 module kế toán VAS cost-side, nội bộ).
 * Port NGUYÊN hành vi từ draft v4 `packages/core/src/ledger.ts` (branch
 * draft/gd4-gd5-v4) sang v5: cùng tên export, cùng SQL, cùng envelope
 * {ok, id/ct_id, error}. KHÁC BIỆT KỸ THUẬT (không đổi hành vi nghiệp vụ):
 *  - `Db` v5 = pg.Pool (lib/types.ts), không có surface row/run/transaction
 *    kiểu draft → đưa vào lớp adapter `LedgerDal` (asDal) bọc Pool/PoolClient.
 *    Mọi SQL giữ nguyên từng ký tự; tham số vẫn parameterized ($1,$2).
 *  - nextId: dùng counter bảng `config` với key `counter_<PREFIX>` theo đúng
 *    quy ước v5 (lib/db.ts) — thay key trần kiểu draft; format id giữ
 *    PREFIX-000001. Trong transaction của caller → chạy trên CÙNG client
 *    (FOR UPDATE, atomic như draft).
 *  - audit: draft ghi `log_audit` (không tồn tại ở v5) → map sang
 *    `activity_log` (standard v5, cùng họ log với logActivity/auditTx của
 *    lib/core/kho.ts). INSERT actor_id qua subquery EXISTS(users) để KHÔNG
 *    rollback tx nghiệp vụ khi actor là string ngoài users (draft không có FK).
 *    Best-effort + WARN (đúng tinh thần try/catch của draft db.audit).
 *
 * - ledgerPost: ghi chứng từ + bút toán. Bắt buộc:
 *     + mỗi bút toán đúng 1 bên Nợ hoặc Có > 0;
 *     + tổng Nợ = tổng Có (cân bằng);
 *     + mỗi tài khoản tồn tại trong `tai_khoan`;
 *     + ngày không nằm trong kỳ đã đóng (`ky_ke_toan.da_dong`).
 * - ledgerList: tra cứu bút toán (lọc tài khoản / ngày / loại chứng từ).
 * - postInner: ghi trong transaction của module khác (tích hợp kho/SC GĐ2).
 * - getCogsMethod: đọc phương pháp tính giá vốn (binh_quan | fifo).
 *
 * Bảo mật: check quyền ke_toan.tao / ke_toan.xem; SQL parameterized ($1,$2);
 * audit + soft-delete; không hardcode secret.
 * Ghi chú: transaction bọc nextId + INSERT + audit → nhất quán, rollback nếu lệch.
 */
import type { PoolClient } from 'pg';
import type { Db, Actor, PermLike } from '../types';
import { createScopedLogger } from '../observability';

const log = createScopedLogger('ledger');

export type { Actor, PermLike };
export interface AuthLike {
  current(): Actor | null;
}
export interface LedgerApi {
  db: Db;
  auth: AuthLike;
  perm: PermLike;
}

export interface LedgerEntry {
  tai_khoan: string;
  du_no?: number;
  du_co?: number;
}
export interface LedgerPostArg {
  so_ct: string;
  ngay: string;
  loai_ct: string;
  nguoi?: string;
  ref_type?: string;
  ref_id?: string;
  note?: string;
  entries: LedgerEntry[];
}

/* ------------------------------------------------------------------ */
/* LedgerDal — adapter surface khớp 1-1 với `Db` của draft v4          */
/* ------------------------------------------------------------------ */

export interface LedgerDal {
  row<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T | undefined>;
  rows<T = Record<string, unknown>>(sql: string, ...params: unknown[]): Promise<T[]>;
  run(sql: string, ...params: unknown[]): Promise<void>;
  nextId(prefix: string): Promise<string>;
  today(): string;
  configGet(key: string, def?: string): Promise<string>;
  configSet(key: string, value: string): Promise<void>;
  audit(hanhVi: string, bang: string, idDong: string | number, nguoi: string, noiDung?: string): Promise<void>;
}

interface SqlLike {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

function todayLocal(): string {
  const d = new Date();
  const p2 = (n: number): string => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
}

function dalFromExecutor(exec: SqlLike, nextIdExclusive: boolean): LedgerDal {
  async function row<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
    const r = await exec.query(sql, params);
    return r.rows[0] as T | undefined;
  }
  async function rows<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    const r = await exec.query(sql, params);
    return r.rows as T[];
  }
  const dal: LedgerDal = {
    row,
    rows,
    async run(sql: string, ...params: unknown[]): Promise<void> {
      await exec.query(sql, params);
    },
    async nextId(prefix: string): Promise<string> {
      // FOR UPDATE trong transaction — tránh trùng số khi 2 user tạo phiếu đồng thời
      // (đồng nhất quy ước counter_<PREFIX> của lib/db.ts v5).
      const key = 'counter_' + prefix;
      if (nextIdExclusive) {
        // Pool: tự lấy 1 client nối tiếp BEGIN/COMMIT (không dùng pool kế tiếp —
        // tránh hết connection khi nhiều tx song song, theo quy tắc lib/db.ts).
        const client = await (exec as Db).connect();
        try {
          await client.query('BEGIN');
          const id = await dalFromExecutor(client as unknown as SqlLike, false).nextId(prefix);
          await client.query('COMMIT');
          return id;
        } catch (e) {
          try {
            await client.query('ROLLBACK');
          } catch (re: unknown) {
            log.logError('nextId ROLLBACK failed', re, { prefix });
          }
          throw e;
        } finally {
          client.release();
        }
      }
      await exec.query("INSERT INTO config(key, value) VALUES($1, '0') ON CONFLICT (key) DO NOTHING", [key]);
      const c = await row<{ value: string }>('SELECT value FROM config WHERE key = $1 FOR UPDATE', key);
      const v = (Number(c?.value) || 0) + 1;
      await exec.query('UPDATE config SET value = $1 WHERE key = $2', [String(v), key]);
      return prefix + '-' + String(v).padStart(6, '0');
    },
    today: todayLocal,
    async configGet(key: string, def?: string): Promise<string> {
      const r = await row<{ value: string }>('SELECT value FROM config WHERE key=$1', key);
      return r === undefined ? (def === undefined ? '' : def) : r.value;
    },
    async configSet(key: string, value: string): Promise<void> {
      await exec.query(
        'INSERT INTO config(key, value) VALUES($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        [key, String(value)]
      );
    },
    async audit(hanhVi: string, bang: string, idDong: string | number, nguoi: string, noiDung?: string): Promise<void> {
      // Map draft (log_audit) → v5 activity_log. actor_id chỉ ghi khi tồn tại
      // trong users (FK v5) — không phá tx nghiệp vụ; nguoi vẫn nằm trong mo_ta.
      try {
        await exec.query(
          `INSERT INTO activity_log(actor_id, hanh_dong, doi_tuong, doi_tuong_id, mo_ta)
           VALUES((SELECT id FROM users WHERE id = $4 LIMIT 1), $1, $2, $3, $5)`,
          [
            String(hanhVi || ''),
            String(bang || ''),
            String(idDong ?? '').slice(0, 12),
            String(nguoi || '').slice(0, 12),
            'nguoi=' + (nguoi || '') + ' ' + (noiDung || ''),
          ]
        );
      } catch (e: unknown) {
        // log lỗi không làm sập luồng nghiệp vụ (giống db.audit của draft)
        log.logWarn('audit activity_log failed', {
          hanh_dong: hanhVi,
          doi_tuong: bang,
          id: String(idDong),
          error: (e as { message?: string })?.message,
        });
      }
    },
  };
  return dal;
}

/** Bọc pg Pool (api.db) hoặc PoolClient (trong transaction) thành LedgerDal. */
export function asDal(target: Db | PoolClient): LedgerDal {
  const isPool = typeof (target as Db).connect === 'function' && typeof (target as PoolClient).release !== 'function';
  return dalFromExecutor(target as unknown as SqlLike, isPool);
}

/**
 * Chạy fn trong MỘT transaction Postgres trên pool `db` (pg client riêng).
 * QUI TẮC (lib/db.ts): bên trong fn MỌI truy vấn phải đi qua `tx` (Dal của
 * client) — không chạm pool, tránh deadlock pool max=10.
 */
export async function runInTransaction<T>(db: Db, fn: (tx: LedgerDal) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(asDal(client));
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr: unknown) {
      log.logError('ROLLBACK failed', rollbackErr);
    }
    throw e;
  } finally {
    client.release();
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function meName(api: LedgerApi): string {
  const u = api.auth.current();
  return u ? u.name : '';
}

/**
 * Validate + thu thập tổng Nợ/Có. Chạy TRONG transaction (tx) của caller.
 * Trả {ok:false} nếu vi phạm — caller quyết định rollback.
 */
async function validateAndCollect(
  db: LedgerDal,
  arg: LedgerPostArg
): Promise<{ ok: boolean; error?: string; sumNo: number; sumCo: number }> {
  if (!arg || !Array.isArray(arg.entries) || arg.entries.length < 2)
    return { ok: false, error: 'Cần ít nhất 2 bút toán (1 Nợ, 1 Có).', sumNo: 0, sumCo: 0 };
  if (!DATE_RE.test(arg.ngay || ''))
    return { ok: false, error: 'Ngày không đúng định dạng YYYY-MM-DD.', sumNo: 0, sumCo: 0 };
  if (!arg.so_ct || !arg.loai_ct)
    return { ok: false, error: 'Thiếu số chứng từ hoặc loại chứng từ.', sumNo: 0, sumCo: 0 };

  let sumNo = 0;
  let sumCo = 0;
  for (const e of arg.entries) {
    const no = Number(e.du_no) || 0;
    const co = Number(e.du_co) || 0;
    if ((no > 0 && co > 0) || (no <= 0 && co <= 0)) {
      return {
        ok: false,
        error: 'Mỗi bút toán phải có đúng 1 bên Nợ hoặc Có > 0 (tk=' + e.tai_khoan + ').',
        sumNo,
        sumCo,
      };
    }
    const t = await db.row<{ ma_so: string }>(
      'SELECT ma_so FROM tai_khoan WHERE ma_so=$1 AND deleted_at=$2',
      String(e.tai_khoan),
      ''
    );
    if (!t) return { ok: false, error: 'Tài khoản ' + e.tai_khoan + ' không tồn tại.', sumNo, sumCo };
    if (no > 0) sumNo += no;
    else sumCo += co;
  }
  if (Math.abs(sumNo - sumCo) > 0.005)
    return {
      ok: false,
      error: 'Tổng Nợ (' + sumNo.toFixed(2) + ') phải bằng Tổng Có (' + sumCo.toFixed(2) + ').',
      sumNo,
      sumCo,
    };

  const ky = await db.row<{ id: string }>(
    'SELECT id FROM ky_ke_toan WHERE da_dong = true AND $1 BETWEEN tu_ngay AND den_ngay',
    arg.ngay
  );
  if (ky)
    return { ok: false, error: 'Kỳ kế toán đã đóng, không thể ghi chứng từ ngày ' + arg.ngay + '.', sumNo, sumCo };

  return { ok: true, sumNo, sumCo };
}

/**
 * Ghi chứng từ + bút toán trong transaction do caller quản lý.
 * Dùng cho tích hợp GĐ2 (kho/SC gọi bên trong transaction của họ).
 */
export async function postInner(
  tx: LedgerDal,
  arg: LedgerPostArg,
  me: string
): Promise<{ ok: boolean; ct_id?: string; error?: string }> {
  const v = await validateAndCollect(tx, arg);
  if (!v.ok) return { ok: false, error: v.error };
  const ctId = await tx.nextId('CT');
  await tx.run(
    'INSERT INTO chung_tu(id, tenant_id, so_ct, ngay, loai_ct, nguoi, ref_type, ref_id, note, deleted_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    ctId,
    'c1',
    arg.so_ct,
    arg.ngay,
    arg.loai_ct,
    arg.nguoi || me,
    arg.ref_type || '',
    arg.ref_id || '',
    arg.note || '',
    ''
  );
  for (const e of arg.entries) {
    const ltId = await tx.nextId('LT');
    await tx.run(
      'INSERT INTO ledger(id, tenant_id, ct_id, ngay, tai_khoan, du_no, du_co, ref_type, ref_id, deleted_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      ltId,
      'c1',
      ctId,
      arg.ngay,
      String(e.tai_khoan),
      Number(e.du_no) || 0,
      Number(e.du_co) || 0,
      arg.ref_type || '',
      arg.ref_id || '',
      ''
    );
  }
  await tx.audit('ke_toan_tao', 'chung_tu', ctId, me, (arg.loai_ct || '') + ' ' + arg.so_ct);
  return { ok: true, ct_id: ctId };
}

/** RPC ledgerPost — ghi sổ kép (kiểm tra quyền + transaction). */
export async function ledgerPost(
  api: LedgerApi,
  arg: LedgerPostArg
): Promise<{ ok: boolean; ct_id?: string; error?: string }> {
  const u = api.auth.current();
  if (!u) return { ok: false, error: 'Chưa đăng nhập.' };
  if (!(await api.perm.can(api.db, u.role, 'ke_toan', 'tao')))
    return { ok: false, error: 'Không đủ quyền: cần ke_toan.tao.' };
  const me = meName(api);
  // Trả về {ok:false, error} khi validate fail (KHÔNG throw) để UI/dispatcher
  // nhận kết quả thống nhất. Transaction commit rỗng (không ghi row, không tăng counter).
  const result = await runInTransaction(api.db, async (tx) => {
    return await postInner(tx, arg, me);
  });
  return result;
}

/** RPC ledgerList — tra cứu bút toán (có phân quyền ke_toan.xem). */
export async function ledgerList(
  api: LedgerApi,
  arg: { tai_khoan?: string; tu_ngay?: string; den_ngay?: string; loai_ct?: string; limit?: number } = {}
): Promise<Array<Record<string, unknown>>> {
  const u = api.auth.current();
  if (!u) return [];
  if (!(await api.perm.can(api.db, u.role, 'ke_toan', 'xem'))) return [];
  const db = asDal(api.db);
  const a: unknown[] = [''];
  let sql =
    'SELECT l.*, c.so_ct, c.loai_ct, c.note FROM ledger l JOIN chung_tu c ON c.id=l.ct_id WHERE l.deleted_at=$1';
  if (arg.tai_khoan) {
    sql += ' AND l.tai_khoan=$' + (a.length + 1);
    a.push(arg.tai_khoan);
  }
  if (arg.tu_ngay) {
    sql += ' AND l.ngay>=$' + (a.length + 1);
    a.push(arg.tu_ngay);
  }
  if (arg.den_ngay) {
    sql += ' AND l.ngay<=$' + (a.length + 1);
    a.push(arg.den_ngay);
  }
  if (arg.loai_ct) {
    sql += ' AND c.loai_ct=$' + (a.length + 1);
    a.push(arg.loai_ct);
  }
  // Math.floor: chặn giá trị thập phân chèn vào LIMIT (lỗi SQL runtime ở draft)
  sql += ' ORDER BY l.ngay DESC, l.ct_id DESC LIMIT ' + Math.floor(Math.min(Number(arg.limit) || 500, 5000));
  return db.rows<Record<string, unknown>>(sql, ...a);
}

/** Đọc phương pháp tính giá vốn (binh_quan | fifo) — mặc định binh_quan. */
export async function getCogsMethod(db: Db | PoolClient | LedgerDal): Promise<'binh_quan' | 'fifo'> {
  const dal: LedgerDal =
    typeof (db as LedgerDal).row === 'function' ? (db as LedgerDal) : asDal(db as Db | PoolClient);
  const r = await dal.row<{ value: string }>(
    "SELECT value FROM ke_toan_setting WHERE key='cogs_method' AND deleted_at=$1",
    ''
  );
  return r && r.value != null && String(r.value) === 'fifo' ? 'fifo' : 'binh_quan';
}

/* ===================== v4.3 — SỔ QUỸ / PHIẾU THU NỘI BỘ (P4) ===================== */

const TK_NO_QUY: Record<string, string> = { tm: '111', tg: '112' };
const TK_CO_THU: string[] = ['331', '334', '421']; // phải trả NCC / phải trả người lao động / vốn chủ

export interface PhieuThuArg {
  ngay: string;
  loai_quy: 'tm' | 'tg';
  doi_tac?: string;
  so_tien: number;
  ly_do?: string;
  ref_id?: string;
  tai_khoan_co?: string; // 331/334/421, mặc định 331
}

/**
 * B5: Thu tiền nội bộ (hoàn ứng, thu hồi VT, thu khác).
 * KHÔNG doanh thu / AR kích. Ghi sổ quỹ + bút toán: Nợ 111/112, Có 331/334/421.
 */
export async function phieuThuCreate(
  api: LedgerApi,
  arg: PhieuThuArg
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const u = api.auth.current();
  if (!u) return { ok: false, error: 'Chưa đăng nhập.' };
  if (!(await api.perm.can(api.db, u.role, 'ke_toan', 'tao')))
    return { ok: false, error: 'Không đủ quyền: cần ke_toan.tao.' };
  const me = meName(api);
  const loai_quy = arg.loai_quy === 'tg' ? 'tg' : 'tm';
  const so_tien = Number(arg.so_tien);
  if (!(so_tien > 0)) return { ok: false, error: 'Số tiền thu phải > 0.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(arg.ngay || '')) return { ok: false, error: 'Ngày không đúng YYYY-MM-DD.' };
  const tkCo = TK_CO_THU.includes(String(arg.tai_khoan_co)) ? String(arg.tai_khoan_co) : '331';
  const tkNo = TK_NO_QUY[loai_quy];

  const result = await runInTransaction(api.db, async (tx) => {
    const sqId = await tx.nextId('SQ');
    await tx.run(
      'INSERT INTO so_quy(id, tenant_id, ngay, loai_quy, doi_tac, so_tien, loai_ps, ly_do, ref_id, deleted_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      sqId, 'c1', arg.ngay, loai_quy, arg.doi_tac || '', so_tien, 'thu', arg.ly_do || '', arg.ref_id || '', ''
    );
    const post = await postInner(
      tx,
      {
        so_ct: 'PT-' + sqId,
        ngay: arg.ngay,
        loai_ct: 'PT',
        nguoi: me,
        ref_type: 'so_quy',
        ref_id: sqId,
        note: arg.ly_do || 'Thu nội bộ',
        entries: [
          { tai_khoan: tkNo, du_no: so_tien },
          { tai_khoan: tkCo, du_co: so_tien },
        ],
      },
      me
    );
    if (!post.ok) return { ok: false, error: post.error };
    return { ok: true, id: sqId };
  });
  return result;
}
