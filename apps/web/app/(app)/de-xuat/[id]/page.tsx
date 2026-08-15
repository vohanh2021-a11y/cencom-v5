'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useRealtime } from '@/lib/use-realtime';

interface DeXuatDetail {
  id: string;
  bks: string;
  lydo: string;
  trang_thai: string;
  muc_uu_tien: string;
  ngay_tao: string;
}

const STATUS_LABELS: Record<string, string> = {
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
  tu_choi: 'Từ chối',
  da_chuyen_sc: 'Đã chuyển SC',
};

export default function DeXuatDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [dx, setDx] = useState<DeXuatDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fn: 'deXuatGet', args: [id] }),
    });
    const data = await res.json();
    if (data.ok) setDx(data.result as DeXuatDetail);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useRealtime('de_xuat_sua_chua', () => load());

  async function doAction(fn: string, extra: unknown[] = []) {
    setActionLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fn, args: [id, ...extra] }),
      });
      const data = await res.json();
      setMessage(data.ok ? 'Thành công' : (data.error || 'Thất bại'));
      if (data.ok) load();
    } catch {
      setMessage('Lỗi kết nối');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <div className="p-6 text-center text-gray-500">Đang tải...</div>;
  if (!dx) return <div className="p-6 text-center text-red-500">Không tìm thấy</div>;

  return (
    <div className="p-6 max-w-2xl">
      <Link href="/de-xuat" className="text-blue-600 text-sm hover:underline">← Quay lại</Link>
      <div className="flex justify-between items-start mt-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{dx.id}</h1>
          <p className="text-gray-600">{dx.bks} — {dx.lydo}</p>
        </div>
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm">
          {STATUS_LABELS[dx.trang_thai] || dx.trang_thai}
        </span>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {dx.trang_thai === 'cho_duyet' && (
          <>
            <button onClick={() => doAction('deXuatApprove', [true])} disabled={actionLoading}
              className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
              Duyệt
            </button>
            <button onClick={() => doAction('deXuatApprove', [false])} disabled={actionLoading}
              className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
              Từ chối
            </button>
          </>
        )}
        {dx.trang_thai === 'da_duyet' && (
          <button onClick={() => doAction('deXuatToSC')} disabled={actionLoading}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            Chuyển thành phiếu sửa chữa
          </button>
        )}
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded ${message === 'Thành công' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded shadow p-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Mức ưu tiên:</span> {dx.muc_uu_tien}</div>
          <div><span className="text-gray-500">Ngày tạo:</span> {dx.ngay_tao}</div>
        </div>
      </div>
    </div>
  );
}
