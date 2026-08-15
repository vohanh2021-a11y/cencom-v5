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

type Nhap = {
  id: string;
  ngay: string;
  nguoi_lap: string;
  nha_cc: string;
  ref_dm: string;
  loai_nhap: string;
  tong: number;
  so_dong: number;
};
type VT = { id: number; name: string; donvi: string; gia: number };

export default function PhNhapListPage() {
  const toast = useToast();
  const { perms } = useSession();
  const canTao = !!perms?.['kho']?.includes('tao');

  const { data, refetch } = useRpc<Nhap[]>('phNhapList', []);
  useRealtime('phieu_nhap', () => refetch());
  const [showForm, setShowForm] = React.useState(false);

  const rows: Nhap[] = data || [];

  return (
    <div className="page">
      <KhoNav />
      <div className="page-head">
        <h1 className="text-xl font-semibold mt-1">Phiếu nhập kho</h1>
        <div className="muted">{rows.length} phiếu</div>
      </div>
      <div className="my-3">{canTao && <Button onClick={() => setShowForm(true)}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>Tạo phiếu nhập</Button>}</div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr><th>Mã</th><th>Ngày</th><th>Người lập</th><th>NCC</th><th className="num">Số dòng</th><th className="num">Tổng</th></tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.ngay}</td>
                <td>{p.nguoi_lap}</td>
                <td>{p.nha_cc || '—'}</td>
                <td className="num">{p.so_dong}</td>
                <td className="num">{fmtMoney(p.tong)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted text-center">Chưa có phiếu nhập</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && <NhapForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refetch(); }} />}
    </div>
  );
}

function NhapForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { data: vts } = useRpc<VT[]>('vatTuList', []);
  const list: VT[] = vts || [];
  const [items, setItems] = React.useState<{ vattu_id: number; so_luong: string; dgia: string }[]>([{ vattu_id: 0, so_luong: '1', dgia: '0' }]);
  const [ghiChu, setGhiChu] = React.useState('');
  const [refDm, setRefDm] = React.useState('');
  const [nhaCc, setNhaCc] = React.useState('');
  const [nguoiGiao, setNguoiGiao] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  function upd(i: number, k: 'vattu_id' | 'so_luong' | 'dgia', val: string | number) {
    setItems((a) => a.map((x, idx) => (idx === i ? { ...x, [k]: val } : x)));
  }
  async function save() {
    const its = items.filter((it) => it.vattu_id > 0 && Number(it.so_luong) > 0).map((it) => {
      const vt = list.find((v) => v.id === it.vattu_id);
      return { vattu_id: it.vattu_id, so_luong: Number(it.so_luong), dgia: Number(it.dgia) || (vt ? vt.gia : 0), ten: vt?.name || '', donvi: vt?.donvi || '' };
    });
    if (!its.length) return toast('Chưa chọn vật tư', 'err');
    setBusy(true);
    try {
      const r = await rpc<{ id?: string }>('phNhapCreate', { items: its, ghi_chu: ghiChu, ref_dm: refDm || undefined, nha_cc: nhaCc || undefined, nguoi_giao: nguoiGiao || undefined });
      if (r.ok) { toast('Đã tạo phiếu nhập ' + r.result?.id, 'ok'); onSaved(); }
      else toast(r.error || 'Thất bại', 'err');
    } catch { toast('Lỗi mạng', 'err'); } finally { setBusy(false); }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">Tạo phiếu nhập kho</div>
        <div className="modal-b space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><div className="muted text-sm mb-1">Tham chiếu ĐNM</div><input className="input" value={refDm} onChange={(e) => setRefDm(e.target.value)} placeholder="DNM-..." /></div>
            <div><div className="muted text-sm mb-1">Nhà cung cấp</div><input className="input" value={nhaCc} onChange={(e) => setNhaCc(e.target.value)} /></div>
            <div><div className="muted text-sm mb-1">Người giao</div><input className="input" value={nguoiGiao} onChange={(e) => setNguoiGiao(e.target.value)} /></div>
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
                <input className="input w-24" type="number" placeholder="Đơn giá" value={it.dgia} onChange={(e) => upd(i, 'dgia', e.target.value)} />
                <button className="btn btn-ghost btn-sm" onClick={() => setItems((a) => a.filter((_, idx) => idx !== i))} aria-label="Xóa dòng">✕</button>
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setItems((a) => [...a, { vattu_id: 0, so_luong: '1', dgia: '0' }])}>+ Thêm dòng</Button>
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
