'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useRpc } from '@/lib/use-rpc';
import { useRealtime } from '@/lib/use-realtime';

const TT: Array<[string, string]> = [
  ['de_xuat', 'Đề xuất'],
  ['da_duyet', 'Đã duyệt'],
  ['dang_sua', 'Đang sửa'],
  ['cho_nghiem', 'Chờ nghiệm'],
  ['da_hoan', 'Hoàn thành'],
  ['tu_choi', 'Từ chối'],
];
const TT_LABEL: Record<string, string> = Object.fromEntries(TT);

export default function ScListPage() {
  const [status, setStatus] = React.useState('');
  const [bks, setBks] = React.useState('');
  const router = useRouter();

  const q: Record<string, unknown> = {};
  if (status) q.trang_thai = status;
  if (bks) q.bks = bks;

  const { data, refetch } = useRpc('scList', q);
  useRealtime('sc', () => refetch());

  const rows: any[] = data || [];

  return (
    <div className="content" style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn sm" onClick={() => router.push('/sc/create')}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Tạo phiếu
        </button>
        <select
          className="px-3 py-2 border rounded-md text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          {TT.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <input
          className="px-3 py-2 border rounded-md text-sm"
          placeholder="Biển số..."
          value={bks}
          onChange={(e) => setBks(e.target.value)}
        />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Phiếu</th>
              <th>Xe</th>
              <th>Ngày</th>
              <th>Trạng thái</th>
              <th>Tiền</th>
              <th>CV/VT</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr
                key={r.id}
                className="sc-row"
                style={{ cursor: 'pointer' }}
                onClick={() => router.push('/sc/' + r.id)}
              >
                <td>{r.id}</td>
                <td>{r.bks}</td>
                <td>{r.ngay}</td>
                <td>
                  <span className="badge sm">{r.label}</span>
                </td>
                <td>{Number(r.tong || 0).toLocaleString('vi-VN')} ₫</td>
                <td>
                  {r.nCong}/{r.nVt}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 16, color: 'var(--c-ink-muted)' }}>
                  Không có phiếu.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
