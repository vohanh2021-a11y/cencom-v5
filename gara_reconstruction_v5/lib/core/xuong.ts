/**
 * lib/core/xuong.ts — W3.1-core: Bảng điều khiển XƯỞNG (dashboardAll + Kanban).
 * Port v3.6 `server/xuong.js` hàm `dashboardAll()` (dòng 119–294) + helper `vnd`.
 *
 * ============================================================
 * BẢN ĐỒ PORT v3.6 → v5 (schema v5 lean — db/schema.sql)
 * ============================================================
 * Kanban:
 *  - v3.6 5 cột ['de_xuat','da_duyet','dang_sua','cho_nghiem','tu_choi']
 *    → v5 THEO TT enum THẬT của sc.trang_thai (schema.sql dòng 31):
 *      ['de_xuat','dang_sua','da_hoan','da_quyet','tu_choi'].
 *      (`da_duyet`/`cho_nghiem` KHÔNG tồn tại ở v5; `da_hoan` = xong sửa,
 *      đang chờ nghiệm thu hồ sơ → đảm nhận vai cột 'cho_nghiem' cũ.)
 *  - STATE_PRI v3.6 {dang_sua:5, cho_nghiem:4, da_duyet:3, de_xuat:2, tu_choi:1}
 *    → port ánh xạ: {dang_sua:5, da_hoan:4, da_quyet:3, de_xuat:2, tu_choi:1}
 *      (giữ bất biến: tiến độ cao MORE priority; `tu_choi` chót).
 *  - Nhóm card: v3.6 gom theo chuỗi `bks` trên phieu_sua; v5 sc KHÔNG có bks
 *    → gom theo sc.xe_id (FK NOT NULL), JOIN xe lấy `bien_so` (1 xe = 1 card,
 *    gộp nhiều SC — hành vi v3.6.2 giữ nguyên).
 *  - % hoàn thành: v3.6 round(so_cv 'done'/tổng cv của SC "cao" nhất * 100)
 *    → v5 tt enum ('cho','dang','hoan') — 'done'→'hoan'; v5 KHÔNG có tt='huy'
 *    (hủy = soft-delete deleted_at) → bộ lọc chỉ deleted_at=''.
 *  - Sort trong cột: v3.6 sort ETA (ngay_du_kien); v5 sc KHÔNG có cột
 *    deadline/ngay_du_kien/ngay_nghiem → ETA BỎ, sort the ngay_tao→id của SC
 *    đầu card (đúng thứ tự truy vấn gốc 'ngay ASC, id ASC' của v3.6 dòng 161).
 *  - Card `tho_chinh` + khối "tải công việc theo thợ" (`sc_congviec.tho_id`):
 *    v5 KHÔNG có cột tho_id → BỎ + TODO(W3.1-reg).
 *  - `la_sua_ngoai` + bảng `lich_sua` + `baocao_thang` + bảng
 *    `yeu_cau_tham_kham` (KPI tk_*): v5 không có → BỎ + TODO(W3.1-reg).
 *
 * KPI "v5 an toàn" (chỉ dùng cột/bảng CÓ THẬT):
 *  - sc_cho_duyet  = COUNT de_xuat                 (v3.6 gộp de_xuat+da_duyet;
 *                   v5 không còn da_duyet → chính bằng nhánh sc_de_xuat cũ).
 *  - sc_dang_sua   = COUNT dang_sua.
 *  - sc_cho_nghiem = COUNT da_hoan   ( Semantic v5: xong sửa chờ nghiệm thu).
 *  - sc_quyet_hom_nay / tien_quyet_hom_nay: v3.6 đọc lich_sua.ngay=today;
 *    v5 scQuyetToan (sc.ts) CHỈ đổi trang_thai='da_quyet' + logActivity
 *    'sc_quyet_toan', KHÔNG có cột ngày quyết toán trên sc → port qua
 *    activity_log (cửa sổ ngày UTC, cùng quy ước todayStr() của kho.ts) JOIN
 *    sc(trang_thai='da_quyet', deleted_at='', is_test=0).
 *    TODO(W3.1-reg/schema): nếu muốn KPI không phụ thuộc dòng audit, cân nhắc
 *    cột sc.ngay_quyet_toan — QUYẾT ĐỊNH THUỘC COORDINATOR, task này cấm
 *    thêm cột mới.
 *  - vattu_thieu   = tonKho(low_only,limit 10).lowCount + top-10 items.
 *  - hoat_dong_24h = thay 'chat_unread' (v5 không có bảng chat) — đếm
 *    activity_log 24h cuối, is_test=0.
 *  - dm_cho_duyet  = dmList(trang_thai='cho_duyet').total (đơn mua chờ duyệt).
 *  - BỎ: tk_cho_duyet/tk_dang_xu_ly (không có bảng khám), sc_hoan_hom_nay
 *    (không có ngay_nghiem trên sc — KPI không suy ra an toàn → TODO W3.1-reg).
 *
 * Quyền (chốt theo task — KHÔNG tự chế quyền mới):
 *  - v3.6: whitelist ['admin','giamdoc','quanly','xuong'] + chặn cứng 'ketoan'.
 *  - v5: perm.ts MATRIX không có module 'xuong' → cổng = api.perm.can(role,
 *    'sc','xem') + chặn cứng role 'ketoan' → {ok:false,error:'403'} (port hành
 *    vi). LỆCH CÓ CHỦ ĐỊCH: role 'kho' có sc.xem nên ĐƯỢC vào dashboard (v3.6
 *    không cho) — ghi chú cho W3.1-reg cân nhắc dùng module 'dashboard'.
 *  - 401 khi chưa đăng nhập (envelope, KHÔNG throw — quy ước hàm mới từ W1b).
 *
 * Cache (W3.2 — ĐÃ CÓ): lib/cache.ts tồn tại → dashboardAllCached bọc
 * dashboardAll key `dash:<role>:<YYYY-MM-DD>` TTL 60s, port v3.6 xuong.js dòng
 * 296–305 (v3.6 `dash:all:<role>` — v5 thêm NGÀY vào key để nửa đêm UTC chốt
 * số tự nhiên, không phụ thuộc vòng refresh). Single-flight in-process: N
 * request đồng thời cùng role chỉ bắn DB 1 lần. Invalidate: invalidateDashCache()
 * (clearPrefix 'dash:') — chưa hook vào các fn ghi (xem TODO cuối file).
 * In-process ⇒ multi-instance lệch ≤60s giữa các tiến trình (Redis TODO —
 * xem header lib/cache.ts).
 *
 * Hiệu năng (chuẩn 3b — chống N+1): v3.6 loop từng bks query sc_congviec/users;
 * v5 đọc Kanban bằng 2 batch query (SC-active JOIN xe + cv-stats GROUP BY) rồi
 * gộp trong RAM — output tương đương, số vòng DB không phụ thuộc số xe.
 *
 * RPC/UI/e2e: KHÔNG nằm trong task này (lib/rpc.ts thuộc worker-c) →
 * TODO(W3.1-reg): đăng ký fn 'dashboardAll' + meta quyền + UI /xuong + e2e.
 */

import type { Api } from '../types';
import { createScopedLogger } from '../observability';
import { cached, clearPrefix } from '../cache';
import { tonKho, dmList } from './kho';

const log = createScopedLogger('xuong');

/** enum sc.trang_thai THẬT (db/schema.sql CHECK) — đúng 5 cột kanban v5. */
const STATUSES = ['de_xuat', 'dang_sua', 'da_hoan', 'da_quyet', 'tu_choi'] as const;

/** Nhãn cột (ánh xạ COL_TT v3.6 dòng 154 — đổi 2 nhãn theo enum v5). */
const COL_TT: Record<string, string> = {
  de_xuat: 'Đề xuất',
  dang_sua: 'Đang sửa',
  da_hoan: 'Chờ nghiệm thu',
  da_quyet: 'Đã quyết toán',
  tu_choi: 'Từ chối',
};

/**
 * STATE_PRI port v3.6 dòng 157: ánh xạ cho_nghiem→da_hoan, da_duyet→da_quyet.
 * Bất biến giữ nguyên: trạng thái tiến độ cao hơn thắng khi 1 xe nhiều SC;
 * tu_choi bét bảng.
 */
const STATE_PRI: Record<string, number> = {
  dang_sua: 5, da_hoan: 4, da_quyet: 3, de_xuat: 2, tu_choi: 1,
};

/** Thứ tự dò cột "cao nhất" của 1 xe (v3.6 PRIORITY_ORDER, giảm dần theo PRI). */
const PRIORITY_ORDER: string[] = [...STATUSES].sort((a, b) => STATE_PRI[b] - STATE_PRI[a]);

/** Định dạng tiền v3.6 dòng 22–24 (port NGUYÊN — 'vi-VN' dùng dấu chấm). */
export function vnd(n: any): string {
  return String(Number(n || 0).toLocaleString('vi-VN')).replace(/,/g, '.') + ' đ';
}

/** Ngày hệ thống YYYY-MM-DD UTC — đồng nhất todayStr() lib/core/kho.ts. */
function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/** TTL dashboard — port v3.6 xuong.js dòng 301/304 (60000ms). */
const DASH_TTL_MS = 60_000;

/**
 * TEST-ONLY (W3.2): bộ đếm số lần THỰC THI loader `dashboardAll` (tăng ở DÒNG
 * ĐẦU hàm, trước mọi cổng quyền). Lý do không dùng jest.spyOn(module,
 * 'dashboardAll'): `dashboardAllCached` gọi binding cục bộ trong cùng module —
 * spy trên exports object KHÔNG chặn được lời gọi nội bộ (TS/CJS giữ nguyên
 * tham chiếu hàm). Bộ đếm cho test chứng minh "2 lời gọi cached → loader 1 lần".
 * Không đổi hành vi nghiệp vụ: chỉ đọc biến module-level.
 * TODO(W3.2-reg): cân nhắc DI `loader` qua tham số nếu cần sạch hơn production.
 */
let _dashAllCalls = 0;

/** TEST-ONLY — số lần dashboardAll được invoke từ đầu tiến trình (test file này). */
export function __dashAllCallCount(): number {
  return _dashAllCalls;
}

/** TEST-ONLY — đưa bộ đếm về 0 (gói trong beforeEach của xuong_cache.test.ts). */
export function __resetDashAllCallCount(): void {
  _dashAllCalls = 0;
}

/**
 * Một cửa sổ ngày UTC [today, today+24h) cho cột TIMESTAMPTZ — xác định dù
 * session TZ của PG là gì (`::timestamp AT TIME ZONE 'UTC'` neo UTC cứng).
 */
function utcDayParams(today: string): string[] {
  return [today + 'T00:00:00'];
}

export interface XuongKpi {
  xe: number;
  sc_cho_duyet: number;
  sc_dang_sua: number;
  sc_cho_nghiem: number;
  sc_quyet_hom_nay: number;
  /** chuỗi tiền theo định dạng v3.6 (vnd) */
  tien_quyet_hom_nay: string;
  vattu_thieu: number;
  /** top 10 vật tư thiếu nhiều nhất (port vattu_thieu list v3.6 — giới hạn 10 theo task) */
  vattu_thieu_items: any[];
  /** thay chat_unread v3.6 (v5 không có chat) */
  hoat_dong_24h: number;
  dm_cho_duyet: number;
}

export interface ScDetailCard {
  id: string;
  trang_thai: string;
  ngay_tao: string;
  tong: number;
  tong_vnd: string;
  tong_cong: number;
  tong_vt: number;
  so_cv: number;
  so_cv_hoan: number;
}

export interface KanbanCard {
  xe_id: string;
  bien_so: string;
  chu_xe: string;
  nam_sx: number | null;
  primary_state: string;
  sc_ids: string[];
  sc_count: number;
  tong_tien: number;
  tong_tien_vnd: string;
  /** đếm SC theo từng trạng thái (thay sc_dang_sua/sc_cho_nghiem/sc_cho_duyet v3.6) */
  state_counts: Record<string, number>;
  /** % hoàn thành theo SC "đỉnh" — công thức v3.6 dòng 196–198 */
  so_cv: number;
  so_cv_hoan: number;
  phan_tram: number;
  ngay_first: string;
  sc_details: ScDetailCard[];
  // TODO(W3.1-reg): tho_chinh — v5 sc_congviec KHÔNG có tho_id (v3.6 dòng 199).
  // TODO(W3.1-reg): eta — v5 sc KHÔNG có ngay_du_kien/deadline (v3.6 dòng 201–212).
}

/**
 * Bảng điều khiển xưởng — port v3.6 dashboardAll (dòng 119–294).
 * Envelope {ok,result}/{ok,error} theo quy ước hàm mới từ W1b (không throw).
 * @param _a unused — giữ chữ ký dispatch RPC (fn, args) của W3.1-reg.
 */
export async function dashboardAll(
  api: Api,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _a?: any
): Promise<{ ok: boolean; result?: { today: string; kpi: XuongKpi; kanban: { cols: { key: string; label: string; cards: KanbanCard[] }[]; vehicles: KanbanCard[] } }; error?: string }> {
  _dashAllCalls++; // TEST-ONLY counter (xem biến khai báo ở helper todayStr) — không đổi hành vi.
  const u = api.auth.current();
  if (!u) {
    log.logWarn('dashboardAll: unauthenticated access denied', {});
    return { ok: false, error: '401' };
  }
  // v3.6 chặn cứng kế toán (dòng 122–124) — port hành vi.
  if (u.role === 'ketoan') {
    log.logWarn('dashboardAll: ketoan denied (v3.6 parity block)', { actor: u.id });
    return { ok: false, error: '403' };
  }
  // Cổng ma trận v5: module 'xuong' không tồn tại → dùng 'sc.xem' (chốt theo
  // task). LỆCH v3.6 (whitelist khắt khe hơn): mọi role có sc.xem (gồm kho)
  // đều vào được — cân nhắc 'dashboard.xem' ở W3.1-reg.
  if (!(await api.perm.can(api.db, u.role, 'sc', 'xem'))) {
    log.logWarn('dashboardAll: sc.xem missing', { actor: u.id, role: u.role });
    return { ok: false, error: '403' };
  }

  const today = todayStr();

  try {
    // ── KPI đếm SC (1 aggregate query — thay 5 COUNT rời rạc v3.6 dòng 135–138)
    const scAggRes = await api.db.query(
      "SELECT COUNT(*) FILTER (WHERE trang_thai='de_xuat')::int  AS sc_cho_duyet, " +
      "       COUNT(*) FILTER (WHERE trang_thai='dang_sua')::int AS sc_dang_sua, " +
      "       COUNT(*) FILTER (WHERE trang_thai='da_hoan')::int  AS sc_cho_nghiem " +
      "FROM sc WHERE deleted_at='' AND is_test=0"
    );
    const xeAggRes = await api.db.query(
      "SELECT COUNT(*)::int AS n FROM xe WHERE deleted_at='' AND is_test=0"
    );
    // ── Quyết toán hôm nay: activity(sc_quyet_toan trong ngày UTC) JOIN sc
    //    da_quyet active. DISTINCT sc.id chống phình SUM khi 1 sc có nhiều dòng
    //    audit (retry/ghi-log lặp). v3.6: lich_sua.ngay=today (dòng 146–149).
    const quyet = utcDayParams(today);
    const quyetRes = await api.db.query(
      'SELECT COUNT(*)::int AS n, COALESCE(SUM(tong),0)::float8 AS tien FROM (' +
      '  SELECT DISTINCT s.id, s.tong' +
      '  FROM activity_log a JOIN sc s ON s.id = a.sc_id' +
      "  WHERE a.hanh_dong='sc_quyet_toan' AND a.is_test=0" +
      "    AND s.trang_thai='da_quyet' AND s.deleted_at='' AND s.is_test=0" +
      "    AND a.ts >= ($1::timestamp AT TIME ZONE 'UTC')" +
      "    AND a.ts <  ($1::timestamp AT TIME ZONE 'UTC') + INTERVAL '24 hours'" +
      ') d',
      quyet
    );
    // ── Hoạt động 24h (thay chat_unread — v5 không có chat)
    const actRes = await api.db.query(
      'SELECT COUNT(*)::int AS n FROM activity_log WHERE is_test=0 AND ts >= now() - INTERVAL \'24 hours\''
    );

    // ── Vật tư thiếu: import TRỰC TIẾP kho.ts (không HTTP). v3.6 dòng 143 đếm
    //    ton_min>0 AND ton<ton_min; v5 tonKho.lowCount đếm ton<ton_min trên mọi
    //    dòng active is_test=0 (lệch nhỏ: ton_min<=0 mà ton<0 — dòng bất biến,
    //    core kho đã chốt contract).
    const vtRes = await tonKho(api, { low_only: true, limit: 10 });
    const vattuThieu = vtRes.ok ? Number(vtRes.result?.lowCount ?? 0) : 0;
    const vattuItems: any[] = vtRes.ok ? (vtRes.result?.items ?? []) : [];
    if (!vtRes.ok) log.logWarn('dashboardAll: tonKho failed — KPI vattu fallback 0', { error: vtRes.error });

    // ── Đơn mua chờ duyệt (KPI mới theo task; import TRỰC TIẾP kho.ts)
    const dmRes = await dmList(api, { trang_thai: 'cho_duyet', limit: 1 });
    const dmChoDuyet = dmRes.ok ? Number(dmRes.total ?? 0) : 0;
    if (!dmRes.ok) log.logWarn('dashboardAll: dmList failed — KPI dm fallback 0', { error: dmRes.error });

    const kpi: XuongKpi = {
      xe: Number(xeAggRes.rows[0]?.n ?? 0),
      sc_cho_duyet: Number(scAggRes.rows[0]?.sc_cho_duyet ?? 0),
      sc_dang_sua: Number(scAggRes.rows[0]?.sc_dang_sua ?? 0),
      sc_cho_nghiem: Number(scAggRes.rows[0]?.sc_cho_nghiem ?? 0),
      sc_quyet_hom_nay: Number(quyetRes.rows[0]?.n ?? 0),
      tien_quyet_hom_nay: vnd(Number(quyetRes.rows[0]?.tien ?? 0)),
      vattu_thieu: vattuThieu,
      vattu_thieu_items: vattuItems,
      hoat_dong_24h: Number(actRes.rows[0]?.n ?? 0),
      dm_cho_duyet: dmChoDuyet,
    };

    // ══════════════════ KANBAN ══════════════════
    // Batch 1: toàn bộ SC active 5 trạng thái + thông tin xe LEFT JOIN
    // (xe soft-delete/is_test → SC vẫn lên board với bien_so '', như v3.6 cho
    //  bks không tra được xe). Thứ tự = sort gốc v3.6: ngay ASC, id ASC.
    const placeholders = STATUSES.map((_, i) => `$${i + 1}`).join(',');
    const scRes = await api.db.query(
      'SELECT s.id, s.xe_id, s.trang_thai, s.ngay_tao, s.tong, s.tong_cong, s.tong_vt, ' +
      '       COALESCE(x.bien_so,\'\') AS bien_so, COALESCE(x.chu_xe,\'\') AS chu_xe, x.nam_sx ' +
      'FROM sc s LEFT JOIN xe x ON x.id = s.xe_id AND x.deleted_at=\'\' AND x.is_test=0 ' +
      `WHERE s.deleted_at='' AND s.is_test=0 AND s.trang_thai IN (${placeholders}) ` +
      'ORDER BY s.ngay_tao ASC, s.id ASC',
      [...STATUSES]
    );

    // Batch 2: stats công việc theo SC (counter N+1 của v3.6 dòng 193–196 → 1
    // GROUP BY). v5 không có tt='huy' → chỉ filtro deleted_at (đã ghi header).
    const cvMap = new Map<string, { so_cv: number; so_cv_hoan: number }>();
    if (scRes.rows.length > 0) {
      const cvRes = await api.db.query(
        'SELECT sc_id, COUNT(*)::int AS so_cv, ' +
        "       COUNT(*) FILTER (WHERE tt='hoan')::int AS so_cv_hoan " +
        'FROM sc_congviec WHERE deleted_at=\'\' AND sc_id = ANY($1::text[]) GROUP BY sc_id',
        [scRes.rows.map((r: any) => r.id)]
      );
      for (const r of cvRes.rows as any[]) {
        cvMap.set(r.sc_id, { so_cv: Number(r.so_cv), so_cv_hoan: Number(r.so_cv_hoan) });
      }
    }
    const cvOf = (id: string) => cvMap.get(id) ?? { so_cv: 0, so_cv_hoan: 0 };

    // Gom theo xe_id (v3.6 gom theo bks — cùng semantics 1 xe 1 card).
    const byXe = new Map<string, any[]>();
    for (const p of scRes.rows as any[]) {
      const arr = byXe.get(p.xe_id);
      if (arr) arr.push(p);
      else byXe.set(p.xe_id, [p]);
    }

    const grouped: Record<string, KanbanCard[]> = {};
    for (const s of STATUSES) grouped[s] = [];

    for (const [xeId, scs] of byXe) {
      // Cột = trạng thái PRI cao nhất trong các SC của xe (v3.6 dòng 181–186).
      let primaryState: string = 'de_xuat';
      for (const st of PRIORITY_ORDER) {
        if (scs.some((p: any) => p.trang_thai === st)) { primaryState = st; break; }
      }

      const tongTien = scs.reduce((a: number, p: any) => a + (Number(p.tong) || 0), 0);
      const scIds: string[] = scs.map((p: any) => p.id);

      // % hoàn thành theo SC "đỉnh" (v3.6 dòng 191–198: topSC = SC đầu tiên
      // khớp primaryState trong danh sách đã sort ngay/id ASC).
      const topSC = scs.find((p: any) => p.trang_thai === primaryState) || scs[0];
      const cvTop = cvOf(topSC.id);
      const phanTram = cvTop.so_cv ? Math.round((cvTop.so_cv_hoan / cvTop.so_cv) * 100) : 0;

      const stateCounts: Record<string, number> = {};
      for (const st of STATUSES) {
        stateCounts[st] = scs.filter((p: any) => p.trang_thai === st).length;
      }

      const scDetails: ScDetailCard[] = (scs as any[]).map((p) => {
        const cv = cvOf(p.id);
        return {
          id: p.id,
          trang_thai: p.trang_thai,
          ngay_tao: p.ngay_tao,
          tong: Number(p.tong) || 0,
          tong_vnd: vnd(p.tong),
          tong_cong: Number(p.tong_cong) || 0,
          tong_vt: Number(p.tong_vt) || 0,
          so_cv: cv.so_cv,
          so_cv_hoan: cv.so_cv_hoan,
        };
      });

      const card: KanbanCard = {
        xe_id: xeId,
        bien_so: scs[0].bien_so ?? '',
        chu_xe: scs[0].chu_xe ?? '',
        nam_sx: scs[0].nam_sx != null ? Number(scs[0].nam_sx) : null,
        primary_state: primaryState,
        sc_ids: scIds,
        sc_count: scs.length,
        tong_tien: tongTien,
        tong_tien_vnd: vnd(tongTien),
        state_counts: stateCounts,
        so_cv: cvTop.so_cv,
        so_cv_hoan: cvTop.so_cv_hoan,
        phan_tram: phanTram,
        ngay_first: scs[0].ngay_tao,
        sc_details: scDetails,
      };
      grouped[primaryState].push(card);
    }

    // Sort trong cột: v3.6 sort ETA; v5 không có deadline → theo ngay đầu rồi
    // id SC đầu (đúng thứ tự gốc 'ngay ASC, id ASC' dòng 161, giữ ổn định).
    for (const s of STATUSES) {
      grouped[s].sort((a, b) =>
        a.ngay_first < b.ngay_first ? -1
          : a.ngay_first > b.ngay_first ? 1
          : a.sc_ids[0] < b.sc_ids[0] ? -1
          : a.sc_ids[0] > b.sc_ids[0] ? 1 : 0
      );
    }

    const cols = STATUSES.map((s) => ({ key: s, label: COL_TT[s], cards: grouped[s] }));
    // vehicles: danh sách gộp-flat (mỗi xe 1 dòng — view "1 dòng 1 xe" của
    // table), sort bien_so rồi id SC đầu để UI bảng ổn định.
    const vehicles = cols
      .flatMap((c) => c.cards)
      .sort((a, b) =>
        a.bien_so < b.bien_so ? -1
          : a.bien_so > b.bien_so ? 1
          : a.sc_ids[0] < b.sc_ids[0] ? -1 : 1
      );

    return { ok: true, result: { today, kpi, kanban: { cols, vehicles } } };
  } catch (e: any) {
    // Log truy vết + envelope lỗi chung (không lộ stack/SQL ra client).
    log.logError('dashboardAll: aggregate failed', e, { actor: u.id, today });
    return { ok: false, error: 'Lỗi bảng điều khiển xưởng' };
  }
}

// ══════════════════════ W3.2 — CACHE DASHBOARD ══════════════════════
// Port v3.6 xuong.js dòng 296–307 (`dashboardAll: dashboardAllCached` — module
// xuất hàm CÓ cache). v5: RPC đăng ký ở lib/rpc.ts THUỘC worker-c (W3.3A)
// ⇒ file này CHỈ export wrapper; coordinator sẽ dây-chuyển (wire) handler RPC
// sang dashboardAllCached khi cần. dashboardAll GỐC vẫn export không đổi cho
// test đối chuẩn dữ liệu (xuong_kanban.test.ts) và mọi caller đã import sẵn.

/**
 * dashboardAll có cache in-memory, port hành vi dashboardAllCached v3.6.
 *
 * Khóa `dash:<role>:<YYYY-MM-DD>`:
 *  - THEO ROLE → hết hạn cache không lộ chéo dữ liệu giữa các vai trò
 *    (ketoan nhận '403' gắn key của ketoan — an toàn vì key đã chứa role).
 *  - THEO NGÀY (v3.6 không có) → hết ca trực UTC tự lạnh, KPI 'hôm nay' không
 *    bị khóa xuyên ngày.
 *  - Anonymous → role '' → key `dash::ngày`, cache envelope '401' (vẫn đúng:
 *    chưa đăng nhập thì không có dữ liệu để lộ; login xong đổi key theo role).
 *
 * Giá trị cache là ENVELOPE nguyên khối ({ok,result}/{ok,error}) — 401/403 là
 * resolve bình thường nên CŨNG được cache trong 60s (đồng ý đồ v3.6; dashboard
 * là endpoint đọc, đổi ma trận quyền giữa 60s là sự kiện vận hành hiếm, và
 * invalidateDashCache() có sẵn cho luồng ghi/cấu hình gọi khi cần lạnh ngay).
 *
 * @param api  Ngữ cảnh RPC (auth/perm/db) — như dashboardAll.
 * @param args Giữ chữ ký dispatch (fn, args) — dashboardAll bỏ qua.
 */
export async function dashboardAllCached(
  api: Api,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  args?: any
): Promise<Awaited<ReturnType<typeof dashboardAll>>> {
  const role = api.auth.current()?.role ?? '';
  const key = `dash:${role}:${todayStr()}`;
  return cached(key, DASH_TTL_MS, () => dashboardAll(api, args));
}

/**
 * Dẹp TOÀN BỘ cache dashboard trong tiến trình (clearPrefix 'dash:').
 * Trả số key đã xóa (để log/monitor). Thiết kế invalidate: v3.6 gắn hook mọi
 * ghi nghiệp vụ (server/db.js dòng 18–31 `onWrite → cache.clearAll()`); v5 vì
 * ranh giới task W3.2 CẤM sửa file core khác nên chỉ EXPORT, chưa tự gọi:
 *   TODO(W3.2-wire, coordinator): gọi invalidateDashCache() ở CUỐI transaction
 *   ghi của các luồng làm đổi số liệu dashboard — ứng viên:
 *     • lib/core/sc.ts     : scCreate/scBatDauSua/scHoanThanh/scTuChoi/scQuyetToan
 *     • lib/core/kho.ts    : nhapKho/xuatKho/dmCreate/dmNhap/dmDecide/dmAutoBu/
 *                            autoGenCuHong/autoXuatSC
 *     • lib/core/asset.ts / ho_so.ts: nếu KPI liên quan (quyết toán/hồ sơ)
 *   Lưu ý quy ước namespace key khi các fn KHÁC cũng dùng lib/cache.ts:
 *   prefix 'dash:' dành cho dashboard xưởng — cache sc-list/asset... nên dùng
 *   prefix riêng ('sc-list:', 'asset:') để không bị quét chung ở đây.
 *   In-process ⇒ invalidate không lan sang instance khác (lệch ≤ TTL 60s —
 *   chấp nhận theo thiết kế v3.6; Redis pub/sub nếu cần tức thời đa tiến trình).
 */
export function invalidateDashCache(): number {
  return clearPrefix('dash:');
}

// TODO(W3.1-reg): (1) đăng ký fn 'dashboardAll' trong lib/rpc.ts + wire meta
//   quyền; (2) ✅ ĐÃ LÀM (W3.2): lib/cache.ts + dashboardAllCached +
//   invalidateDashCache ở khối trên — rpc.ts (worker-c W3.3A) đổi handler sang
//   dashboardAllCached khi coordinator cho phép, VÀ gọi invalidateDashCache()
//   trong các fn ghi theo TODO(W3.2-wire); (3) UI /xuong kanban 5 cột;
//   (4) e2e. KPI đã ghi chú thay thế trong header.
