/**
 * handlers.ts — Các hàm báo cáo tổng hợp (port từ server/handlers.js v3.6, chỉ phần dùng cho report.ts).
 * Gộp: vehicleHealthLog, fleetReport, accountingReport.
 * Dùng trực tiếp modules core (db, scoring) thay vì gọi qua handlers monolith.
 */
import type { Db } from './db.js';
import * as scoring from './scoring.js';
import * as kho from './kho.js';

export interface HandlerApi {
  db: Db;
}

const SCALE_ORDER = ['A', 'B', 'C', 'D', 'E'];
const SCALE = {
  A: { label: 'Tốt', color: '22C55E' },
  B: { label: 'Khá', color: '84CC16' },
  C: { label: 'Trung bình', color: 'EAB308' },
  D: { label: 'Kém', color: 'F97316' },
  E: { label: 'Nguy hiểm', color: 'EF4444' }
};

function inc(map: Record<string, number>, k: string) {
  map[k] = (map[k] || 0) + 1;
}

/** Tổng hợp sức khỏe từng bộ phận của 1 xe (cho tablet & in). */
export async function vehicleHealthLog(api: HandlerApi, bks: string): Promise<{ xe: Record<string, unknown>; groups: Array<Record<string, unknown>> } | null> {
  const db = api.db;
  const xe = await db.xeByBks(bks);
  if (!xe) return null;
  const raw = await db.rows<Record<string, unknown>>('SELECT * FROM ket_qua WHERE bks=$1 ORDER BY id', bks);
  const byItem: Record<number, Array<Record<string, unknown>>> = {};
  raw.forEach((r) => {
    const itemId = Number(r.item_id);
    if (!byItem[itemId]) byItem[itemId] = [];
    byItem[itemId].push({
      phieu_id: r.phieu_id, ngay: r.ngay, mode: r.p_mode || '',
      value: r.value, ghi_chu: r.ghi_chu || ''
    });
  });
  const groups = (await db.bieuMaGroups()).map((g) => {
    const items = g.items.map((it) => {
      const hist = byItem[it.item_id] || [];
      const worst = hist.reduce((w, h) => (!w || SCALE_ORDER.indexOf(String(h.value)) > SCALE_ORDER.indexOf(w)) ? String(h.value) : w, null as string | null);
      const last = hist.length ? hist[hist.length - 1] : null;
      const prev = hist.length > 1 ? hist[hist.length - 2] : null;
      let trend = '—';
      if (last && prev && String(last.value) !== String(prev.value)) {
        trend = SCALE_ORDER.indexOf(String(last.value)) < SCALE_ORDER.indexOf(String(prev.value)) ? 'Cải thiện' : 'Xấu đi';
      } else if (hist.length >= 2) {
        trend = '��n định';
      }
      return {
        item_id: it.item_id, name: it.name, priority: it.priority,
        count: hist.length, last: last, worst, trend,
        history: hist
      };
    });
    return { group_id: g.group_id, name: g.name, short: g.short, items };
  });
  return { xe: { bks: xe.bks, hang: xe.hang, dong: xe.dong, lai_xe: xe.lai_xe }, groups };
}

/** Báo cáo đội xe: KPI + từng xe + phân phòng/hãng + systemHealth. */
export async function fleetReport(api: HandlerApi): Promise<Record<string, unknown>> {
  const db = api.db;
  const xe = await db.rows<Record<string, unknown>>('SELECT * FROM xe ORDER BY bks');
  const bksList = xe.map((v) => String(v.bks));
  const allPhieu = await db.rows<Record<string, unknown>>('SELECT * FROM kiem_tra ORDER BY ngay DESC, id DESC');
  const phieuIds = allPhieu.map((p) => String(p.id));
  const allKq = phieuIds.length ? await db.rows<Record<string, unknown>>(
    'SELECT * FROM ket_qua WHERE phieu_id IN (' + phieuIds.map((_, i) => '$' + (i + 1)).join(',') + ')', ...phieuIds
  ) : [];
  const kqByPhieu: Record<string, Array<Record<string, unknown>>> = {};
  allKq.forEach((k) => {
    const pid = String(k.phieu_id);
    if (!kqByPhieu[pid]) kqByPhieu[pid] = [];
    kqByPhieu[pid].push(k);
  });
  const groups = await db.bieuMaGroups();
  const phieuAll = allPhieu.map((p) => {
    const kq = kqByPhieu[String(p.id)] || [];
    const values: Record<number, string> = {};
    kq.forEach((k) => { values[Number(k.item_id)] = String(k.value); });
    const veh = scoring.scoreVehicle(groups, values);
    return {
      id: String(p.id), bks: String(p.bks), mode: String(p.mode), ngay: String(p.ngay), nguoi: String(p.nguoi),
      assignee: String(p.assignee || ''), deadline: String(p.deadline || ''), done_at: String(p.done_at || ''),
      trang_thai: String(p.trang_thai || 'moi'),
      soMuc: kq.length, eCount: kq.filter((k) => String(k.value) === 'E').length,
      dCount: kq.filter((k) => String(k.value) === 'D').length,
      hasE: veh.hasE, avg: veh.avg, min: veh.min
    };
  });
  const phieuByBks: Record<string, Array<typeof phieuAll[0]>> = {};
  phieuAll.forEach((p) => {
    if (!phieuByBks[p.bks]) phieuByBks[p.bks] = [];
    phieuByBks[p.bks]!.push(p);
  });

  const perVehicle = xe.map((v) => {
    const bks = String(v.bks);
    const ph = (phieuByBks[bks] || []).map((p) => {
      return { ...p };
    });
    const newest = ph[0] || null;
    const prev = ph[1] || null;
    const eTotal = ph.reduce((a, p) => a + (p.eCount || 0), 0);
    let trend = '—';
    if (newest && prev && (newest.avg !== prev.avg)) {
      trend = (newest.avg ?? 0) > (prev.avg ?? 0) ? 'Cải thiện ▲' : 'Suy giảm ��';
    } else if (ph.length >= 2) trend = '��n định';
    return {
      bks: String(v.bks), hang: String(v.hang), dong: String(v.dong || ''), nam_sx: String(v.nam_sx || ''),
      lai_xe: String(v.lai_xe || ''), phong_ban: String(v.phong_ban || ''), trang_thai: String(v.trang_thai || ''),
      loai_pt: String(v.loai_pt || ''), danh_gia_pct: Number(v.danh_gia_pct) || 0,
      soPhieu: ph.length,
      lastNgay: newest?.ngay || null,
      lastAssignee: newest?.assignee || newest?.nguoi || '',
      lastTrangThai: newest?.trang_thai || '',
      lastAvg: newest?.avg ?? null,
      lastE: newest?.eCount ?? 0,
      lastD: newest?.dCount ?? 0,
      eTotal,
      trend
    };
  });

  const kpi = {
    vehCount: xe.length,
    hoatDong: perVehicle.filter((v) => String(v.trang_thai || '').toLowerCase().includes('hoạt động')).length,
    duPhong: perVehicle.filter((v) => String(v.trang_thai || '').toLowerCase().includes('dự phòng')).length,
    thanhLy: perVehicle.filter((v) => String(v.trang_thai || '').toLowerCase().includes('thanh lý')).length,
    phieuCount: phieuAll.length,
    eTotal: phieuAll.reduce((a, p) => a + (p.eCount || 0), 0),
    chiPhi: 0
  };

  const byPhong: Record<string, number> = {};
  const byHang: Record<string, number> = {};
  const byNam: Record<string, { count: number; sum: number; avg?: number }> = {};
  perVehicle.forEach((v) => {
    inc(byPhong, v.phong_ban || '—');
    inc(byHang, v.hang || '—');
    const n = String(v.nam_sx || 0);
    byNam[n] = byNam[n] || { count: 0, sum: 0 };
    byNam[n].count++;
    byNam[n].sum += Number(v.danh_gia_pct) || 0;
  });
  Object.keys(byNam).forEach((k) => {
    byNam[k]!.avg = byNam[k]!.count ? Math.round(byNam[k]!.sum / byNam[k]!.count) : 0;
  });

  // systemHealth - pre-fetch allKq first
  const systemHealthKq = await db.rows<Record<string, unknown>>('SELECT bks, item_id, value FROM ket_qua ORDER BY id');
  const lastByItem: Record<string, Record<number, string>> = {};
  systemHealthKq.forEach((r) => {
    const bks = String(r.bks);
    const map = lastByItem[bks] || (lastByItem[bks] = {});
    map[Number(r.item_id)] = String(r.value);
  });
  const systemHealth = groups.map((g) => {
    const levels = { A: 0, B: 0, C: 0, D: 0, E: 0 };
    let evaluated = 0;
    const risk: string[] = [];
    Object.keys(lastByItem).forEach((bks) => {
      const map = lastByItem[bks]!;
      let worst: string | null = null;
      g.items.forEach((it) => {
        const val = map[it.item_id];
        if (!val) return;
        if (worst == null || SCALE_ORDER.indexOf(val) > SCALE_ORDER.indexOf(worst)) worst = val;
      });
      if (!worst) return;
      evaluated++;
      levels[worst as keyof typeof levels]++;
      if (worst === 'E' || worst === 'D') risk.push(bks);
    });
    return {
      group_id: g.group_id, name: g.name, short: g.short,
      evaluated, levels, risk: risk.slice(0, 8), riskCount: risk.length
    };
  });

  return { kpi, perVehicle, byPhong, byHang, byNam, bySystem: await Promise.all(systemHealth), groups, scale: SCALE };
}

/** Báo cáo kế toán tháng/quý. */
export async function accountingReport(api: HandlerApi, opts: { from?: string; to?: string; group?: 'month' | 'quarter' } = {}): Promise<Record<string, unknown>> {
  const db = api.db;
  const from = opts.from || '2000-01-01';
  const to = opts.to || '2099-12-31';
  const group = opts.group === 'quarter' ? 'quarter' : 'month';

  const phieuRows = await db.rows<Record<string, unknown>>(
    'SELECT * FROM kiem_tra WHERE ngay >= $1 AND ngay <= $2 ORDER BY ngay, id', from, to
  );
  const phieuAll = await Promise.all(phieuRows.map(async (p) => {
    const kq = db.ketQuaByPhieu ? await db.ketQuaByPhieu(String(p.id)) : [];
    const values: Record<number, string> = {};
    kq.forEach((k) => { values[Number(k.item_id)] = String(k.value); });
    const veh = scoring.scoreVehicle(await db.bieuMaGroups(), values);
    return {
      id: String(p.id), bks: String(p.bks), mode: String(p.mode), ngay: String(p.ngay), nguoi: String(p.nguoi),
      assignee: String(p.assignee || ''), deadline: String(p.deadline || ''), done_at: String(p.done_at || ''),
      trang_thai: String(p.trang_thai || 'moi'),
      soMuc: kq.length, eCount: kq.filter((k) => String(k.value) === 'E').length,
      dCount: kq.filter((k) => String(k.value) === 'D').length,
      hasE: veh.hasE, avg: veh.avg, min: veh.min
    };
  }));

  function bucketKey(ngay: string) {
    const m = String(ngay || '').slice(0, 7);
    if (group === 'quarter') {
      const [y, mm] = String(ngay).split('-');
      const q = Math.floor((Number(mm) - 1) / 3) + 1;
      return y + '-Q' + q;
    }
    return m;
  }
  function bucketLabel(k: string) {
    if (group === 'quarter') return 'Quý ' + k.split('-Q')[1] + '/' + k.slice(0, 4);
    const [y, m] = k.split('-');
    return 'Tháng ' + Number(m) + '/' + y;
  }

  const order: string[] = [];
  class MapVal {
    key: string;
    label: string;
    phieu = 0;
    xe = new Map<string, number>();
    soMuc = 0;
    eCount = 0;
    dCount = 0;
    sumAvg = 0;
    avgN = 0;
    hoanThanh = 0;
    byAssignee = new Map<string, number>();
    constructor(k: string, label: string) {
      this.key = k;
      this.label = label;
    }
  }
  const map: Record<string, MapVal> = {};
  phieuAll.forEach((p) => {
    const k = bucketKey(p.ngay);
    if (!map[k]) {
      map[k] = new MapVal(k, bucketLabel(k));
      order.push(k);
    }
const b = map[k]!;
    b.phieu++;
    b.xe.set(String(p.bks || '—'), 1);
    b.soMuc += p.soMuc || 0;
    b.eCount += p.eCount || 0;
    b.dCount += p.dCount || 0;
    if (p.avg != null) { b.sumAvg += p.avg; b.avgN++; }
    if (p.trang_thai === 'hoan_thanh' || p.trang_thai === 'da_duyet') b.hoanThanh++;
    const who = String(p.assignee || p.nguoi || '—');
    b.byAssignee.set(who, (b.byAssignee.get(who) || 0) + 1);
  });

  const buckets = order.map((k) => {
    const b = map[k]!;
    return {
      key: b.key, label: b.label, phieu: b.phieu, xe: Object.keys(b.xe).length,
      soMuc: b.soMuc, eCount: b.eCount, dCount: b.dCount,
      pctE: b.soMuc ? Math.round(b.eCount * 1000 / b.soMuc) / 10 : 0,
      avg: b.avgN ? Math.round(b.sumAvg / b.avgN * 100) / 100 : null,
      hoanThanh: b.hoanThanh, byAssignee: b.byAssignee
    };
  });

  const totals = buckets.reduce((a, b) => {
    const bb = b!;
    a.phieu += bb.phieu; a.xe += bb.xe; a.soMuc += bb.soMuc;
    a.eCount += bb.eCount; a.dCount += bb.dCount; a.hoanThanh += bb.hoanThanh;
    a.avgSum += (bb.avg || 0) * bb.phieu; a.avgN += bb.phieu;
    return a;
  }, { phieu: 0, xe: 0, soMuc: 0, eCount: 0, dCount: 0, hoanThanh: 0, avgSum: 0, avgN: 0 });

  const detail = phieuAll.map((p) => ({
    period: bucketKey(String(p.ngay || '')), periodLabel: bucketLabel(bucketKey(String(p.ngay || ''))),
    id: p.id, bks: p.bks, ngay: p.ngay, mode: p.mode, nguoi: p.nguoi,
    assignee: p.assignee || '', trang_thai: p.trang_thai,
    soMuc: p.soMuc, eCount: p.eCount, dCount: p.dCount, avg: p.avg
  }));

  return {
    from, to, group, buckets,
    totals: {
      phieu: totals.phieu, xe: totals.xe, soMuc: totals.soMuc,
      eCount: totals.eCount, dCount: totals.dCount, hoanThanh: totals.hoanThanh,
      pctE: totals.soMuc ? Math.round(totals.eCount * 1000 / totals.soMuc) / 10 : 0,
      avg: totals.avgN ? Math.round(totals.avgSum / totals.avgN * 100) / 100 : null
    },
    detail
  };
}