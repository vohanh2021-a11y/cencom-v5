'use client';

import * as React from 'react';
import { useRpc, rpc } from '@/lib/use-rpc';
import { useRealtime } from '@/lib/use-realtime';
import { useSession } from '@/components/SessionContext';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

type BG = {
  id: number;
  dm_id: string;
  sc_id: string;
  ncc_ten: string;
  ncc_dia_chi: string;
  ncc_sdt: string;
  ngay: string;
  loai_chung_tu: string;
  ref_phieu_nhap: string;
  nguoi_lap: string;
};

const LOAI: Array<[string, string]> = [
  ['bao_gia', 'Báo giá'],
  ['hoa_don', 'Hóa đơn'],
  ['khac', 'Khác'],
];

type Item = { ten: string; so_luong: string; dgia: string; donvi: string };

export default function BaoGiaPage() {
  const toast = useToast();
  const { perms } = useSession();
  const canXem = !!perms?.['mua']?.includes('xem');
  const canTao = !!perms?.['mua']?.includes('tao');
  const canXoa = !!perms?.['mua']?.includes('xoa');

  const [scFilter, setScFilter] = React.useState('');
  const [loaiFilter, setLoaiFilter] = React.useState('');
  const q: Record<string, unknown> = { limit: 300 };
  if (scFilter.trim()) q.sc_id = scFilter.trim();
  if (loaiFilter) q.loai_chung_tu = loaiFilter;

  const { data, loading, refetch } = useRpc<BG[]>('baoGiaList', [q]);
  useRealtime('bao_gia_ncc', () => refetch());

  const rows: BG[] = data || [];
  const [showForm, setShowForm] = React.useState(false);
  const [detailId, setDetailId] = React.useState<number | null>(null);

  // Form state
  const [nccTen, setNccTen] = React.useState('');
  const [ngay, setNgay] = React.useState(new Date().toISOString().slice(0, 10));
  const [loai, setLoai] = React.useState('bao_gia');
  const [scId, setScId] = React.useState('');
  const [dmId, setDmId] = React.useState('');
  const [items, setItems] = React.useState<Item[]>([{ ten: '', so_luong: '1', dgia: '0', donvi: '' }]);

  function updItem(i: number, k: keyof Item, v: string) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  }
  function addItem() {
    setItems((arr) => [...arr, { ten: '', so_luong: '1', dgia: '0', donvi: '' }]);
  }
  function delItem(i: number) {
    setItems((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr));
  }

  async function submit() {
    if (!nccTen.trim()) {
      toast('Nhập tên nhà cung cấp', 'info');
      return;
    }
    const its = items
      .filter((it) => it.ten.trim())
      .map((it) => ({
        ten: it.ten.trim(),
        so_luong: Number(it.so_luong) || 0,
        dgia: Number(it.dgia) || 0,
        donvi: it.donvi.trim() || undefined,
      }));
    const r = await rpc<{ id?: number }>('baoGiaCreate', {
      ncc_ten: nccTen.trim(),
      ngay,
      loai_chung_tu: loai,
      sc_id: scId.trim() || undefined,
      dm_id: dmId.trim() || undefined,
      items: its,
    });
    if (r.ok) {
      toast('Đã tạo chứng từ NCC #' + (r.result?.id ?? ''), 'ok');
      setShowForm(false);
      setNccTen('');
      setItems([{ ten: '', so_luong: '1', dgia: '0', donvi: '' }]);
      setScId('');
      setDmId('');
      refetch();
    } else {
      toast(r.error || 'Tạo thất bại', 'err');
    }
  }

  async function xoa(id: number) {
    if (!confirm('Xóa chứng từ #' + id + '?')) return;
    const r = await rpc('baoGiaDel', [String(id)]);
    if (r.ok) {
      toast('Đã xóa', 'ok');
      refetch();
    } else {
      toast(r.error || 'Xóa thất bại', 'err');
    }
  }

  if (!canXem) {
    return <div className="p-6 text-center text-gray-500">Bạn không có quyền xem Báo giá NCC.</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Báo giá / Hóa đơn NCC</h2>
        {canTao && <Button onClick={() => setShowForm(true)}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>Tạo chứng từ</Button>}
      </div>

      <div className="flex gap-2 items-end bg-white/60 p-3 rounded-lg border border-black/5">
        <label className="text-sm">SC ID
          <input className="input" value={scFilter} onChange={(e) => setScFilter(e.target.value)} placeholder="SC-000001" />
        </label>
        <label className="text-sm">Loại
          <select className="input" value={loaiFilter} onChange={(e) => setLoaiFilter(e.target.value)}>
            <option value="">Tất cả</option>
            {LOAI.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>

      <div className="card">
        {loading ? (
          <p className="text-sm text-gray-500">Đang tải…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">Chưa có chứng từ nào.</p>
        ) : (
          <div className="overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th><th>NCC</th><th>SC</th><th>Loại</th><th>Ngày</th><th>Người lập</th><th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono">{r.id}</td>
                    <td>{r.ncc_ten}</td>
                    <td className="font-mono">{r.sc_id || '—'}</td>
                    <td>{LOAI.find((l) => l[0] === r.loai_chung_tu)?.[1] || r.loai_chung_tu}</td>
                    <td>{r.ngay}</td>
                    <td>{r.nguoi_lap}</td>
                    <td className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setDetailId(r.id)}>Xem</Button>
                      {canXoa && (
                        <Button variant="danger" size="sm" onClick={() => xoa(r.id)}>Xóa</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="modal-scrim" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">Tạo chứng từ NCC</h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">Tên NCC *
                <input className="input" value={nccTen} onChange={(e) => setNccTen(e.target.value)} />
              </label>
              <label className="text-sm">Ngày
                <input type="date" className="input" value={ngay} onChange={(e) => setNgay(e.target.value)} />
              </label>
              <label className="text-sm">Loại
                <select className="input" value={loai} onChange={(e) => setLoai(e.target.value)}>
                  {LOAI.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="text-sm">SC ID (tùy chọn)
                <input className="input" value={scId} onChange={(e) => setScId(e.target.value)} placeholder="SC-000001" />
              </label>
              <label className="text-sm col-span-2">Mã Đề nghị mua (tùy chọn)
                <input className="input" value={dmId} onChange={(e) => setDmId(e.target.value)} placeholder="DM-000001" />
              </label>
            </div>

            <div className="mt-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-semibold">Vật tư / hạng mục</span>
                <Button variant="ghost" size="sm" onClick={addItem}>+ Thêm</Button>
              </div>
              <div className="space-y-1">
                {items.map((it, i) => (
                  <div key={i} className="flex gap-1 items-center">
                    <input className="input flex-1" placeholder="Tên hạng mục" value={it.ten} onChange={(e) => updItem(i, 'ten', e.target.value)} />
                    <input className="input w-16" type="number" placeholder="SL" value={it.so_luong} onChange={(e) => updItem(i, 'so_luong', e.target.value)} />
                    <input className="input w-24" type="number" placeholder="Đơn giá" value={it.dgia} onChange={(e) => updItem(i, 'dgia', e.target.value)} />
                    <input className="input w-16" placeholder="ĐV" value={it.donvi} onChange={(e) => updItem(i, 'donvi', e.target.value)} />
                    <Button variant="ghost" size="sm" onClick={() => delItem(i)} aria-label="Xóa mục">✕</Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Hủy</Button>
              <Button onClick={submit}>Lưu chứng từ</Button>
            </div>
          </div>
        </div>
      )}

      {detailId != null && (
        <BgDetail id={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}

function BgDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const toast = useToast();
  const { perms } = useSession();
  const canEdit = !!perms?.['mua']?.includes('tao');
  const { data, loading, refetch } = useRpc<BG>('baoGiaGet', [String(id)]);
  const [edit, setEdit] = React.useState(false);
  const [nccTen, setNccTen] = React.useState('');
  const [nccDiaChi, setNccDiaChi] = React.useState('');
  const [nccSdt, setNccSdt] = React.useState('');
  const [ngay, setNgay] = React.useState('');
  const [loai, setLoai] = React.useState('bao_gia');

  React.useEffect(() => {
    if (data && edit) {
      setNccTen(data.ncc_ten || '');
      setNccDiaChi(data.ncc_dia_chi || '');
      setNccSdt(data.ncc_sdt || '');
      setNgay(data.ngay || '');
      setLoai(data.loai_chung_tu || 'bao_gia');
    }
  }, [data, edit]);

  async function save() {
    const r = await rpc('baoGiaConfirm', [
      id,
      { ncc_ten: nccTen.trim(), ncc_dia_chi: nccDiaChi.trim(), ncc_sdt: nccSdt.trim(), ngay, loai_chung_tu: loai },
    ]);
    if (r.ok) {
      toast('Đã cập nhật chứng từ', 'ok');
      setEdit(false);
      refetch();
    } else {
      toast(r.error || 'Cập nhật thất bại', 'err');
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-3">Chứng từ NCC #{id}</h3>
        {loading ? (
          <p className="text-sm text-gray-500">Đang tải…</p>
        ) : !data ? (
          <p className="text-sm text-gray-500">Không tìm thấy.</p>
        ) : !edit ? (
          <>
            <dl className="text-sm space-y-1">
              <div className="flex justify-between"><dt>NCC</dt><dd>{data.ncc_ten}</dd></div>
              <div className="flex justify-between"><dt>Địa chỉ</dt><dd>{data.ncc_dia_chi || '—'}</dd></div>
              <div className="flex justify-between"><dt>SDT</dt><dd>{data.ncc_sdt || '—'}</dd></div>
              <div className="flex justify-between"><dt>SC</dt><dd className="font-mono">{data.sc_id || '—'}</dd></div>
              <div className="flex justify-between"><dt>DM</dt><dd className="font-mono">{data.dm_id || '—'}</dd></div>
              <div className="flex justify-between"><dt>Loại</dt><dd>{data.loai_chung_tu}</dd></div>
              <div className="flex justify-between"><dt>Ngày</dt><dd>{data.ngay}</dd></div>
              <div className="flex justify-between"><dt>Người lập</dt><dd>{data.nguoi_lap}</dd></div>
            </dl>
            <div className="flex justify-end gap-2 mt-4">
              {canEdit && <Button onClick={() => setEdit(true)}>Sửa</Button>}
              <Button variant="ghost" onClick={onClose}>Đóng</Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">Tên NCC
                <input className="input" value={nccTen} onChange={(e) => setNccTen(e.target.value)} />
              </label>
              <label className="text-sm">Ngày
                <input type="date" className="input" value={ngay} onChange={(e) => setNgay(e.target.value)} />
              </label>
              <label className="text-sm col-span-2">Địa chỉ
                <input className="input" value={nccDiaChi} onChange={(e) => setNccDiaChi(e.target.value)} />
              </label>
              <label className="text-sm">SDT
                <input className="input" value={nccSdt} onChange={(e) => setNccSdt(e.target.value)} />
              </label>
              <label className="text-sm">Loại
                <select className="input" value={loai} onChange={(e) => setLoai(e.target.value)}>
                  {LOAI.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="ghost" onClick={() => setEdit(false)}>Hủy</Button>
              <Button onClick={save}>Lưu thay đổi</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
