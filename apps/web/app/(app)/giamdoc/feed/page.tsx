'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useRpc } from '@/lib/use-rpc';

/* Activity feed "theo dõi toàn bộ v5.0" — độc quyền Giám đốc / Admin.
 * View-only: chỉ xem, lọc theo sc_id + khoảng ngày. */

type FeedParams = {
  limit: number;
  sc_id?: string;
  tu_ngay?: string;
  den_ngay?: string;
};

export default function GiamDocFeedPage() {
  const router = useRouter();
  const [scId, setScId] = React.useState('');
  const [tuNgay, setTuNgay] = React.useState('');
  const [denNgay, setDenNgay] = React.useState('');
  const [params, setParams] = React.useState<FeedParams>({ limit: 50 });

  const { data, loading, error, refetch } = useRpc<any[]>('activityFeed', params);

  React.useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  function applyFilter() {
    setParams({
      limit: 50,
      sc_id: scId.trim() || undefined,
      tu_ngay: tuNgay.trim() || undefined,
      den_ngay: denNgay.trim() || undefined,
    });
  }

  function resetFilter() {
    setScId('');
    setTuNgay('');
    setDenNgay('');
    setParams({ limit: 50 });
  }

  return (
    <div className="page">
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="text-xl font-semibold mt-1">Activity Feed — Theo dõi toàn bộ (v5.0)</h1>
        <button className="btn sm" onClick={() => router.push('/giamdoc')}>← Dashboard</button>
      </div>

      <div className="card mt-4">
        <div className="card-b" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <label className="muted text-xs" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            SC ID
            <input
              className="input"
              placeholder="VD: SC-000123"
              value={scId}
              onChange={(e) => setScId(e.target.value)}
              style={{ width: 160 }}
            />
          </label>
          <label className="muted text-xs" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            Từ ngày
            <input
              className="input"
              type="date"
              value={tuNgay}
              onChange={(e) => setTuNgay(e.target.value)}
            />
          </label>
          <label className="muted text-xs" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            Đến ngày
            <input
              className="input"
              type="date"
              value={denNgay}
              onChange={(e) => setDenNgay(e.target.value)}
            />
          </label>
          <button className="btn" onClick={applyFilter}>Lọc</button>
          <button className="btn sm" onClick={resetFilter}>Xóa lọc</button>
        </div>
      </div>

      {error ? (
        <div className="card mt-4" style={{ padding: 16, borderColor: '#E74C3C' }}>
          Lỗi: {error}
        </div>
      ) : null}

      <div className="card mt-4">
        <div className="card-h">Dòng thời gian hoạt động</div>
        <div className="card-b">
          {loading ? (
            <div className="muted text-sm">Đang tải…</div>
          ) : (data || []).length === 0 ? (
            <div className="muted text-sm">Không có hoạt động nào phù hợp.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Thời gian</th>
                    <th>Vai</th>
                    <th>Hành động</th>
                    <th>Đối tượng</th>
                    <th>SC</th>
                    <th>Mô tả</th>
                  </tr>
                </thead>
                <tbody>
                  {(data || []).map((a: any) => (
                    <tr key={a.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{String(a.ts || '').slice(0, 19).replace('T', ' ')}</td>
                      <td>{a.actor_role || '—'}</td>
                      <td>{a.hanh_dong || '—'}</td>
                      <td>{a.doi_tuong || '—'}</td>
                      <td>{a.sc_id || '—'}</td>
                      <td>{a.mo_ta || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
