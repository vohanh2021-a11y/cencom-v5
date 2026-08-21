import type { Api, Db } from '../types';
import { run } from '../db';
import { createScopedLogger } from '../observability';

const log = createScopedLogger('activity');

export async function logActivity(db: Db, p: {
  actor_id?: string;
  actor_role?: string;
  hanh_dong: string;
  doi_tuong?: string;
  doi_tuong_id?: string;
  sc_id?: string;
  mo_ta?: string;
  is_test?: number;
}): Promise<void> {
  try {
    await run(
      'INSERT INTO activity_log (actor_id,actor_role,hanh_dong,doi_tuong,doi_tuong_id,sc_id,mo_ta,is_test) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [p.actor_id ?? null, p.actor_role ?? null, p.hanh_dong, p.doi_tuong ?? null, p.doi_tuong_id ?? null, p.sc_id ?? null, p.mo_ta ?? null, p.is_test ?? 0]
    );
  } catch (e) {
    log.logError('logActivity failed', e, { hanh_dong: p.hanh_dong, doi_tuong_id: p.doi_tuong_id });
  }
}

export async function activityFeed(api: Api, p?: {
  limit?: number;
  offset?: number;
  sc_id?: string;
  tu_ngay?: string;
  den_ngay?: string;
}): Promise<any[]> {
  let sql = 'SELECT * FROM activity_log WHERE is_test=0';
  const params: any[] = [];
  if (p?.sc_id) sql += ' AND sc_id=$' + (params.push(p.sc_id));
  if (p?.tu_ngay) sql += ' AND ts >= $' + (params.push(p.tu_ngay));
  if (p?.den_ngay) sql += ' AND ts <= $' + (params.push(p.den_ngay));
  // Clamp limit [0..200] và offset >= 0 — chặn giá trị âm/không hợp lệ gây lỗi truy vấn
  const limit = Math.max(0, Math.min(Number(p?.limit) || 50, 200));
  const offset = Math.max(0, Number(p?.offset) || 0);
  sql += ' ORDER BY ts DESC LIMIT $' + (params.push(limit)) + ' OFFSET $' + (params.push(offset));
  return (await api.db.query(sql, params)).rows;
}
