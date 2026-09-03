/**
 * list.ts — Helper phân trang thật (GĐ-2) cho các hàm list core — PORT từ
 * draft v4 `packages/core/src/list.ts` (commit 8397979) sang v5 `lib/core/`.
 *
 * Trả mảng kèm thuộc tính total/page/limit/pages (tương thích ngược: UI duyệt
 * như mảng bình thường, đọc .total để hiện pager).
 *
 * Delta v4 → v5 (chỉ thích ứng driver, KHÔNG đổi hành vi):
 *  1) v4 dùng wrapper Db riêng (`db.row(sql, ...args)`); v5 `Db = pg.Pool`
 *     (lib/types.ts) → chuyển sang `db.query(text, values[])` — cùng ngữ
 *     nghĩa: 1 count + 1 select với LIMIT/OFFSET đặt ở $n tiếp sau params.
 *  2) `db: any` → `db: Db` (typed, strict).
 *
 * SECURITY CONTRACT (giữ nguyên như v4, caller PHAI tuân thủ):
 *  - `selectFrom` / `where` / `countFrom` / `order` là SQL FRAGMENT NỘI BỘ do
 *    module core tự dựng — tuyệt đối KHÔNG nối chuỗi dữ liệu người dùng vào
 *    đây; giá trị user-input chỉ được đi qua `params` dạng placeholder $1..$n.
 *  - `where` dùng chung cho cả COUNT lẫn SELECT nên mọi $n trong selectFrom
 *    (nếu có subquery) phải tính sẵn trong params theo thứ tự.
 *
 * LƯU Ý: `countFrom` là biểu thức dùng cho COUNT (vd "phieu_sua p"), có thể
 * khác `selectFrom` khi select chứa subquery có FROM riêng.
 */
import type { Db } from '../types';

export type Paginated<T> = T[] & {
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export async function paginate<T>(
  db: Db,
  selectFrom: string,
  where: string,
  params: unknown[],
  order: string,
  page: number,
  limit: number,
  countFrom: string
): Promise<Paginated<T>> {
  const pageN = Math.max(1, Number(page) || 1);
  const limitN = Math.min(Math.max(1, Number(limit) || 50), 5000);
  const countRes = await db.query('SELECT COUNT(*) c FROM ' + countFrom + where, params);
  const total = Number(countRes.rows[0]?.c ?? 0);
  const offset = (pageN - 1) * limitN;
  const sql =
    selectFrom + where + ' ' + order +
    ' LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
  const rows = (await db.query(sql, [...params, limitN, offset])).rows as T[];
  const out = rows as Paginated<T>;
  out.total = total;
  out.page = pageN;
  out.limit = limitN;
  out.pages = Math.ceil(total / limitN) || 1;
  return out;
}

export function normPage(q: { page?: unknown; limit?: unknown }): { page: number; limit: number } {
  return { page: Math.max(1, Number(q.page) || 1), limit: Math.min(Math.max(1, Number(q.limit) || 50), 5000) };
}
