'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRpc, rpc } from '@/lib/use-rpc';
import { useRealtime } from '@/lib/use-realtime';
import { useSession } from '@/components/SessionContext';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { fmtMoney } from '@/lib/format';
import { KhoNav } from '@/components/KhoNav';

type Xuat = {
  id: string;
  ngay: string;
  nguoi_lap: string;
  ref_sc: string;
  nguoi_nhan: string;
  loai_xuat: string;
  tong: number;
  so_dong: number;
};
type VT = { id: number; name: string; donvi: string; gia: number };

export default function PhXuatListPage() {
  const toast = useToast();
  const { perms } = useSession();
  const canXuat = !!perms?.['kho']?.includes('xuat');

  const { data, refetch } = useRpc<Xuat[]>('phXuatList', []);
  useRealtime('phieu_xuat', () => refetch());
  const [showForm, setShowForm] = React.useState(false);

  const rows: Xuat[] = data || [];

  return (
    <div className="page">
      <KhoNav />
      <div className="page-head">
        <h1 className="text-xl font-semibold mt-1">Phiếu xuất kho</h1>
        <div className="muted">{rows.length} phiếu</div>
      </div>
      <div className="my-3">{canXuat && <Button onClick={() => setShowForm(true)}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>Tạo phiếu xuất</Button>}</div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr><th>Mã</th><th>Ngày</th><th>Người lập</th><th>SC liên kết</th><th className="num">Số dòng</th><th className="num">Tổng</th></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.ngay}</td>
                <td>{p.nguoi_lap}</td>
                <td>{p.ref_sc || '—'}</td>
                <td className="num">{p.so_dong}</td>
                <td className="num">{fmtMoney(p.tong)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted text-center">Chưa có phiếu xuất</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && <XuatForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refetch(); }} />}
    </div>
  );
}

function XuatForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { data: vts } = useRpc<VT[]>('vatTuList', []);
  const list: VT[] = vts || [];
  const [items, setItems] = React.useState<{ vattu_id: number; so_luong: string }[]>([{ vattu_id: 0, so_luong: '1' }]);
  const [refSc, setRefSc] = React.useState('');
  const [ghiChu, setGhiChu] = React.useState('');
  const [nguoiNhan, setNguoiNhan] = React.useState('');
  const [loai, setLoai] = React.useState('dung');
  const [busy, setBusy] = React.useState(false);

  function upd(i: number, k: 'vattu_id' | 'so_luong', val: string | number) {
    setItems((a) => a.map((x, idx) => (idx === i ? { ...x, [k]: val } : x)));
  }
  async function save() {
    const its = items.filter((it) => it.vattu_id > 0 && Number(it.so_luong) > 0).map((it) => ({ vattu_id: it.vattu_id, so_luong: Number(it.so_luong) }));
    if (!its.length) return toast('Chưa chọn vật tư', 'err');
    setBusy(true);
    try {
      const r = await rpc<{ id?: string }>('phXuatCreate', { items: its, ref_sc: refSc || undefined, ghi_chu: ghiChu, nguoi_nhan: nguoiNhan, loai_xuat: loai });
      if (r.ok) { toast('Đã tạo phiếu xuất ' + r.result?.id, 'ok'); onSaved(); }
      else toast(r.error || 'Thất bại', 'err');
    } catch { toast('Lỗi mạng', 'err'); } finally { setBusy(false); }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">Tạo phiếu xuất kho</div>
        <div className="modal-b space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><div className="muted text-sm mb-1">SC liên kết</div><input className="input" value={refSc} onChange={(e) => setRefSc(e.target.value)} placeholder="SC-..." /></div>
            <div><div className="muted text-sm mb-1">Người nhận</div><input className="input" value={nguoiNhan} onChange={(e) => setNguoiNhan(e.target.value)} /></div>
            <div><div className="muted text-sm mb-1">Loại xuất</div>
              <select className="input" value={loai} onChange={(e) => setLoai(e.target.value)}>
                <option value="dung">Xuất dùng</option>
                <option value="cu_hong">Thanh lý hư hỏng</option>
              </select>
            </div>
            <div><div className="muted text-sm mb-1">Ghi chú</div><input className="input" value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select className="input flex-1" value={it.vattu_id} onChange={(e) => upd(i, 'vattu_id', Number(e.target.value))}>
                  <option value={0}>Chọn vật tư…</option>
                  {list.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.donvi})</option>)}
                </select>
                <input className="input w-16" type="number" value={it.so_luong} onChange={(e) => upd(i, 'so_luong', e.target.value)} />
                <button className="btn btn-ghost btn-sm" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))} aria-label="Xóa dòng">✕</button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setItems((a) => [...a, { vattu_id: 0, so_luong: '1' }])}>+ Thêm dòng</Button>
          </div>
        </div>
        <div className="modal-f flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button onClick={save} disabled={busy}>Tạo</Button>
        </div>
      </div>
    </div>
  );
}
