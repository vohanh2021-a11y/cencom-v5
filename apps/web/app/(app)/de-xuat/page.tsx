'use client';

import * as React from 'react';
import { useRpc, rpc } from '@/lib/use-rpc';
import { useRealtime } from '@/lib/use-realtime';
import { useSession } from '@/components/SessionContext';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

const DX_TT: Record<string, string> = {
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
  tu_choi: 'Từ chối',
  da_chuyen_sc: 'Đã chuyển phiếu SC',
};
const UU: Array<[string, string]> = [
  ['Khan_cap', 'Khẩn cấp'],
  ['Xu_ly_som', 'Xử lý sớm'],
  ['Binh_thuong', 'Bình thường'],
];

type DX = {
  id: string;
  bks: string;
  ngay: string;
  mo_ta: string;
  dau_hieu: string[];
  muc_uu_tien: string;
  muc_uu_tien_label: string;
  trang_thai: string;
  label: string;
  nguoi_tao: string;
  sc_id: string;
};

export default function DeXuatPage() {
  const toast = useToast();
  const { perms } = useSession();
  const canTao = !!perms?.['de_xuat']?.includes('tao');
  const canDuy = !!perms?.['de_xuat']?.includes('duy');
  const canToSC = !!perms?.['sc']?.includes('tao');

  const [status, setStatus] = React.useState('');
  const [bks, setBks] = React.useState('');

  const q: Record<string, unknown> = {};
  if (status) q.trang_thai = status;
  if (bks) q.bks = bks;

  const { data, refetch } = useRpc<DX[]>('deXuatList', q);
  useRealtime('de_xuat_sua_chua', () => refetch());

  const rows: DX[] = data || [];
  const [showForm, setShowForm] = React.useState(false);
  const [detailId, setDetailId] = React.useState('');
  const [reject, setReject] = React.useState<{ id: string; open: boolean }>({ id: '', open: false });
  const [lyDo, setLyDo] = React.useState('');

  async function approve(id: string, action: 'ok' | 'no') {
    if (action === 'no') {
      setReject({ id, open: true });
      return;
    }
    const r = await rpc('deXuatApprove', [id, 'ok', '']);
    if (r.ok) { toast('Đã duyệt đề xuất', 'ok'); refetch(); }
    else toast(r.error || 'Thất bại', 'err');
  }
  function confirmReject() {
    rpc('deXuatApprove', [reject.id, 'no', lyDo]).then((r) => {
      if (r.ok) { toast('Đã từ chối', 'ok'); refetch(); }
      else toast(r.error || 'Thất bại', 'err');
      setReject({ id: '', open: false }); setLyDo('');
    });
  }
  async function toSC(id: string) {
    const r = await rpc<{ sc_id?: string }>('deXuatToSC', [id]);
    if (r.ok) { toast('Đã tạo phiếu sửa chữa ' + r.result?.sc_id, 'ok'); refetch(); }
    else toast(r.error || 'Thất bại', 'err');
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="text-xl font-semibold mt-1">Đề xuất sửa chữa</h1>
        <div className="muted">{rows.length} đề xuất</div>
      </div>

      <div className="flex gap-2 my-3 flex-wrap items-center">
        {canTao && <Button onClick={() => setShowForm(true)}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>Tạo đề xuất</Button>}
        <select className="input w-48" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          {Object.entries(DX_TT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input className="input w-48" placeholder="Biển số…" value={bks} onChange={(e) => setBks(e.target.value)} />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr><th>Mã</th><th>Biển số</th><th>Mô tả</th><th>Ưu tiên</th><th>Trạng thái</th><th className="num"></th></tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{d.id}</td>
                <td>{d.bks}</td>
                <td className="max-w-xs truncate">{d.mo_ta}</td>
                <td>{d.muc_uu_tien_label || d.muc_uu_tien}</td>
                <td>{DX_TT[d.trang_thai] || d.trang_thai}</td>
                <td className="num">
                  <button className="btn btn-ghost btn-sm" onClick={() => setDetailId(d.id)}>Chi tiết</button>
                  {canDuy && d.trang_thai === 'cho_duyet' && (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={() => approve(d.id, 'ok')}>Duyệt</button>
                      <button className="btn btn-ghost btn-sm text-[var(--c-danger)]" onClick={() => approve(d.id, 'no')}>Từ chối</button>
                    </>
                  )}
                  {canToSC && d.trang_thai === 'da_duyet' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => toSC(d.id)}>Tạo phiếu SC</button>
                  )}
                  {d.sc_id && <span className="muted ml-1">{d.sc_id}</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="muted text-center">Chưa có đề xuất</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && <DxForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refetch(); }} />}
      {detailId && <DxDetailModal id={detailId} onClose={() => setDetailId('')} />}

      {reject.open && (
        <div className="modal-scrim" onClick={() => setReject({ id: '', open: false })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">Lý do từ chối</div>
            <div className="modal-b"><textarea className="input w-full" rows={3} value={lyDo} onChange={(e) => setLyDo(e.target.value)} /></div>
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

function DxForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [bks, setBks] = React.useState('');
  const [moTa, setMoTa] = React.useState('');
  const [uu, setUu] = React.useState('Binh_thuong');
  const [dauHieu, setDauHieu] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function save() {
    const r = await rpc('deXuatCreate', {
      bks: bks.trim().toUpperCase(),
      mo_ta: moTa.trim(),
      muc_uu_tien: uu,
      dau_hieu: dauHieu.split('\n').map((s) => s.trim()).filter(Boolean),
    });
    if (r.ok) { toast('Đã tạo đề xuất ' + (r.result as any)?.id, 'ok'); onSaved(); }
    else toast(r.error || 'Thất bại', 'err');
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">Tạo đề xuất sửa chữa</div>
        <div className="modal-b space-y-3">
          <div><div className="muted text-sm mb-1">Biển số *</div><input className="input" value={bks} onChange={(e) => setBks(e.target.value)} placeholder="51C-12345" /></div>
          <div><div className="muted text-sm mb-1">Mô tả dấu hiệu / yêu cầu *</div><textarea className="input" rows={3} value={moTa} onChange={(e) => setMoTa(e.target.value)} /></div>
          <div><div className="muted text-sm mb-1">Mức ưu tiên</div>
            <select className="input" value={uu} onChange={(e) => setUu(e.target.value)}>
              {UU.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div><div className="muted text-sm mb-1">Dấu hiệu (mỗi dòng 1 ý)</div><textarea className="input" rows={2} value={dauHieu} onChange={(e) => setDauHieu(e.target.value)} /></div>
        </div>
        <div className="modal-f flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button onClick={save} disabled={busy}>Tạo</Button>
        </div>
      </div>
    </div>
  );
}

function DxDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, loading } = useRpc<Record<string, any>>('deXuatGet', [id]);
  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">Đề xuất {id}</div>
        <div className="modal-b space-y-2">
          {loading && <div className="muted">Đang tải…</div>}
          {data && (
            <>
              <div><span className="muted">Biển số:</span> <b>{data.bks}</b></div>
              <div><span className="muted">Trạng thái:</span> <b>{data.label || data.trang_thai}</b></div>
              <div><span className="muted">Ưu tiên:</span> {data.muc_uu_tien_label || data.muc_uu_tien}</div>
              <div><span className="muted">Người tạo:</span> {data.nguoi_tao} · {data.ngay}</div>
              <div><span className="muted">Mô tả:</span> {data.mo_ta}</div>
              {Array.isArray(data.dau_hieu) && data.dau_hieu.length > 0 && (
                <ul className="list-disc ml-5">{data.dau_hieu.map((x: string, i: number) => <li key={i}>{x}</li>)}</ul>
              )}
              {data.sc_id && <div><span className="muted">Phiếu SC:</span> <b>{data.sc_id}</b></div>}
            </>
          )}
        </div>
        <div className="modal-f flex justify-end"><Button variant="ghost" onClick={onClose}>Đóng</Button></div>
      </div>
    </div>
  );
}
