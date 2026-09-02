'use client';

/**
 * NotificationCenter.tsx — port từ apps/web/components/NotificationCenter.tsx (v4).
 *
 * ADAPTATION v4 → v5 (gara_reconstruction_v5):
 *  1. v4: Shell.tsx giữ state (notifOpen/badge/data) + Topbar render nút chuông;
 *     panel là component trình diễn thuần nhận props {open, onClose, data}.
 *     v5: layout app/(app)/layout.tsx là SERVER component → component TỰ CHỦ
 *     (nút chuông + badge + panel dropdown trong cùng một default export,
 *     render <NotificationCenter /> không props).
 *  2. Nguồn số liệu: v5 CHƯA port RPC 'welcomeData' → dùng 'dashboardAll'
 *     (lib/rpc.ts meta ['sc','xem'], dispatch xuong.dashboardAllCached — cache
 *     60s chống spam). Map KPI → stats: sc_cho_duyet→scChoDuyet,
 *     sc_dang_sua→scDang, sc_cho_nghiem→scChoNghiem, dm_cho_duyet→dmChoDuyet,
 *     vattu_thieu→lowTon. BỎ 2 dòng 'Đề xuất chờ duyệt' + 'Chat chưa đọc' —
 *     module de-xuat/chat KHÔNG tồn tại ở v5 (xuong.ts:267 ghi rõ
 *     "v5 không có chat"). ketoan bị core chặn dashboardAll (403 envelope
 *     ok:false) → panel hiện toàn 0, không crash (fail-closed).
 *  3. Realtime: KHÔNG import @/lib/hooks/useRealtime dù hook CÓ tồn tại — nó
 *     import '@/lib/realtime' → 'pg' → transitive vào bundle trình duyệt →
 *     Next fail-to-compile 'fs' → 500 TOÀN APP (sự cố W1.7, ghi cấm tại
 *     app/(app)/kho/page.tsx:63-70). Thay bằng EventSource inline cùng mẫu
 *     trang kho: kênh là chuỗi khớp giá trị REALTIME_CHANNELS, ack
 *     {type:'connected'} bị bỏ qua, data-frame có {table} → reload debounce
 *     400ms, backoff tối đa 5 lần (mirror useRealtime).
 *  4. Style: v5 globals.css không có '.notif-panel'/'.notif-badge' → container
 *     bằng Tailwind arbitrary dùng token --c-surface/--c-line (tồn tại trong
 *     globals.css, support dark mode qua .dark); giữ nguyên inline style +
 *     token --c-ink/--c-ink-muted của source cho header/list.
 *  5. greet/viDate: v4 lấy từ server (welcomeData); v5 suy từ đồng hồ máy
 *     khách bằng Intl 'vi-VN' (thuần trình diễn — không có logic nghiệp vụ).
 *
 * href giữ nguyên hợp đồng điều hướng v4 (/sc?trang_thai=…, /kho?tab=dm);
 * GHI NHẬN: trang /sc, /kho v5 hiện chưa tiêu thụ searchParams (như note
 * GlobalSearch.tsx:20-22) → click đưa về danh sách, chưa pre-lọc.
 *
 * Escape render: chỉ React text node — KHÔNG dangerouslySetInnerHTML.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';

export interface NotifData {
  stats?: Record<string, number>;
  greet?: string;
  viDate?: { thu: string; ngay: string; gio: string };
}

type Item = { label: string; n: number; href: string };

/**
 * Kênh SSE — chuỗi PHẢI khớp giá trị REALTIME_CHANNELS trong lib/realtime.ts
 * (sc='sc_changes', vattu='vattu_changes', kho='sc_vattu_changes',
 * nhap_xuat='nhap_xuat_changes'). Lý do không import: xem header mục 3.
 */
const NOTIF_RT_QUERY = 'sc_changes,vattu_changes,sc_vattu_changes,nhap_xuat_changes';

interface DashKpi {
  sc_cho_duyet?: number;
  sc_dang_sua?: number;
  sc_cho_nghiem?: number;
  dm_cho_duyet?: number;
  vattu_thieu?: number;
}

/**
 * Gọi RPC ngoài useApi (mirror callRpc app/(app)/kho/page.tsx:90 — không
 * dính api.loading của hook trang). Envelope 2 tầng W1b+: route bọc
 * {ok,result}, core tự bọc {ok,result:{today,kpi}} → KPI nằm ở
 * result.result.kpi; phòng hờ registry trả 1 tầng. Lỗi 401/403/network →
 * null (im lặng, badge 0 — đúng hành vi catch(() => {}) của v4 Shell).
 */
async function fetchKpi(): Promise<DashKpi | null> {
  try {
    const res = await fetch('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fn: 'dashboardAll', args: [] }),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; result?: { ok?: boolean; result?: { kpi?: DashKpi }; kpi?: DashKpi } }
      | null;
    if (!data || data.ok !== true || !data.result) return null;
    const core = data.result;
    const payload = core.result ?? core;
    return payload.kpi ?? null;
  } catch {
    return null;
  }
}

/** Lắp NotifData (stats + greet + viDate) từ KPI — không có dữ liệu → null. */
function buildNotifData(kpi: DashKpi | null): NotifData | null {
  if (!kpi) return null;
  const now = new Date();
  const h = now.getHours();
  const greet =
    h < 11 ? 'Chào buổi sáng' : h < 14 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  const thu = new Intl.DateTimeFormat('vi-VN', { weekday: 'long' }).format(now);
  const ngay = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(now);
  const gio = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(now);
  return {
    stats: {
      scChoDuyet: Number(kpi.sc_cho_duyet ?? 0),
      scDang: Number(kpi.sc_dang_sua ?? 0),
      scChoNghiem: Number(kpi.sc_cho_nghiem ?? 0),
      dmChoDuyet: Number(kpi.dm_cho_duyet ?? 0),
      lowTon: Number(kpi.vattu_thieu ?? 0),
    },
    greet,
    viDate: { thu, ngay, gio },
  };
}

export default function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<NotifData | null>(null);
  const boxRef = React.useRef<HTMLDivElement | null>(null);

  // Nạp KPI lúc mount + mỗi lần SSE báo thay đổi (debounce 400ms — gộp
  // nhiều notification của 1 giao dịch, mirror app/(app)/kho/page.tsx:1823).
  // Guard `active`: không setState sau unmount; await đủ trong fetchKpi.
  React.useEffect(() => {
    let active = true;
    const load = async () => {
      const kpi = await fetchKpi();
      if (active) setData(buildNotifData(kpi));
    };
    void load();

    let es: EventSource | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    let closed = false;
    const connect = () => {
      if (closed) return;
      try {
        es = new EventSource(`/api/realtime?channels=${NOTIF_RT_QUERY}`);
      } catch {
        return;
      }
      es.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg?.type === 'connected') return; // ack mở stream — không reload
          if (!msg?.table) return; // chỉ data-frame mang tên bảng kích hoạt
        } catch {
          return;
        }
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => void load(), 400);
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
      active = false;
      closed = true;
      if (debounce) clearTimeout(debounce);
      if (timer) clearTimeout(timer);
      es?.close();
    };
  }, []);

  // Đóng khi click ngoài / Escape (mirror GlobalSearch.tsx:126-133).
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const d = data || {};
  const stats = d.stats || {};
  const items: Item[] = [
    { label: 'Phiếu sửa chữa chờ duyệt', n: stats.scChoDuyet || 0, href: '/sc?trang_thai=cho_duyet' },
    { label: 'Đang sửa / chờ nghiệm', n: (stats.scDang || 0) + (stats.scChoNghiem || 0), href: '/sc?trang_thai=dang_sua' },
    { label: 'Đề nghị mua chờ duyệt', n: stats.dmChoDuyet || 0, href: '/kho?tab=dm' },
    { label: 'Vật tư tồn thấp', n: stats.lowTon || 0, href: '/kho' },
  ];
  // Badge — công thức v4 Shell.tsx:60-65 bỏ 2 thành phần module không tồn tại.
  const badge =
    (stats.scChoDuyet || 0) + (stats.dmChoDuyet || 0) + (stats.lowTon || 0);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        style={{ position: 'relative' }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Thông báo"
        title="Thông báo"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {badge > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 999,
              background: '#E0332E',
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              lineHeight: '16px',
            }}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Thông báo"
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            marginTop: 6,
            width: 340,
            maxHeight: '70vh',
            overflow: 'auto',
            background: 'var(--c-surface)',
            border: '1px solid var(--c-line)',
            borderRadius: 14,
            boxShadow: '0 20px 60px rgba(0,0,0,.25)',
            zIndex: 120,
            padding: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px' }}>
            <strong style={{ fontSize: 13, color: 'var(--c-ink)' }}>Thông báo</strong>
            <button
              onClick={() => setOpen(false)}
              aria-label="Đóng"
              style={{ border: 'none', background: 'transparent', fontSize: 16, cursor: 'pointer', color: 'var(--c-ink-muted)' }}
            >
              ✕
            </button>
          </div>
          {d.greet && (
            <div style={{ fontSize: 12, color: 'var(--c-ink-muted)', padding: '0 8px 6px' }}>
              {d.greet}
              {d.viDate ? ` • ${d.viDate.thu}, ${d.viDate.ngay}` : ''}
            </div>
          )}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map((it) => (
              <li key={it.label} style={{ borderTop: '1px solid var(--c-line)' }}>
                <button
                  onClick={() => go(it.href)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: 8,
                    border: 'none',
                    background: 'transparent',
                    cursor: it.n > 0 ? 'pointer' : 'default',
                    fontSize: 13,
                    textAlign: 'left',
                    color: 'var(--c-ink)',
                  }}
                >
                  <span>{it.label}</span>
                  <span style={{ fontWeight: 800, color: it.n > 0 ? '#E0332E' : 'var(--c-ink-muted)' }}>{it.n}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
