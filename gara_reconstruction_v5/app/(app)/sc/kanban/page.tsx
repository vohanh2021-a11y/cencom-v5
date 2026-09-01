'use client';

/**
 * app/(app)/sc/kanban/page.tsx — W3.8: UI XƯỞNG trục ① — bảng kanban + KPI band.
 *
 * CONTRACT (đọc lib/core/xuong.ts dashboardAll — chỉ ĐỌC, không sửa lib/**):
 *   rpc 'dashboardAll' → envelope LỒNG 2 lớp vì core hàm mới (W1b+) không throw:
 *     HTTP 200 { ok:true, result: {ok:true, result:{today,kpi,kanban:{cols,vehicles}}} }
 *     HTTP 200 { ok:true, result: {ok:false, error:'403'} }   ← ketoan/core block
 *     HTTP 403 { ok:false, error:'Không đủ quyền' }            ← dispatch META gate
 *     HTTP 404 { ok:false, error:'Unknown fn: dashboardAll' }  ← W3.1-reg chưa xong
 *
 * 5 cột theo enum sc.trang_thai v5 THẬT (KHÔNG phải v3.6):
 *   de_xuat | dang_sua | da_hoan (chờ nghiệm thu) | da_quyet | tu_choi
 * Màu header cột theo thứ hạng STATE_PRI port (dang_sua 5 … tu_choi 1).
 *
 * KPI: xe, sc_cho_duyet, sc_dang_sua, sc_cho_nghiem, sc_quyet_hom_nay,
 * tien_quyet_hom_nay (chuỗi vnd từ core), vattu_thieu, dm_cho_duyet,
 * hoat_dong_24h — tone ĐỎ khi dm_cho_duyet / vattu_thieu > 0 (tín hiệu cần xử lý).
 *
 * KÉO-THẢ: KHÔNG làm ở W3.8 (view chỉ-đọc; thao tác SC đã có ở /sc).
 *   TODO(W sau): drag-drop → gọi scBatDauSua/scHoanThanh/scTuChoi theo cạnh cột.
 *
 * Realtime: pattern W1.7 của kho/page.tsx (EventSource + debounce 400ms,
 * reconnect backoff ≤5 lần). Channels hardcode ĐỒNG BỘ tên với
 * lib/realtime.ts REALTIME_CHANNELS (sc_changes, sc_vattu_changes,
 * activity_log_changes) — không import lib/realtime (kéo pg server-only
 * vào client bundle qua route → chỉ dùng chuỗi).
 *
 * Quyền: cổng thật ở server (sc.xem + chặn cứng ketoan trong core). UI chỉ
 * hiện fallback 'Không có quyền' khi nhận 403 (không tự suy diễn role).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, useApi } from '@/lib/hooks/useApi';
import type { Actor } from '@/lib/types';

/* ────────────────────────── types theo contract ────────────────────────── */

interface ScDetailCard {
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

interface KanbanCard {
  xe_id: string;
  bien_so: string;
  chu_xe: string;
  nam_sx: number | null;
  primary_state: string;
  sc_ids: string[];
  sc_count: number;
  tong_tien: number;
  tong_tien_vnd: string;
  state_counts: Record<string, number>;
  so_cv: number;
  so_cv_hoan: number;
  phan_tram: number;
  ngay_first: string;
  sc_details: ScDetailCard[];
}

interface XuongKpi {
  xe: number;
  sc_cho_duyet: number;
  sc_dang_sua: number;
  sc_cho_nghiem: number;
  sc_quyet_hom_nay: number;
  tien_quyet_hom_nay: string;
  vattu_thieu: number;
  vattu_thieu_items: any[];
  hoat_dong_24h: number;
  dm_cho_duyet: number;
}

interface DashResult {
  today: string;
  kpi: XuongKpi;
  kanban: { cols: { key: string; label: string; cards: KanbanCard[] }[]; vehicles: KanbanCard[] };
}

/** envelope lõi {ok,result}/{ok,error} lib/core/xuong.ts (HTTP vẫn 200). */
type CoreEnvelope = { ok: true; result: DashResult } | { ok: false; error: string };

/* ────────────────────────── hằng hiển thị ────────────────────────── */

/** Nhãn + màu TT SC — đồng bộ STATUS_CHIP/STATUS_LABEL trang /sc (v5 enum thật). */
const STATUS_LABEL: Record<string, string> = {
  de_xuat: 'Đề xuất',
  dang_sua: 'Đang sửa',
  da_hoan: 'Chờ nghiệm thu',
  da_quyet: 'Đã quyết toán',
  tu_choi: 'Từ chối',
};

const STATUS_CHIP: Record<string, string> = {
  de_xuat: 'bg-amber-100 text-amber-800',
  dang_sua: 'bg-blue-100 text-blue-800',
  da_hoan: 'bg-green-100 text-green-800',
  tu_choi: 'bg-red-100 text-red-800',
  da_quyet: 'bg-purple-100 text-purple-800',
};

/**
 * Màu header cột THEO THỨ HẠNG STATE_PRI port (xuong.ts dòng 94–96):
 *   dang_sua:5 → nổi bật nhất (đang tiến hành) · tu_choi:1 → mờ nhất.
 * Đây là ánh xạ hiển thị cục bộ — core xuất cols theo đúng thứ tự
 * STATUSES; trang này không tự đổi thứ tự cột.
 */
const COL_HEADER_COLOR: Record<string, string> = {
  dang_sua: 'bg-blue-600',
  da_hoan: 'bg-teal-600',
  da_quyet: 'bg-purple-600',
  de_xuat: 'bg-amber-500',
  tu_choi: 'bg-slate-400',
};

/** Số lần auto-retry khi 'Unknown fn' (cách 3s — đợi W3.1-reg đăng ký RPC). */
const ACTIVATING_MAX_RETRY = 5;
const ACTIVATING_RETRY_MS = 3000;

/** Đồng bộ lib/realtime.ts REALTIME_CHANNELS (sc/kho/activity) — xem header. */
const XUONG_RT_CHANNELS = 'sc_changes,sc_vattu_changes,activity_log_changes';

/** Định dạng tiền v3.6 (port vnd lib/core/xuong.ts dòng 102–104 — không
 *  import core để kéo server bundle (pg/observability) vào client). */
function vnd(n: number): string {
  return String(Number(n || 0).toLocaleString('vi-VN')).replace(/,/g, '.') + ' đ';
}

const todayShort = () => new Date().toISOString().slice(0, 10);

/* ────────────────────────── components phụ ────────────────────────── */

function Spinner() {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
      <div className="rounded bg-white px-6 py-4 shadow text-slate-700">Đang tải…</div>
    </div>
  );
}

function KpiCard({ label, value, danger, sub }: { label: string; value: string | number; danger?: boolean; sub?: string }) {
  return (
    <div
      data-testid="kanban-kpi"
      data-tone={danger ? 'danger' : 'normal'}
      className={
        'rounded-lg border p-3 ' +
        (danger
          ? 'border-red-300 bg-red-50 text-red-700'
          : 'border-slate-200 bg-white text-slate-800')
      }
    >
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}

function CardScChips({ card }: { card: KanbanCard }) {
  // Chip tt = trang_thai TỪNG SC của xe (1 xe nhiều SC — state_counts/
  // sc_details từ core; ScDetailCard không mang tt công việc → hiển cv đếm
  // được: so_cv_hoan/so_cv).
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {card.sc_details.map((d) => (
        <span
          key={d.id}
          data-testid="kanban-sc-chip"
          title={`${d.id} · ${d.tong_vnd} · CV ${d.so_cv_hoan}/${d.so_cv}`}
          className={
            'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ' +
            (STATUS_CHIP[d.trang_thai] ?? 'bg-slate-100 text-slate-700')
          }
        >
          <span className="font-mono">{d.id}</span>
          <span className="opacity-70">{STATUS_LABEL[d.trang_thai] ?? d.trang_thai}</span>
          <span className="rounded bg-white/70 px-1 tabular-nums">
            {d.so_cv > 0 ? `${d.so_cv_hoan}/${d.so_cv}` : '—'}
          </span>
        </span>
      ))}
    </div>
  );
}

function VehicleCard({ card }: { card: KanbanCard }) {
  const pct = Math.max(0, Math.min(100, Number(card.phan_tram) || 0));
  return (
    <div
      data-testid="kanban-card"
      data-xe-id={card.xe_id}
      className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-slate-800" data-testid="kanban-bien-so">
            {card.bien_so || '(xe không tra được BKS)'}
          </div>
          <div className="truncate text-[11px] text-slate-500">
            {card.chu_xe || '—'}
            {card.nam_sx ? ` · ${card.nam_sx}` : ''}
          </div>
        </div>
        {card.sc_count > 1 && (
          <span
            data-testid="kanban-sc-badge"
            className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700"
            title={`${card.sc_count} phiếu SC trên xe`}
          >
            {card.sc_count} SC
          </span>
        )}
      </div>

      {/* % hoàn thành theo SC "đỉnh" — công thức v3.6 (so_cv_hoan/so_cv) */}
      <div className="mt-2">
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>Tiến độ SC đỉnh</span>
          <span data-testid="kanban-pct" className="font-semibold tabular-nums">
            {pct}%
          </span>
        </div>
        <div
          className="mt-1 h-1.5 w-full rounded bg-slate-100"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-1.5 rounded bg-indigo-500"
            style={{ width: pct + '%' }}
          />
        </div>
      </div>

      <CardScChips card={card} />

      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 text-[11px]">
        <span className="text-slate-400">{String(card.ngay_first || '').slice(0, 10)}</span>
        <span className="font-medium text-slate-600">{card.tong_tien_vnd || vnd(card.tong_tien)}</span>
      </div>
    </div>
  );
}

/* ────────────────────────── page chính ────────────────────────── */

export default function KanbanPage() {
  const router = useRouter();
  const api = useApi();
  const [user, setUser] = useState<Actor | null | undefined>(undefined);
  const [data, setData] = useState<DashResult | null>(null);
  const [denied, setDenied] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activatingTrials, setActivatingTrials] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activatingTries = useRef(0); // đếm ngoài state-updater (StrictSafe)
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  const clearRetryTimer = () => {
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  };

  /**
   * Load 1 lần gọi RPC. Phân nhánh:
   *  - HTTP 404 / 'Unknown fn'  → 'đang kích hoạt' + tự thử lại 3s (W3.1-reg song song)
   *  - HTTP 403 hoặc lõi {ok:false,error:'403'} → màn 'Không có quyền' + retry tay
   *  - HTTP 401 → về /login
   *  - {ok:true} nhưng lõi lỗi khác → banner lỗi chung (không crash board cũ)
   */
  const load = useCallback(
    async (isRetryChain = false) => {
      if (!isRetryChain) setRefreshing(true);
      const r = await api.call('dashboardAll');
      if (!mounted.current) return;
      setRefreshing(false);

      if (r.ok) {
        const env = r.result as CoreEnvelope | undefined;
        if (env && env.ok === true && env.result) {
          clearRetryTimer();
          setActivating(false);
          activatingTries.current = 0;
          setActivatingTrials(0);
          setDenied(false);
          setErr(null);
          setData(env.result);
          return;
        }
        if (env && env.ok === false && env.error === '403') {
          // core chặn cứng (ketoan) — phân biệt với 'đang kích hoạt'
          clearRetryTimer();
          setActivating(false);
          setDenied(true);
          setData(null);
          return;
        }
        // lõi không khớp contract — hiển thị lỗi, giữ board nếu đang có
        setErr('Dữ liệu dashboard không hợp lệ');
        return;
      }

      // r.ok === false: lỗi tầng HTTP/dispatch
      if (r.status === 401) {
        router.replace('/login');
        return;
      }
      const msg = String(r.error ?? '');
      if (r.status === 403 || msg.includes('403') || msg.toLowerCase().includes('không đủ quyền')) {
        clearRetryTimer();
        setActivating(false);
        setDenied(true);
        setData(null);
        return;
      }
      if (r.status === 404 || msg.toLowerCase().includes('unknown fn')) {
        // fn chưa đăng ký (worker-c W3.1-reg đang chạy song song) → retry 3s
        setDenied(false);
        setActivating(true);
        activatingTries.current += 1;
        setActivatingTrials(activatingTries.current);
        if (activatingTries.current < ACTIVATING_MAX_RETRY) {
          clearRetryTimer();
          retryTimer.current = setTimeout(() => {
            if (mounted.current) void load(true);
          }, ACTIVATING_RETRY_MS);
        }
        return;
      }
      setActivating(false);
      setErr(msg || 'Không tải được dashboard xưởng');
    },
    [api, router]
  );

  useEffect(() => {
    let active = true;
    getCurrentUser().then((u) => {
      if (!active) return;
      setUser(u);
      if (!u) {
        router.replace('/login');
        return;
      }
      void load();
    });
    return () => {
      active = false;
    };
  }, [router, load]);

  // ── Realtime (SSE) — pattern W1.7 kho/page.tsx: data-frame → reload debounce
  // 400ms; reconnect backoff tối đa 5 lần. Kênh im lặng là hành vi chuẩn khi
  // DB chưa wire trigger (schema v5).
  const reloadRef = useRef<() => void>(() => {});
  reloadRef.current = () => {
    // KHÔNG spam khi fn chưa reg (nhánh activating tự retry) hoặc khi đã biết
    // 403 — SSE frame nền không được kéo người dùng quay lại vòng gọi vô ích.
    if (!activating && !denied) void load();
  };
  useEffect(() => {
    let es: EventSource | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let closed = false;
    const connect = () => {
      if (closed) return;
      try {
        es = new EventSource(`/api/realtime?channels=${XUONG_RT_CHANNELS}`);
      } catch {
        return;
      }
      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg?.type === 'connected') return; // ack — không reload
          if (!msg?.table) return; // chỉ data-frame có tên bảng
        } catch {
          return;
        }
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => reloadRef.current(), 400);
      };
      es.onerror = () => {
        es?.close();
        if (!closed && attempts < 5) {
          attempts += 1;
          timer = setTimeout(connect, 1000 * 2 ** (attempts - 1));
        }
      };
    };
    connect();
    return () => {
      closed = true;
      if (debounce) clearTimeout(debounce);
      if (timer) clearTimeout(timer);
      es?.close();
    };
  }, []);

  if (user === undefined || user === null) return <Spinner />;

  /* ── màn hình fallback ── */
  if (denied) {
    return (
      <div data-testid="kanban-denied" className="mx-auto mt-16 max-w-md rounded-lg border border-slate-200 bg-white p-6 text-center">
        {/* h1 chung mọi state — e2e goto() anchor ổn định không phụ thuộc reg */}
        <h1 className="text-lg font-semibold text-slate-800">Bảng xe xưởng — Không có quyền</h1>
        <p className="mt-2 text-sm text-slate-500">
          Tài khoản của bạn không được phép xem bảng điều khiển xưởng (cổng quyền: sc.xem — phán quyết ở server).
        </p>
        <button
          type="button"
          data-testid="kanban-retry"
          onClick={() => {
            setDenied(false);
            void load();
          }}
          className="mt-4 rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (activating && data === null) {
    const exhausted = activatingTrials >= ACTIVATING_MAX_RETRY;
    return (
      <div
        data-testid="kanban-activating"
        className="mx-auto mt-16 max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-center"
      >
        <h1 className="text-lg font-semibold text-amber-800">Bảng xe xưởng — Đang kích hoạt…</h1>
        <p className="mt-2 text-sm text-amber-700">
          Function <code className="rounded bg-amber-100 px-1">dashboardAll</code> chưa có trong registry RPC
          (hạng mục W3.1-reg đang được đăng ký song song).
          {exhausted
            ? ` Đã tự thử lại ${ACTIVATING_MAX_RETRY} lần (cách ${ACTIVATING_RETRY_MS / 1000}s).`
            : ` Đang tự thử lại mỗi ${ACTIVATING_RETRY_MS / 1000}s (lần ${activatingTrials}/${ACTIVATING_MAX_RETRY}).`}
        </p>
        {exhausted && (
          <button
            type="button"
            data-testid="kanban-retry"
            onClick={() => {
              activatingTries.current = 0;
              setActivatingTrials(0);
              void load();
            }}
            className="mt-4 rounded bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
          >
            Thử lại ngay
          </button>
        )}
      </div>
    );
  }

  /* ── board chính ── */
  const kpi = data?.kpi;
  const cols = data?.kanban.cols ?? [];
  const pctTotal = cols.reduce((a, c) => a + c.cards.length, 0);

  return (
    <div className="min-h-[50vh]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Bảng xe xưởng</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {todayShort()} · {pctTotal} xe đang có phiếu · chỉ-đọc (kéo-thả: hạng mục W sau)
          </p>
        </div>
        <button
          type="button"
          data-testid="kanban-refresh"
          onClick={() => void load()}
          disabled={api.loading || refreshing}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          {refreshing ? 'Đang tải…' : 'Làm mới'}
        </button>
      </div>

      {activating && data !== null && (
        <div data-testid="kanban-activating" className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          fn dashboardAll vừa tạm ẩn (đang kích hoạt lại) — hiển thị dữ liệu cũ.
        </div>
      )}
      {err && (
        <div data-testid="kanban-error" className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {err}
        </div>
      )}

      {/* KPI band — mỗi key 1 card; đỏ khi dm_cho_duyet / vattu_thieu > 0
          (tín hiệu nghiệp vụ: chờ duyệt mua / thiếu vật tư). */}
      <section data-testid="kanban-kpi-band" aria-label="Chỉ số xưởng" className="mb-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <KpiCard label="Xe hoạt động" value={kpi?.xe ?? 0} />
          <KpiCard label="SC chờ duyệt" value={kpi?.sc_cho_duyet ?? 0} sub="đề xuất" />
          <KpiCard label="SC đang sửa" value={kpi?.sc_dang_sua ?? 0} />
          <KpiCard label="SC chờ nghiệm thu" value={kpi?.sc_cho_nghiem ?? 0} sub="đã hoàn sửa" />
          <KpiCard label="Quyết toán hôm nay" value={kpi?.sc_quyet_hom_nay ?? 0} sub={kpi ? kpi.tien_quyet_hom_nay : '0 đ'} />
          <KpiCard label="Vật tư thiếu" value={kpi?.vattu_thieu ?? 0} danger={(kpi?.vattu_thieu ?? 0) > 0} />
          <KpiCard label="Đơn mua chờ duyệt" value={kpi?.dm_cho_duyet ?? 0} danger={(kpi?.dm_cho_duyet ?? 0) > 0} />
          <KpiCard label="Hoạt động 24h" value={kpi?.hoat_dong_24h ?? 0} />
        </div>
      </section>

      {/* Board 5 cột — grid responsive; thứ tự + nhãn do core sinh (enum v5). */}
      <section data-testid="kanban-board" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {cols.length === 0 ? (
          <div className="col-span-full rounded border border-slate-200 bg-white p-4 text-sm text-slate-500">
            Chưa tải được cột nào.
          </div>
        ) : (
          cols.map((col) => (
            <div key={col.key} data-testid="kanban-col" data-state={col.key} className="flex flex-col rounded-lg bg-slate-100/80">
              <div
                className={
                  'flex items-center justify-between rounded-t-lg px-3 py-2 text-sm font-semibold text-white ' +
                  (COL_HEADER_COLOR[col.key] ?? 'bg-slate-500')
                }
              >
                <span>{col.label || STATUS_LABEL[col.key] || col.key}</span>
                <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs tabular-nums">{col.cards.length}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-2">
                {col.cards.length === 0 ? (
                  <div className="rounded border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
                    Không có xe nào
                  </div>
                ) : (
                  col.cards.map((c) => <VehicleCard key={c.xe_id} card={c} />)
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
