/**
 * scoring.ts — Thang A-E + tổng hợp điểm (port từ server/scoring.js v3.6 — nguyên văn).
 * A=5 … E=1; trả điểm trung bình hệ thống & toàn xe.
 */

export const SCALE: Record<string, { label: string; weight: number; color: string }> = {
  A: { label: 'Tốt', weight: 5, color: '#22C55E' },
  B: { label: 'Khá', weight: 4, color: '#84CC16' },
  C: { label: 'Trung bình', weight: 3, color: '#FACC15' },
  D: { label: 'Yếu', weight: 2, color: '#F97316' },
  E: { label: 'Kém / nguy hiểm', weight: 1, color: '#EF4444' },
};

export const SCALE_ORDER = ['A', 'B', 'C', 'D', 'E'];

export interface ScoreGroup {
  group_id: number;
  name: string;
  short: string;
  items: Array<{ item_id: number }>;
}

/** groups: [{group_id, name, short, items:[{item_id}]}], values: {item_id: 'A'..'E'} */
export function scoreSystem(
  groups: ScoreGroup[],
  values: Record<number, string>
): Record<number, { group_id: number; name: string; short: string; count: number; total: number; avg: number; min: number; hasE: boolean; hasD: boolean }> {
  const result: Record<number, { group_id: number; name: string; short: string; count: number; total: number; avg: number; min: number; hasE: boolean; hasD: boolean }> = {};
  groups.forEach((g) => {
    let sum = 0;
    let cnt = 0;
    let min = 5;
    let anyE = false;
    let anyD = false;
    g.items.forEach((it) => {
      const v = values[it.item_id];
      if (!v) return;
      const w = SCALE[v] ? SCALE[v]!.weight : 0;
      sum += w;
      cnt++;
      if (w < min) min = w;
      if (v === 'E') anyE = true;
      if (v === 'D') anyD = true;
    });
    result[g.group_id] = {
      group_id: g.group_id,
      name: g.name,
      short: g.short,
      count: cnt,
      total: g.items.length,
      avg: cnt ? Math.round((sum / cnt) * 100) / 100 : 0,
      min,
      hasE: anyE,
      hasD: anyD,
    };
  });
  return result;
}

/** Điểm trung bình toàn xe. */
export function scoreVehicle(
  groups: ScoreGroup[],
  values: Record<number, string>
): { avg: number; min: number; count: number; hasE: boolean } {
  let sum = 0;
  let cnt = 0;
  let min = 5;
  let anyE = false;
  groups.forEach((g) => {
    g.items.forEach((it) => {
      const v = values[it.item_id];
      if (!v) return;
      const w = SCALE[v] ? SCALE[v]!.weight : 0;
      sum += w;
      cnt++;
      if (w < min) min = w;
      if (v === 'E') anyE = true;
    });
  });
  return { avg: cnt ? Math.round((sum / cnt) * 100) / 100 : 0, min: min === 5 ? 0 : min, count: cnt, hasE: anyE };
}

export default { SCALE, SCALE_ORDER, scoreSystem, scoreVehicle };