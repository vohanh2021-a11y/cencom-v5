/**
 * lib/core/boss.ts — Tổng hợp nhìn nhanh cho BOSS (giamdoc/admin).
 *
 * Hai hàm READ-ONLY, KHÔNG ghi, KHÔNG đụng tiền:
 *  - bossDashboard(api): { kpi, ton_thieu, dm_cho_duyet, sc_tre_han } — lắp ráp
 *    từ dashboardAll (xuong.ts — KPI), tonKho low_only (kho.ts — vật tư thiếu),
 *    dmList 'cho_duyet' (kho.ts — đơn mua chờ duyệt) và truy vấn SC quá hạn
 *    han_tra_xe (cột TEXT W3.3A, soft-not-null: '' = chưa hẹn).
 *  - bossAlerts(api): mảng chuỗi cảnh báo người-dùng-đọc được cho (1) kho thiếu
 *    và (2) SC quá hạn trả xe — KHÔNG gọi dashboardAll (kanban nặng, không cần
 *    cho chuông cảnh báo).
 *
 * Quy ước theo chuẩn repo (W1b+):
 *  - Không tin một phía: mỗi nguồn dữ liệu bọc riêng (Promise.allSettled) —
 *    một nhánh hỏng chỉ làm nhánh đó rỗng + logWarn, không sập cả dashboard.
 *  - Chưa đăng nhập → trả shape rỗng (fail-closed, không lộ dữ liệu; cổng
 *    quyền đầy đủ vẫn thuộc lớp RPC dispatch — như thoList/xuong.ts).
 *  - SQL parameterized ($1,$2); enum trạng thái là HẰNG SỐ nội bộ, không phải
 *    input người dùng → giữ literal trong câu hỏi (đúng pattern xuong.ts).
 *  - Chống N+1: SC quá hạn = 1 query JOIN xe (lấy bien_so) ORDER BY hạn, cap
 *    200 dòng (trần pagination của kho.ts).
 *
 * Trễ hạn (so_ngay_tre) tính theo ngày UTC — cùng quy ước todayStr() của
 * xuong.ts/kho.ts (ISO YYYY-MM-DD).
 */

import type { Api } from '../types';
import { createScopedLogger } from '../observability';
import { dashboardAll } from './xuong';
import type { XuongKpi } from './xuong';
import { tonKho, dmList } from './kho';

const log = createScopedLogger('boss');

/** Ngày hệ thống YYYY-MM-DD UTC — đồng nhất todayStr() xuong.ts/kho.ts. */
function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/** Trạng thái kết thúc của SC — quá hạn chỉ có nghĩa khi phiếu còn sống.
 *  (enum db/schema.sql CHECK; 'da_quyet'/'tu_choi' = không còn trách nhiệm hẹn). */
const TT_DONE = ['da_quyet', 'tu_choi'];

/** Nhãn trạng thái cho chuỗi cảnh báo (ánh xạ COL_TT xuong.ts — bản rút gọn). */
const TT_LABEL: Record<string, string> = {
  de_xuat: 'đề xuất',
  da_duyet: 'đã duyệt',
  dang_sua: 'đang sửa',
  da_hoan: 'chờ nghiệm thu',
  da_quyet: 'đã quyết toán',
  tu_choi: 'từ chối',
};

/** Số cap cho mỗi mảng dashboard (trần limit 1..200 của kho.ts — không tự nới). */
const CAP = 200;

export interface BossScTreHan {
  id: string;
  bien_so: string;
  trang_thai: string;
  /** YYYY-MM-DD — hẹn trả xe (cột han_tra_xe) */
  han_tra_xe: string;
  tong: number;
  so_ngay_tre: number;
}

export interface BossDashboard {
  /** KPI xưởng ngày (engine dashboardAll) — null khi nguồn lỗi/chặn quyền. */
  kpi: XuongKpi | null;
  /** Vật tư dưới ngưỡng (ton < ton_min) — items từ tonKho(low_only). */
  ton_thieu: any[];
  /** Đơn mua chờ duyệt — rows từ dmList(trang_thai='cho_duyet'). */
  dm_cho_duyet: any[];
  /** Phiếu sửa chữa quá hạn trả xe, sắp theo hạn gần nhất trước. */
  sc_tre_han: BossScTreHan[];
}

function soNgayTre(today: string, han: string): number {
  const d = (Date.parse(today + 'T00:00:00Z') - Date.parse(han + 'T00:00:00Z')) / 86_400_000;
  return Number.isFinite(d) && d > 0 ? Math.floor(d) : 0;
}

/**
 * SC quá hạn: han_tra_xe <> '' AND han_tra_xe < today AND chưa quyết toán/từ
 * chối AND deleted_at='' AND is_test=0 (dữ liệu test không lẫn vào sổ — quy
 * tắc mọi LIST trong repo). LEFT JOIN xe kể cả khi xe soft-delete (vẫn thấy
 * phiếu treo, bien_so '' — như kanban xuong.ts).
 */
async function queryScTreHan(api: Api, today: string): Promise<BossScTreHan[]> {
  const r = await api.db.query(
    'SELECT s.id, s.trang_thai, s.han_tra_xe, s.tong, ' +
      "       COALESCE(x.bien_so, '') AS bien_so " +
      "FROM sc s LEFT JOIN xe x ON x.id = s.xe_id " +
      "WHERE s.deleted_at = '' AND s.is_test = 0 " +
      "  AND s.han_tra_xe <> '' AND s.han_tra_xe < $1 " +
      '  AND s.trang_thai <> ALL($2) ' +
      'ORDER BY s.han_tra_xe ASC, s.id ASC LIMIT $3',
    [today, TT_DONE, CAP]
  );
  return (r.rows as any[]).map((row) => ({
    id: String(row.id),
    bien_so: String(row.bien_so ?? ''),
    trang_thai: String(row.trang_thai),
    han_tra_xe: String(row.han_tra_xe),
    tong: Number(row.tong ?? 0),
    so_ngay_tre: soNgayTre(today, String(row.han_tra_xe)),
  }));
}

/**
 * bossDashboard — bảng tổng quan cho sếp: KPI xưởng + kho thiếu + DM chờ duyệt
 * + SC quá hạn. Bốn nguồn đọc SONG SONG (độc lập thật sự),Promise.allSettled để
 * một nhánh DB lỗi chỉ làm nhánh đó rỗng (logWarn) — không kéo sập cả trang.
 * Envelope {ok:false} của nguồn (401/403/chặn ketoan) → fallback rỗng, KHÔNG
 * throw (quy ước hàm mới từ W1b).
 */
export async function bossDashboard(api: Api): Promise<BossDashboard> {
  const empty: BossDashboard = { kpi: null, ton_thieu: [], dm_cho_duyet: [], sc_tre_han: [] };
  const u = api.auth.current();
  if (!u) {
    log.logWarn('bossDashboard: unauthenticated — trả rỗng (fail-closed)', {});
    return empty;
  }
  const today = todayStr();

  const [dashSettled, tonSettled, dmSettled, scSettled] = await Promise.allSettled([
    dashboardAll(api),
    tonKho(api, { low_only: true, limit: CAP }),
    dmList(api, { trang_thai: 'cho_duyet', limit: CAP }),
    queryScTreHan(api, today),
  ]);

  let kpi: XuongKpi | null = null;
  if (dashSettled.status === 'fulfilled' && dashSettled.value.ok) {
    kpi = dashSettled.value.result?.kpi ?? null;
  } else {
    log.logWarn('bossDashboard: dashboardAll nhánh lỗi — kpi null', {
      reason: dashSettled.status === 'rejected'
        ? String((dashSettled.reason as any)?.message ?? dashSettled.reason)
        : String((dashSettled.value as any)?.error ?? 'n/a'),
      actor: u.id,
    });
  }

  let ton_thieu: any[] = [];
  if (tonSettled.status === 'fulfilled' && tonSettled.value.ok) {
    ton_thieu = tonSettled.value.result?.items ?? [];
  } else {
    log.logWarn('bossDashboard: tonKho nhánh lỗi — ton_thieu rỗng', {
      reason: tonSettled.status === 'rejected'
        ? String((tonSettled.reason as any)?.message ?? tonSettled.reason)
        : String((tonSettled.value as any)?.error ?? 'n/a'),
    });
  }

  let dm_cho_duyet: any[] = [];
  if (dmSettled.status === 'fulfilled' && dmSettled.value.ok) {
    dm_cho_duyet = dmSettled.value.result ?? [];
  } else {
    log.logWarn('bossDashboard: dmList nhánh lỗi — dm_cho_duyet rỗng', {
      reason: dmSettled.status === 'rejected'
        ? String((dmSettled.reason as any)?.message ?? dmSettled.reason)
        : String((dmSettled.value as any)?.error ?? 'n/a'),
    });
  }

  let sc_tre_han: BossScTreHan[] = [];
  if (scSettled.status === 'fulfilled') {
    sc_tre_han = scSettled.value;
  } else {
    log.logError('bossDashboard: queryScTreHan thất bại — sc_tre_han rỗng', scSettled.reason, {
      actor: u.id,
    });
  }

  return { kpi, ton_thieu, dm_cho_duyet, sc_tre_han };
}

/**
 * bossAlerts — chuông cảnh báo chữ cho sếp (icon đỏ/trên header): kho thiếu +
 * SC quá hạn trả xe. Cố ý KHÔNG gọi dashboardAll (kanban 2 batch query nặng —
 * không cần cho danh sách vài dòng). Chưa đăng nhập → [] (fail-closed).
 * Trả mảng chuỗi định dạng tiếng Việt, order: thiếu kho trước, quá hạn sau.
 */
export async function bossAlerts(api: Api): Promise<string[]> {
  const u = api.auth.current();
  if (!u) {
    log.logWarn('bossAlerts: unauthenticated — trả rỗng (fail-closed)', {});
    return [];
  }
  const today = todayStr();

  const [tonSettled, scSettled] = await Promise.allSettled([
    tonKho(api, { low_only: true, limit: CAP }),
    queryScTreHan(api, today),
  ]);

  const alerts: string[] = [];

  if (tonSettled.status === 'fulfilled' && tonSettled.value.ok) {
    for (const it of (tonSettled.value.result?.items ?? []) as any[]) {
      alerts.push(
        `Kho thiếu: ${it.ten} — còn ${Number(it.ton)}/${Number(it.ton_min)} ${String(it.don_vi ?? '').trim()}`.trimEnd()
      );
    }
  } else {
    log.logWarn('bossAlerts: tonKho nhánh lỗi — bỏ qua cảnh báo kho', {
      reason: tonSettled.status === 'rejected'
        ? String((tonSettled.reason as any)?.message ?? tonSettled.reason)
        : String((tonSettled.value as any)?.error ?? 'n/a'),
    });
  }

  if (scSettled.status === 'fulfilled') {
    for (const p of scSettled.value) {
      const xe = p.bien_so ? ` (xe ${p.bien_so})` : '';
      alerts.push(
        `Quá hạn trả xe: ${p.id}${xe} — hẹn ${p.han_tra_xe}, trễ ${p.so_ngay_tre} ngày [${TT_LABEL[p.trang_thai] ?? p.trang_thai}]`
      );
    }
  } else {
    log.logError('bossAlerts: queryScTreHan thất bại — bỏ qua cảnh báo hạn', scSettled.reason, {
      actor: u.id,
    });
  }

  return alerts;
}
