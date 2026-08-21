'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, useApi } from '@/lib/hooks/useApi';
import type { Actor } from '@/lib/types';

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

// role -> trang mặt định khi không phải giám đốc/admin
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

const formatDate = (ts: string) => (!ts ? '—' : String(ts).slice(0, 19).replace('T', ' '));

function Spinner() {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
      <div className="rounded bg-white px-6 py-4 shadow text-slate-700">Đang tải…</div>
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

export default function HomePage() {
  const router = useRouter();
  const api = useApi();
  const [user, setUser] = useState<Actor | null | undefined>(undefined);
  const [feed, setFeed] = useState<ActivityRow[]>([]);
  const [scList, setScList] = useState<ScRow[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [loadingSc, setLoadingSc] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoadingFeed(true);
    setLoadingSc(true);
    setErr(null);
    // Hai tác vụ độc lập — dùng allSettled để một bên lỗi không kéo theo batch.
    const [fRes, sRes] = await Promise.allSettled([
      api.call('activityFeed', { limit: 20 }),
      api.call('scList'),
    ]);
    if (fRes.status === 'fulfilled' && fRes.value.ok) {
      setFeed((fRes.value.result as ActivityRow[]) ?? []);
    } else {
      setFeed([]);
      setErr('Không tải được hoạt động gần đây');
    }
    if (sRes.status === 'fulfilled' && sRes.value.ok) {
      setScList((sRes.value.result as ScRow[]) ?? []);
    } else {
      setScList([]);
    }
    setLoadingFeed(false);
    setLoadingSc(false);
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
      // giamdoc / admin: ở lại và hiển thị dashboard chung.
      loadDashboard();
    });
    return () => {
      active = false;
    };
  }, [router, loadDashboard]);

  if (user === undefined || user === null) return <Spinner />;
  // Role đang được redirect → chờ chuyển hướng, không vẽ dashboard.
  if (ROLE_TARGET[user.role]) return <Spinner />;

  return (
    <div className="min-h-[50vh]">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <button
          type="button"
          onClick={() => loadDashboard()}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          Làm mới
        </button>
      </div>

      {err && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {err}
        </div>
      )}

      {/* Hoạt động gần đây */}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Hoạt động gần đây</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left font-semibold">
                <th className="px-3 py-2">Thời gian</th>
                <th className="px-3 py-2">Người</th>
                <th className="px-3 py-2">Hành động</th>
                <th className="px-3 py-2">Mô tả</th>
              </tr>
            </thead>
            <tbody>
              {loadingFeed ? (
                <SkeletonRow cols={4} />
              ) : feed.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-center text-slate-400">
                    Chưa có hoạt động.
                  </td>
                </tr>
              ) : (
                feed.map((a, i) => (
                  <tr key={(a.id ?? a.ts) + i} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 text-slate-500">{formatDate(a.ts)}</td>
                    <td className="px-3 py-2">{a.actor_role || a.actor_id || '—'}</td>
                    <td className="px-3 py-2">{a.hanh_dong}</td>
                    <td className="px-3 py-2 text-slate-600">{a.mo_ta || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Phiếu sửa chữa */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">Phiếu sửa chữa</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left font-semibold">
                <th className="px-3 py-2">Mã SC</th>
                <th className="px-3 py-2">Xe</th>
                <th className="px-3 py-2">Trạng thái</th>
                <th className="px-3 py-2">Ngày tạo</th>
                <th className="px-3 py-2 text-right">Tổng cộng</th>
              </tr>
            </thead>
            <tbody>
              {loadingSc ? (
                <SkeletonRow cols={5} />
              ) : scList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-center text-slate-400">
                    Chưa có phiếu.
                  </td>
                </tr>
              ) : (
                scList.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-mono">{s.id}</td>
                    <td className="px-3 py-2">{s.xe_id}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          'inline-flex rounded px-2 py-0.5 text-xs font-medium ' +
                          STATUS_CHIP[s.trang_thai]
                        }
                      >
                        {STATUS_LABEL[s.trang_thai] ?? s.trang_thai}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{formatDate(s.ngay_tao)}</td>
                    <td className="px-3 py-2 text-right">
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
