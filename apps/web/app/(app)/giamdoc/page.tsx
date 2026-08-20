'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useRpc } from '@/lib/use-rpc';

/* Dashboard quan sát dành cho Giám đốc (view-only).
 * Dùng RPC dashboardAll (KPI toàn xưởng, role giamdoc được phép) + xem nhanh
 * activity feed gần nhất. Không có nút tạo/sửa — chỉ quan sát. */

export default function GiamDocDashboardPage() {
  const router = useRouter();
  const { data, loading, error, refetch } = useRpc<any>('dashboardAll');
  const { data: feed } = useRpc<any[]>('activityFeed', { limit: 6 });

  const d = data || {};
  const kpi = d.kpi || {};
  const kpis = [
    { label: 'Tổng xe', value: kpi.xe ?? 0 },
    { label: 'SC đang sửa', value: kpi.sc_dang_sua ?? 0 },
    { label: 'SC chờ nghiệm', value: kpi.sc_cho_nghiem ?? 0 },
    { label: 'SC chờ duyệt', value: kpi.sc_cho_duyet ?? 0 },
    { label: 'Đề xuất chờ duyệt', value: kpi.dx_cho_duyet ?? 0 },
    { label: 'Hoàn hôm nay', value: kpi.sc_hoan_hom_nay ?? 0 },
    { label: 'Tiền quyết hôm nay', value: (kpi.tien_quyet_hom_nay ?? 0).toLocaleString('vi-VN') + ' ₫' },
  ];

  return (
    <div className="page">
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="text-xl font-semibold mt-1">Dashboard Giám đốc — Quan sát toàn xưởng</h1>
        <button className="btn sm" onClick={() => refetch()}>Làm mới</button>
      </div>

      {error ? (
        <div className="card" style={{ padding: 16, borderColor: '#E74C3C', marginTop: 12 }}>
          Không có quyền xem (hoặc lỗi: {error}).
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        {kpis.map((k, i) => (
          <div key={i} className="card">
            <div className="muted text-xs">{k.label}</div>
            <div className="text-2xl font-bold">{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="card">
          <div className="card-h">Hoạt động gần đây</div>
          <div className="card-b">
            {loading ? (
              <div className="muted text-sm">Đang tải…</div>
            ) : (feed || []).length === 0 ? (
              <div className="muted text-sm">Chưa có hoạt động.</div>
            ) : (
                <table className="tbl">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Vai</th>
                    <th>Hành động</th>
                    <th>SC</th>
                  </tr>
                </thead>
                <tbody>
                  {(feed || []).map((a: any) => (
                    <tr key={a.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{String(a.ts || '').slice(0, 19).replace('T', ' ')}</td>
                      <td>{a.actor_role}</td>
                      <td>{a.hanh_dong}</td>
                      <td>{a.sc_id || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-h">Truy cập nhanh</div>
          <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn" onClick={() => router.push('/giamdoc/feed')}>📋 Xem activity feed toàn bộ</button>
            <button className="btn" onClick={() => router.push('/report')}>📊 Báo cáo tổng hợp</button>
            <button className="btn" onClick={() => router.push('/dashboard')}>🏠 Bảng điều khiển xưởng</button>
          </div>
        </div>
      </div>
    </div>
  );
}
