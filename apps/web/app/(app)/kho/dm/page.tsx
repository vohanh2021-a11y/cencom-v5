'use client';

import * as React from 'react';
import { useRpc, rpc } from '@/lib/use-rpc';
import { useRealtime } from '@/lib/use-realtime';
import { useSession } from '@/components/SessionContext';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { fmtMoney } from '@/lib/format';
import { KhoNav } from '@/components/KhoNav';

const DM_TT: Record<string, string> = {
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
  da_mua: 'Đã mua',
  tu_choi: 'Từ chối',
  huy: 'Hủy',
};

type DM = {
  id: string;
  ngay: string;
  nguoi_lap: string;
  tong: number;
  trang_thai: string;
  ghi_chu: string;
  so_dong: number;
};

type VT = { id: number; name: string; donvi: string; gia: number };

export default function DmPage() {
  const toast = useToast();
  const { perms } = useSession();
  const canTao = !!perms?.['mua']?.includes('tao');
  const canDuy = !!perms?.['mua']?.includes('duy');

  const { data, refetch } = useRpc<DM[]>('dmList', []);
  useRealtime('de_nghi_mua', () => refetch());

  const rows: DM[] = data || [];
  const [showForm, setShowForm] = React.useState(false);
  const [reject, setReject] = React.useState<{ id: string; open: boolean }>({ id: '', open: false });
  const [lyDo, setLyDo] = React.useState('');
  const [detailId, setDetailId] = React.useState('');

  async function decide(id: string, action: 'ok' | 'no') {
    if (action === 'no') {
      setReject({ id, open: true });
      return;
    }
    const r = await rpc('dmDecide', [id, 'ok', '']);
    if (r.ok) {
      toast('Đã duyệt đề nghị', 'ok');
      refetch();
    } else toast(r.error || 'Thất bại', 'err');
  }
  function confirmReject() {
    rpc('dmDecide', [reject.id, 'no', lyDo]).then((r) => {
      if (r.ok) { toast('Đã từ chối', 'ok'); refetch(); }
      else toast(r.error || 'Thất bại', 'err');
      setReject({ id: '', open: false });
      setLyDo('');
    });
  }

  return (
    <div className="page">
      <KhoNav />
      <div className="page-head">
        <h1 className="text-xl font-semibold mt-1">Đề nghị mua vật tư</h1>
        <div className="muted">{rows.length} đề nghị</div>
      </div>

      <div className="my-3">{canTao && <Button onClick={() => setShowForm(true)}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>Tạo đề nghị</Button>}</div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr><th>Mã</th><th>Ngày</th><th>Người lập</th><th className="num">Tổng</th><th>Trạng thái</th><th className="num"></th></tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{d.id}</td>
                <td>{d.ngay}</td>
                <td>{d.nguoi_lap}</td>
                <td className="num">{fmtMoney(d.tong)}</td>
                <td>{DM_TT[d.trang_thai] || d.trang_thai}</td>
                <td className="num">
                  <button className="btn btn-ghost btn-sm" onClick={() => setDetailId(d.id)}>Chi tiết</button>
                  {canDuy && d.trang_thai === 'cho_duyet' && (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={() => decide(d.id, 'ok')}>Duyệt</button>
                      <button className="btn btn-ghost btn-sm text-[var(--c-danger)]" onClick={() => decide(d.id, 'no')}>Từ chối</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted text-center">Chưa có đề nghị</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && <DmForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refetch(); }} />}
      {detailId && <DmDetailModal id={detailId} onClose={() => setDetailId('')} />}

      {reject.open && (
        <div className="modal-scrim" onClick={() => setReject({ id: '', open: false })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">Lý do từ chối</div>
            <div className="modal-b">
              <textarea className="input w-full" rows={3} value={lyDo} onChange={(e) => setLyDo(e.target.value)} />
            </div>
            <div className="modal-f flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReject({ id: '', open: false })}>Hủy</Button>
              <Button variant="danger" onClick={confirmReject}>Xác nhận</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DmForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { data: vts } = useRpc<VT[]>('vatTuList', []);
  const list: VT[] = vts || [];
  const [items, setItems] = React.useState<{ vattu_id: number; so_luong: string; dgia: string }[]>([
    { vattu_id: 0, so_luong: '1', dgia: '0' },
  ]);
  const [ghiChu, setGhiChu] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  function upd(i: number, k: 'vattu_id' | 'so_luong' | 'dgia', val: string | number) {
    setItems((arr) => arr.map((x, idx) => (idx === i ? { ...x, [k]: val } : x)));
  }

  async function save() {
    const its = items
      .filter((it) => it.vattu_id > 0 && Number(it.so_luong) > 0)
      .map((it) => {
        const vt = list.find((v) => v.id === it.vattu_id);
        return { vattu_id: it.vattu_id, so_luong: Number(it.so_luong), dgia: Number(it.dgia) || (vt ? vt.gia : 0), name: vt?.name || '', donvi: vt?.donvi || '' };
      });
    if (!its.length) {
      toast('Chưa chọn vật tư', 'err');
      return;
    }
    setBusy(true);
    try {
      const r = await rpc('dmCreate', { items: its, ghi_chu: ghiChu });
      if (r.ok) {
        toast('Đã tạo đề nghị ' + (r.result as any)?.id, 'ok');
        onSaved();
      } else toast(r.error || 'Thất bại', 'err');
    } catch {
      toast('Lỗi mạng', 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">Tạo đề nghị mua</div>
        <div className="modal-b space-y-2">
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
          <Field label="Ghi chú"><input className="input" value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} /></Field>
        </div>
        <div className="modal-f flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button onClick={save} disabled={busy}>Tạo</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="muted text-sm mb-1">{label}</div>{children}</div>;
}

function DmDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, loading } = useRpc<{ dm: Record<string, any>; ct: Record<string, any>[] }>('dmDetail', [id]);
  const dm = data?.dm;
  const ct = data?.ct || [];
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">Đề nghị {id}</div>
        <div className="modal-b space-y-2">
          {loading && <div className="muted">Đang tải…</div>}
          {dm && (
            <>
              <div className="muted">Trạng thái: <b>{dm.label || dm.trang_thai}</b> · Ngày {dm.ngay} · {dm.nguoi_lap}</div>
              <table className="tbl">
                <thead><tr><th>Vật tư</th><th className="num">SL</th><th className="num">Đơn giá</th><th className="num">Thành</th></tr></thead>
                <tbody>
                  {ct.map((c, i) => (
                    <tr key={i}>
                      <td>{c.ten || c.name || '—'}</td>
                      <td className="num">{c.so_luong}</td>
                      <td className="num">{fmtMoney(Number(c.dg_dk) || Number(c.dgia) || 0)}</td>
                      <td className="num">{fmtMoney((Number(c.so_luong) || 0) * (Number(c.dg_dk) || Number(c.dgia) || 0))}</td>
                    </tr>
                  ))}
                  {ct.length === 0 && <tr><td colSpan={4} className="muted text-center">Không có dòng</td></tr>}
                </tbody>
              </table>
            </>
          )}
        </div>
        <div className="modal-f flex justify-end">
          <Button variant="ghost" onClick={onClose}>Đóng</Button>
        </div>
      </div>
    </div>
  );
}
