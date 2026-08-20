/**
 * activity.ts — Module "theo dõi toàn bộ v5.0" (activity_log).
 *
 * Cơ chế dispatch: rpc-dispatch gọi `handler(api, ...args)` với `api.db` là Db.
 * Các hàm ở đây khai báo tham số đầu là `db: Db` (đúng contract nghiệp vụ),
 * và bridge `api.db ?? db` để vừa gọi trực tiếp bằng Db thật,
 * vừa nhận được qua RPC (dispatch truyền api).
 */
import type { Db } from './db.js';

export interface LogActivityParams {
  actor_id?: string;
  actor_role?: string;
  hanh_dong: string;
  doi_tuong?: string;
  doi_tuong_id?: string;
  sc_id?: string;
  mo_ta?: string;
  is_test?: number;
}

export interface ActivityFeedParams {
  limit?: number;
  offset?: number;
  sc_id?: string;
  tu_ngay?: string;
  den_ngay?: string;
}

/** Lấy Db thực từ tham số đầu (có thể là api đã bọc hoặc Db thuần). */
function resolveDb(db: Db): Db {
  const maybeApi = db as unknown as { db?: Db };
  return maybeApi && maybeApi.db ? maybeApi.db : db;
}

/**
 * logActivity — ghi 1 dòng hoạt động vào activity_log.
 * Bọc try/catch: lỗi ghi log KHÔNG được làm gãy nghiệp vụ chính (fire-and-forget an toàn).
 */
export async function logActivity(db: Db, p: LogActivityParams): Promise<void> {
  const d = resolveDb(db);
  const is_test = p.is_test ? 1 : 0;
  try {
    await d.run(
      `INSERT INTO activity_log
        (actor_id, actor_role, hanh_dong, doi_tuong, doi_tuong_id, sc_id, mo_ta, is_test, ts)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW())`,
      p.actor_id ?? '',
      p.actor_role ?? '',
      p.hanh_dong ?? '',
      p.doi_tuong ?? '',
      p.doi_tuong_id ?? '',
      p.sc_id ?? '',
      p.mo_ta ?? '',
      is_test,
    );
  } catch (e) {
    // Log lỗi ra console, KHÔNG throw (không ảnh hưởng luồng nghiệp vụ chính).
    console.error('[activity] logActivity failed:', e instanceof Error ? e.message : e);
  }
}

/**
 * activityFeed — lấy feed hoạt động (chỉ bản ghi is_test = 0, không lộ dữ liệu test).
 * Phân quyền thực hiện ở rpc-dispatch (ROLE_RESTRICT: chỉ giamdoc + admin).
 */
export async function activityFeed(db: Db, p: ActivityFeedParams): Promise<any[]> {
  const d = resolveDb(db);
  const limit = Math.min(Math.max(Number(p.limit) || 50, 1), 200);
  const offset = Math.max(Number(p.offset) || 0, 0);

  let sql =
    `SELECT id, ts, actor_id, actor_role, hanh_dong, doi_tuong, doi_tuong_id, sc_id, mo_ta
       FROM activity_log
      WHERE 1=1
        AND is_test = 0`;
  const args: unknown[] = [];

  if (p.sc_id) {
    sql += ` AND sc_id = $${args.length + 1}`;
    args.push(p.sc_id);
  }
  if (p.tu_ngay) {
    sql += ` AND ts::date >= $${args.length + 1}`;
    args.push(p.tu_ngay);
  }
  if (p.den_ngay) {
    sql += ` AND ts::date <= $${args.length + 1}`;
    args.push(p.den_ngay);
  }

  sql += ` ORDER BY ts DESC LIMIT ${limit} OFFSET ${offset}`;
  return d.rows(sql, ...args);
}
