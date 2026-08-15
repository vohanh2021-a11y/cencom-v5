'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const PRIORITIES = [
  { value: 'thap', label: 'Thấp' },
  { value: 'binh_thuong', label: 'Bình thường' },
  { value: 'cao', label: 'Cao' },
  { value: 'khan_cap', label: 'Khẩn cấp' },
];

export default function DeXuatCreatePage() {
  const router = useRouter();
  const [bks, setBks] = useState('');
  const [lydo, setLydo] = useState('');
  const [uuTien, setUuTien] = useState('binh_thuong');
  const [ghiChu, setGhiChu] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fn: 'deXuatCreate',
          args: [{
            bks,
            lydo,
            muc_uu_tien: uuTien,
            ghi_chu: ghiChu || undefined,
          }],
        }),
      });
      const data = await res.json();

      if (!data.ok) {
        setError(data.error || 'Tạo đề xuất thất bại');
        setLoading(false);
        return;
      }

      router.push(`/de-xuat/${data.result.id}`);
    } catch {
      setError('Lỗi kết nối server');
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Tạo đề xuất sửa chữa</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Biển kiểm soát *</label>
          <input type="text" value={bks} onChange={(e) => setBks(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500" required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Lý do *</label>
          <textarea value={lydo} onChange={(e) => setLydo(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500" rows={3} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Mức ưu tiên</label>
          <select value={uuTien} onChange={(e) => setUuTien(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500">
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Ghi chú</label>
          <textarea value={ghiChu} onChange={(e) => setGhiChu(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500" rows={2} />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex gap-2">
          <button type="submit" disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Đang tạo...' : 'Tạo đề xuất'}
          </button>
          <button type="button" onClick={() => router.back()}
            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">Hủy</button>
        </div>
      </form>
    </div>
  );
}
