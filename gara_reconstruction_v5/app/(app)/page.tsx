'use client';

/**
 * Dashboard (admin / giamdoc) — GĐ6 UI polish
 *
 * Port v4 apps/web/app/(app)/page.tsx (theme-dash KPI + quick actions)
 * + giữ activityFeed + scList từ v5 dashboard cũ.
 *
 * Layout:
 *  1) KPI row (6 cards) — useRPC dashboard → kpi object
 *  2) Quick actions — links nhanh theo role
 *  3) Hoạt động gần đây (activityFeed)
 *  4) Phiếu sửa chữa (scList)
 *
 * CSS: globals.css §theme-dash (.kpi, .quick, .kb-card, .progress)
 * Dark mode: token --c-primary/--c-bg/... tự switch qua .dark selector.
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCurrentUser, useApi } from '@/lib/hooks/useApi';
import type { Actor } from '@/lib/types';

/* ── Types ───────────────────────────────────────────── */

interface DashboardKpi {
  xe: number;
  sc_cho_duyet: number;
  sc_dang_sua: number;
  sc_cho_nghiem: number;
  sc_quyet_hom_nay: number;
  tien_quyet_hom_nay: string;
  vattu_thieu: number;
  hoat_dong_24h: number;
  dm_cho_duyet: number;
}

interface ActivityRow {
  id?: string;
  ts: string;
  actor_id?: string | null;
  actor_role?: string | null;
  hanh_dong: string;
  mo_ta?: string | null;
  sc_id?: string | null;
}

interface ScRow {
  id: string;
  xe_id: string;
  trang_thai: string;
  ngay_tao: string;
  nguoi_tao?: string | null;
  tong?: number | null;
}

/* ── Constants ───────────────────────────────────────── */

// role → redirect trang mặc định (non-dashboard roles)
const ROLE_TARGET: Record<string, string> = {
  kho: '/kho',
  xuong: '/sc',
  ketoan: '/baogia',
};

const STATUS_LABEL: Record<string, string> = {
  de_xuat: 'Đề xuất',
  dang_sua: 'Đang sửa',
  da_hoan: 'Đã hoàn',
  tu_choi: 'Từ chối',
  da_quyet: 'Đã quyết toán',
};

const STATUS_CHIP: Record<string, string> = {
  de_xuat: 'bg-amber-100 text-amber-800',
  dang_sua: 'bg-blue-100 text-blue-800',
  da_hoan: 'bg-green-100 text-green-800',
  tu_choi: 'bg-red-100 text-red-800',
  da_quyet: 'bg-purple-100 text-purple-800',
};

// Quick actions theo role
const QUICK_ACTIONS: Record<string, { label: string; href: string; icon: string }[]> = {
  admin: [
    { label: 'Phiếu sửa chữa', href: '/sc', icon: '📋' },
    { label: 'Bảng xe (Kanban)', href: '/sc/kanban', icon: '📊' },
    { label: 'Báo giá', href: '/baogia', icon: '💰' },
    { label: 'Kho vật tư', href: '/kho', icon: '🔧' },
    { label: 'Mua sắm', href: '/kho/dm', icon: '🛒' },
    { label: 'Hồ sơ', href: '/hoso', icon: '📁' },
  ],
  giamdoc: [
    { label: 'Phiếu sửa chữa', href: '/sc', icon: '📋' },
    { label: 'Bảng xe (Kanban)', href: '/sc/kanban', icon: '📊' },
    { label: 'Báo giá', href: '/baogia', icon: '💰' },
    { label: 'Kho vật tư', href: '/kho', icon: '🔧' },
    { label: 'Mua sắm', href: '/kho/dm', icon: '🛒' },
    { label: 'Hồ sơ', href: '/hoso', icon: '📁' },
  ],
};

const formatDate = (ts: string) => (!ts ? '—' : String(ts).slice(0, 19).replace('T', ' '));

/* ── Components ──────────────────────────────────────── */

function Spinner() {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
      <div className="flex items-center gap-3 rounded-lg bg-white px-6 py-4 shadow-lg">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
        <span className="text-sm text-slate-700">Đang tải…</span>
      </div>
    </div>
  );
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-slate-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-3 py-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" />
        </td>
      ))}
    </tr>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="kpi">
      <div className="v">{value}</div>
      <div className="s">{label}</div>
      {sub && <div className="s mt-1 opacity-70">{sub}</div>}
    </div>
  );
}

/* ── Page ────────────────────────────────────────────── */

export default function HomePage() {
  const router = useRouter();
  const api = useApi();
  const [user, setUser] = useState<Actor | null | undefined>(undefined);
  const [kpi, setKpi] = useState<DashboardKpi | null>(null);
  const [feed, setFeed] = useState<ActivityRow[]>([]);
  const [scList, setScList] = useState<ScRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErr(null);

    // 3 requests độc lập — allSettled để 1 bên lỗi không kéo batch
    const [dRes, fRes, sRes] = await Promise.allSettled([
      api.call('dashboard'),
      api.call('activityFeed', { limit: 20 }),
      api.call('scList'),
    ]);

    // Dashboard KPI (chỉ admin/giamdoc — server trả 403 cho role khác)
    if (dRes.status === 'fulfilled' && dRes.value.ok) {
      const data = dRes.value.result as { kpi?: DashboardKpi };
      setKpi(data?.kpi ?? null);
    }

    // Activity feed
    if (fRes.status === 'fulfilled' && fRes.value.ok) {
      setFeed((fRes.value.result as ActivityRow[]) ?? []);
    } else {
      setFeed([]);
      if (fRes.status === 'rejected' || !fRes.value?.ok) {
        setErr('Không tải được hoạt động gần đây');
      }
    }

    // SC list
    if (sRes.status === 'fulfilled' && sRes.value.ok) {
      setScList((sRes.value.result as ScRow[]) ?? []);
    }

    setLoading(false);
  }, [api]);

  useEffect(() => {
    let active = true;
    getCurrentUser().then((u) => {
      if (!active) return;
      if (!u) {
        router.replace('/login');
        return;
      }
      setUser(u);
      const target = ROLE_TARGET[u.role];
      if (target) {
        router.replace(target);
        return;
      }
      // giamdoc / admin: ở lại dashboard
      loadDashboard();
    });
    return () => { active = false; };
  }, [router, loadDashboard]);

  if (user === undefined || user === null) return <Spinner />;
  if (ROLE_TARGET[user.role]) return <Spinner />;

  const quickActions = QUICK_ACTIONS[user.role] ?? QUICK_ACTIONS.admin;

  return (
    <div className="view-anim">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--c-ink)' }}>
            Dashboard
          </h1>
          <p className="text-sm" style={{ color: 'var(--c-ink-muted)' }}>
            Xin chào, {user.name || user.role}
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadDashboard()}
          className="btn btn-ghost"
          disabled={loading}
        >
          {loading ? 'Đang tải…' : 'Làm mới'}
        </button>
      </div>

      {/* ── Error banner ──────────────────────────────── */}
      {err && (
        <div className="mb-4 rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: 'var(--c-warn)', background: 'var(--c-warn-bg)', color: 'var(--c-ink)' }}>
          {err}
        </div>
      )}

      {/* ── KPI Cards ─────────────────────────────────── */}
      {kpi && (
        <section className="mb-8">
          <div className="kpis">
            <KpiCard label="Xe trong hệ thống" value={kpi.xe} />
            <KpiCard label="Chờ duyệt" value={kpi.sc_cho_duyet} sub="Đề xuất / Đã duyệt" />
            <KpiCard label="Đang sửa" value={kpi.sc_dang_sua} />
            <KpiCard label="Chờ nghiệm thu" value={kpi.sc_cho_nghiem} />
            <KpiCard label="Quyết toán hôm nay" value={kpi.sc_quyet_hom_nay} sub={kpi.tien_quyet_hom_nay} />
            <KpiCard label="Hoạt động 24h" value={kpi.hoat_dong_24h} />
          </div>
        </section>
      )}

      {/* ── Quick Actions ─────────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold" style={{ color: 'var(--c-ink)' }}>
          Truy cập nhanh
        </h2>
        <div className="kpis">
          {quickActions.map((a) => (
            <Link key={a.href} href={a.href} className="quick">
              <span className="text-lg">{a.icon}</span>
              <span>{a.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Alert cards (vật tư thiếu / DM chờ duyệt) ── */}
      {kpi && (kpi.vattu_thieu > 0 || kpi.dm_cho_duyet > 0) && (
        <section className="mb-8 grid2">
          {kpi.vattu_thieu > 0 && (
            <Link href="/kho" className="card flex items-center gap-3 hover:shadow-md transition-shadow"
              style={{ borderLeft: '4px solid var(--c-warn)' }}>
              <span className="text-2xl">⚠️</span>
              <div>
                <div className="text-lg font-bold">{kpi.vattu_thieu}</div>
                <div className="text-sm" style={{ color: 'var(--c-ink-secondary)' }}>Vật tư dưới mức tồn</div>
              </div>
            </Link>
          )}
          {kpi.dm_cho_duyet > 0 && (
            <Link href="/kho/dm" className="card flex items-center gap-3 hover:shadow-md transition-shadow"
              style={{ borderLeft: '4px solid var(--c-primary)' }}>
              <span className="text-2xl">🛒</span>
              <div>
                <div className="text-lg font-bold">{kpi.dm_cho_duyet}</div>
                <div className="text-sm" style={{ color: 'var(--c-ink-secondary)' }}>Đơn mua chờ duyệt</div>
              </div>
            </Link>
          )}
        </section>
      )}

      {/* ── Hoạt động gần đây ────────────────────────── */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold" style={{ color: 'var(--c-ink)' }}>
          Hoạt động gần đây
        </h2>
        <div className="card" style={{ padding: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người</th>
                <th>Hành động</th>
                <th>Mô tả</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRow cols={4} />
              ) : feed.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center" style={{ color: 'var(--c-ink-muted)', padding: 'var(--sp-6)' }}>
                    Chưa có hoạt động.
                  </td>
                </tr>
              ) : (
                feed.map((a, i) => (
                  <tr key={(a.id ?? a.ts) + i}>
                    <td style={{ color: 'var(--c-ink-muted)' }}>{formatDate(a.ts)}</td>
                    <td>{a.actor_role || a.actor_id || '—'}</td>
                    <td>{a.hanh_dong}</td>
                    <td style={{ color: 'var(--c-ink-secondary)' }}>{a.mo_ta || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Phiếu sửa chữa ───────────────────────────── */}
      <section>
        <h2 className="mb-3 text-lg font-semibold" style={{ color: 'var(--c-ink)' }}>
          Phiếu sửa chữa
        </h2>
        <div className="card" style={{ padding: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Mã SC</th>
                <th>Xe</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th className="text-right">Tổng cộng</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRow cols={5} />
              ) : scList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center" style={{ color: 'var(--c-ink-muted)', padding: 'var(--sp-6)' }}>
                    Chưa có phiếu.
                  </td>
                </tr>
              ) : (
                scList.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono">{s.id}</td>
                    <td>{s.xe_id}</td>
                    <td>
                      <span
                        className={
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ' +
                          (STATUS_CHIP[s.trang_thai] ?? 'bg-slate-100 text-slate-800')
                        }
                      >
                        {STATUS_LABEL[s.trang_thai] ?? s.trang_thai}
                      </span>
                    </td>
                    <td style={{ color: 'var(--c-ink-muted)' }}>{formatDate(s.ngay_tao)}</td>
                    <td className="text-right font-medium">
                      {s.tong ? Number(s.tong).toLocaleString('vi-VN') + '₫' : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
