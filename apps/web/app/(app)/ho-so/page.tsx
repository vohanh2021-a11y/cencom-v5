'use client';

import * as React from 'react';
import { useRpc, rpc } from '@/lib/use-rpc';
import { useSession } from '@/components/SessionContext';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { SkeletonList, EmptyState, ErrorState } from '@/components/ui/States';

type HoSo = {
  id?: string;
  sc_id: string;
  so_chung_tu: string;
  ngay: string;
  ngay_quyet: string;
  ghi_chu: string;
  nguoi_lap: string;
};

export default function HoSoPage() {
  const toast = useToast();
  const { role } = useSession();
  const canEdit = role === 'ketoan' || role === 'admin';

  const { data, refetch, loading, error } = useRpc<HoSo[]>('hoSoList', {});
  const rows: HoSo[] = (data as HoSo[]) || [];

  const [editing, setEditing] = React.useState<HoSo | null>(null);
  const [showForm, setShowForm] = React.useState(false);

  function openNew() {
    setEditing({ sc_id: '', so_chung_tu: '', ngay: '', ngay_quyet: '', ghi_chu: '', nguoi_lap: '' });
    setShowForm(true);
  }
  function openEdit(h: HoSo) {
    setEditing({ ...h });
    setShowForm(true);
  }

  return (
    <div className="page" data-ws="ho-so">
      <div className="page-head">
        <h1 className="text-xl font-semibold mt-1">Hồ sơ kế toán</h1>
        <div className="muted">{rows.length} hồ sơ</div>
      </div>

      <div className="flex gap-2 my-3 flex-wrap items-center">
        {canEdit && <Button onClick={openNew}>+ Tạo hồ sơ</Button>}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <SkeletonList rows={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : rows.length === 0 ? (
          <EmptyState title="Chưa có hồ sơ" hint="Tạo hồ sơ kế toán mới.">
            {canEdit && <Button onClick={openNew}>+ Tạo hồ sơ</Button>}
          </EmptyState>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>SC</th>
                <th>Số chứng từ</th>
                <th>Ngày</th>
                <th>Ngày quyết</th>
                <th>Ghi chú</th>
                <th>Người lập</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h, i) => (
                <tr key={h.id || i}>
                  <td>{h.sc_id || '—'}</td>
                  <td>{h.so_chung_tu || '—'}</td>
                  <td>{h.ngay || '—'}</td>
                  <td>{h.ngay_quyet || '—'}</td>
                  <td>{h.ghi_chu || '—'}</td>
                  <td>{h.nguoi_lap || '—'}</td>
                  <td className="num">
                    {canEdit && (
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(h)}>Sửa</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && editing && canEdit && (
        <HoSoForm h={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refetch(); }} />
      )}
    </div>
  );
}

function HoSoForm({ h, onClose, onSaved }: { h: HoSo; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [scId, setScId] = React.useState(h.sc_id);
  const [soChungTu, setSoChungTu] = React.useState(h.so_chung_tu);
  const [ngay, setNgay] = React.useState(h.ngay);
  const [ngayQuyet, setNgayQuyet] = React.useState(h.ngay_quyet);
  const [ghiChu, setGhiChu] = React.useState(h.ghi_chu);
  const [busy, setBusy] = React.useState(false);

  async function save() {
    if (!scId.trim()) {
      toast('Thiếu SC', 'err');
      return;
    }
    setBusy(true);
    try {
      const r = await rpc('hoSoSave', {
        id: h.id || undefined,
        sc_id: scId.trim(),
        so_chung_tu: soChungTu.trim(),
        ngay: ngay || undefined,
        ngay_quyet: ngayQuyet || undefined,
        ghi_chu: ghiChu.trim(),
      });
      if (r.ok) {
        toast('Đã lưu hồ sơ', 'ok');
        onSaved();
      } else toast(r.error || 'Lưu thất bại', 'err');
    } catch {
      toast('Lỗi mạng', 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-h">{h.id ? 'Sửa hồ sơ' : 'Tạo hồ sơ'}</div>
        <div className="modal-b space-y-3">
          <Field label="SC *"><input className="input" value={scId} onChange={(e) => setScId(e.target.value)} placeholder="Mã phiếu SC" /></Field>
          <Field label="Số chứng từ"><input className="input" value={soChungTu} onChange={(e) => setSoChungTu(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ngày"><input className="input" type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} /></Field>
            <Field label="Ngày quyết toán"><input className="input" type="date" value={ngayQuyet} onChange={(e) => setNgayQuyet(e.target.value)} /></Field>
          </div>
          <Field label="Ghi chú"><textarea className="input" rows={3} value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} /></Field>
        </div>
        <div className="modal-f flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button onClick={save} disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="muted text-sm mb-1">{label}</div>
      {children}
    </div>
  );
}
