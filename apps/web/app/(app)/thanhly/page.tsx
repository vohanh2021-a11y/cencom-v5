'use client';

import * as React from 'react';
import { useRpc, rpc } from '@/lib/use-rpc';
import { useRealtime } from '@/lib/use-realtime';
import { useSession } from '@/components/SessionContext';

type Row = Record<string, unknown>;

export default function ThanhLyPage() {
  const { perms } = useSession();
  const canXem = !!perms?.['kho']?.includes('xem');
  const [scFilter, setScFilter] = React.useState('');

  const q: Record<string, unknown> = {};
  if (scFilter.trim()) q.sc_id = scFilter.trim();

  const { data, loading, refetch } = useRpc<Row[]>('thanhLyList', [q]);
  useRealtime('phieu_nhap_thanhly', () => refetch());

  if (!canXem) {
    return <div className="p-6 text-center text-gray-500">Bạn không có quyền xem Thanh lý.</div>;
  }

  const rows: Row[] = data || [];
  const cols: string[] =
    rows.length > 0
      ? Array.from(rows.reduce<Set<string>>((s, r) => {
          Object.keys(r).forEach((k) => s.add(k));
          return s;
        }, new Set<string>()))
      : [];

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Thanh lý vật tư cũ / hỏng</h2>

      <div className="flex gap-2 items-end bg-white/60 p-3 rounded-lg border border-black/5">
        <label className="text-sm">Lọc theo SC ID
          <input className="input" value={scFilter} onChange={(e) => setScFilter(e.target.value)} placeholder="SC-000001" />
        </label>
      </div>

      <div className="card">
        {loading ? (
          <p className="text-sm text-gray-500">Đang tải…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">Chưa có vật tư thanh lý nào.</p>
        ) : (
          <div className="overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    {cols.map((c) => (
                      <td key={c} className="font-mono text-xs">
                        {r[c] === null || r[c] === undefined || r[c] === ''
                          ? '—'
                          : String(r[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
