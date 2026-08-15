'use client';

import * as React from 'react';
import { useRpc, rpc } from '@/lib/use-rpc';
import { useRealtime } from '@/lib/use-realtime';
import { useSession } from '@/components/SessionContext';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { fmtMoney } from '@/lib/format';
import { KhoNav } from '@/components/KhoNav';

type Vattu = {
  id: number;
  code: string;
  name: string;
  donvi: string;
  gia: number;
  ton: number;
  ton_min: number;
  nhom: string;
};

export default function KhoPage() {
  const toast = useToast();
  const { perms } = useSession();
  const canTao = !!perms?.['kho']?.includes('tao');
  const canXoa = !!perms?.['kho']?.includes('xoa');

  const { data, refetch } = useRpc<Vattu[]>('vatTuList', []);
  useRealtime('vattu', () => refetch());

  const [q, setQ] = React.useState('');
  const [editing, setEditing] = React.useState<Vattu | null>(null);
  const [showForm, setShowForm] = React.useState(false);

  const rows: Vattu[] = data || [];
  const filtered = rows.filter(
    (r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || (r.code || '').toLowerCase().includes(q.toLowerCase())
  );

  function openNew() {
    setEditing({ id: 0, code: '', name: '', donvi: '', gia: 0, ton: 0, ton_min: 0, nhom: '' });
    setShowForm(true);
  }
  function openEdit(v: Vattu) {
    setEditing({ ...v });
    setShowForm(true);
  }
  async function del(v: Vattu) {
    if (!confirm('Xóa vật tư ' + v.name + '?')) return;
    const r = await rpc('vatTuDel', [v.id]);
    if (r.ok) {
      toast('Đã xóa', 'ok');
      refetch();
    } else toast(r.error || 'Xóa thất bại', 'err');
  }

  return (
    <div className="page">
      <KhoNav />
      <div className="page-head">
        <h1 className="text-xl font-semibold mt-1">Kho — Tồn kho vật tư</h1>
        <div className="muted">{rows.length} mặt hàng</div>
      </div>

      <div className="flex gap-2 my-3 flex-wrap items-center">
        <input className="input w-64" placeholder="Tìm tên / mã..." value={q} onChange={(e) => setQ(e.target.value)} />
        {canTao && <Button onClick={openNew}>+ Thêm vật tư</Button>}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr><th>Mã</th><th>Tên</th><th>Đơn vị</th><th className="num">Tồn</th><th className="num">Tối thiểu</th><th className="num">Giá</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.map((v) => (
              <tr key={v.id}>
                <td>{v.code || '—'}</td>
                <td>{v.name}</td>
                <td>{v.donvi}</td>
                <td className={'num ' + (v.ton <= v.ton_min ? 'text-[var(--c-danger)] font-bold' : '')}>{v.ton}</td>
                <td className="num">{v.ton_min}</td>
                <td className="num">{fmtMoney(v.gia)}</td>
                <td className="num">
                  {canTao && <button className="btn btn-ghost btn-sm" onClick={() => openEdit(v)}>Sửa</button>}
                  {canXoa && <button className="btn btn-ghost btn-sm text-[var(--c-danger)]" onClick={() => del(v)}>Xóa</button>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="muted text-center">Chưa có vật tư</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && editing && (
        <VattuForm v={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); refetch(); }} />
      )}
    </div>
  );
}

function VattuForm({ v, onClose, onSaved }: { v: Vattu; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = React.useState(v.name);
  const [donvi, setDonvi] = React.useState(v.donvi);
  const [gia, setGia] = React.useState(String(v.gia || 0));
  const [ton, setTon] = React.useState(String(v.ton || 0));
  const [tonMin, setTonMin] = React.useState(String(v.ton_min || 0));
  const [nhom, setNhom] = React.useState(v.nhom || '');
  const [code, setCode] = React.useState(v.code || '');
  const [busy, setBusy] = React.useState(false);

  async function save() {
    setBusy(true);
    try {
      const r = await rpc('vatTuSave', {
        id: v.id ? v.id : undefined,
        name: name.trim(),
        donvi: donvi.trim(),
        gia: Number(gia) || 0,
        ton: Number(ton) || 0,
        ton_min: Number(tonMin) || 0,
        nhom: nhom.trim(),
        code: code.trim(),
      });
      if (r.ok) {
        toast('Đã lưu vật tư', 'ok');
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
        <div className="modal-h">{v.id ? 'Sửa vật tư' : 'Thêm vật tư'}</div>
        <div className="modal-b space-y-3">
          <Field label="Tên *"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Mã"><input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="VT-xxxx (tự sinh nếu để trống)" /></Field>
          <Field label="Đơn vị *"><input className="input" value={donvi} onChange={(e) => setDonvi(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Giá"><input className="input" type="number" value={gia} onChange={(e) => setGia(e.target.value)} /></Field>
            <Field label="Tồn"><input className="input" type="number" value={ton} onChange={(e) => setTon(e.target.value)} /></Field>
            <Field label="Tồn tối thiểu"><input className="input" type="number" value={tonMin} onChange={(e) => setTonMin(e.target.value)} /></Field>
            <Field label="Nhóm"><input className="input" value={nhom} onChange={(e) => setNhom(e.target.value)} /></Field>
          </div>
        </div>
        <div className="modal-f flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Hủy</Button>
          <Button onClick={save} disabled={busy}>Lưu</Button>
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
