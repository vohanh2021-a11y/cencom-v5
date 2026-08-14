/**
 * scoring.test.ts — Conformance scoring (port scoring.js → scoring.ts):
 * thang A-E, scoreSystem theo nhóm, scoreVehicle toàn xe.
 */
import { describe, it, expect } from 'vitest';
import { SCALE, SCALE_ORDER, scoreSystem, scoreVehicle } from '../src/scoring.js';

const GROUPS = [
  { group_id: 1, name: 'Động cơ', short: 'DC', items: [{ item_id: 101 }, { item_id: 102 }, { item_id: 103 }] },
  { group_id: 2, name: 'Phanh', short: 'PH', items: [{ item_id: 201 }, { item_id: 202 }] },
];

describe('scoring.SCALE', () => {
  it('A=5 … E=1 + nhãn', () => {
    expect(SCALE.A!.weight).toBe(5);
    expect(SCALE.E!.weight).toBe(1);
    expect(SCALE.C!.label).toBe('Trung bình');
    expect(SCALE_ORDER).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});

describe('scoring.scoreSystem', () => {
  it('tính avg từng nhóm theo trọng số', () => {
    const res = scoreSystem(GROUPS, { 101: 'A', 102: 'B', 103: 'C' });
    const g1 = res[1]!;
    expect(g1.count).toBe(3);
    expect(g1.total).toBe(3);
    // (5+4+3)/3 = 4
    expect(g1.avg).toBe(4);
    expect(g1.min).toBe(3);
    expect(g1.hasE).toBe(false);
    expect(g1.hasD).toBe(false);
  });

  it('hasE/hasD bật khi có E/D', () => {
    const res = scoreSystem(GROUPS, { 101: 'E', 102: 'D', 103: 'A' });
    expect(res[1]!.hasE).toBe(true);
    expect(res[1]!.hasD).toBe(true);
  });

  it('nhóm không có giá trị → avg 0, count 0', () => {
    const res = scoreSystem(GROUPS, {});
    expect(res[1]!.avg).toBe(0);
    expect(res[1]!.count).toBe(0);
  });
});

describe('scoring.scoreVehicle', () => {
  it('tổng hợp toàn xe (5+4+3+2+1)/5 = 3', () => {
    const r = scoreVehicle(GROUPS, { 101: 'A', 102: 'B', 103: 'C', 201: 'D', 202: 'E' });
    expect(r.count).toBe(5);
    expect(r.avg).toBe(3);
    expect(r.min).toBe(1);
    expect(r.hasE).toBe(true);
  });

  it('min = 0 khi không có mục nào', () => {
    const r = scoreVehicle(GROUPS, {});
    expect(r.min).toBe(0);
    expect(r.avg).toBe(0);
  });
});