'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { rpc } from '@/lib/use-rpc';
import { useSession } from '@/components/SessionContext';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

type CV = { ten: string; so_luong: string; don_gia: string };
type VT = { name: string; so_luong: string; gd_dk: string };

export default function ScCreatePage() {
  const router = useRouter();
  const toast = useToast();
  const { perms } = useSession();

  const [bks, setBks] = React.useState('');
  const [moTa, setMoTa] = React.useState('');
  const [ngayDK, setNgayDK] = React.useState('');
  const [laNgoai, setLaNgoai] = React.useState(false);
  const [donVi, setDonVi] = React.useState('');
  const [ghiChu, setGhiChu] = React.useState('');
  const [cv, setCv] = React.useState<CV[]>([{ ten: '', so_luong: '1', don_gia: '0' }]);
  const [vt, setVt] = React.useState<VT[]>([{ name: '', so_luong: '1', gd_dk: '0' }]);
  const [busy, setBusy] = React.useState(false);

  if (!perms?.['sc']?.includes('them')) {
    return <div className="p-6 text-[var(--c-muted)]">Bạn không có quyền tạo phiếu sửa chữa.</div>;
  }

  function updateCv(i: number, k: keyof CV, v: string) {
    setCv((arr) => arr.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
  }
  function updateVt(i: number, k: keyof VT, v: string) {
    setVt((arr) => arr.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)));
  }

  async function submit() {
    const b = bks.trim().toUpperCase();
    if (!b) {
      toast('Thiếu biển số xe', 'err');
      return;
    }
    const rec = {
      bks: b,
      mo_ta: moTa,
      ngay_du_kien: ngayDK,
      la_sua_ngoai: laNgoai,
      don_vi_ngoai: donVi,
      ghi_chu: ghiChu,
      congviec: cv
        .filter((c) => c.ten.trim())
        .map((c) => ({ ten: c.ten, so_luong: Number(c.so_luong) || 0, don_gia: Number(c.don_gia) || 0 })),
      vattu: vt
        .filter((v) => v.name.trim())
        .map((v) => ({ name: v.name, so_luong: Number(v.so_luong) || 0, gd_dk: Number(v.gd_dk) || 0 })),
    };
    setBusy(true);
    try {
      const r = await rpc<{ id?: string }>('scCreate', rec);
      if (r.ok && r.result?.id) {
        toast('Đã tạo phiếu ' + r.result.id, 'ok');
        router.push('/sc/' + r.result.id);
      } else {
        toast(r.error || 'Tạo phiếu thất bại', 'err');
      }
    } catch {
      toast('Lỗi mạng', 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <Link href="/sc" className="text-[var(--c-accent)] text-sm">← Quay lại danh sách</Link>
        <h1 className="text-xl font-semibold mt-1">Tạo phiếu sửa chữa mới</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div className="card">
          <div className="card-h">Thông tin chung</div>
          <div className="card-b space-y-3">
            <Field label="Biển số *">
              <input className="input" value={bks} onChange={(e) => setBks(e.target.value)} placeholder="VD: 51C-12345" />
            </Field>
            <Field label="Mô tả">
              <textarea className="input" rows={3} value={moTa} onChange={(e) => setMoTa(e.target.value)} />
            </Field>
            <Field label="Hạn trả xe">
              <input className="input" type="date" value={ngayDK} onChange={(e) => setNgayDK(e.target.value)} />
            </Field>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={laNgoai} onChange={(e) => setLaNgoai(e.target.checked)} />
              <span>Sửa chữa bên ngoài</span>
            </label>
            {laNgoai && (
              <Field label="Đơn vị ngoài">
                <input className="input" value={donVi} onChange={(e) => setDonVi(e.target.value)} />
              </Field>
            )}
            <Field label="Ghi chú">
              <input className="input" value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="card-h">Công việc</div>
            <div className="card-b space-y-2">
              {cv.map((c, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input className="input flex-1" placeholder="Tên công việc" value={c.ten} onChange={(e) => updateCv(i, 'ten', e.target.value)} />
                  <input className="input w-16" type="number" value={c.so_luong} onChange={(e) => updateCv(i, 'so_luong', e.target.value)} />
                  <input className="input w-28" type="number" value={c.don_gia} onChange={(e) => updateCv(i, 'don_gia', e.target.value)} />
                  <button className="btn btn-ghost btn-sm" onClick={() => setCv((a) => a.filter((_, idx) => idx !== i))} aria-label="Xóa công việc">✕</button>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setCv((a) => [...a, { ten: '', so_luong: '1', don_gia: '0' }])}>+ Thêm công việc</Button>
            </div>
          </div>

          <div className="card">
            <div className="card-h">Vật tư</div>
            <div className="card-b space-y-2">
              {vt.map((v, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input className="input flex-1" placeholder="Tên vật tư" value={v.name} onChange={(e) => updateVt(i, 'name', e.target.value)} />
                  <input className="input w-16" type="number" value={v.so_luong} onChange={(e) => updateVt(i, 'so_luong', e.target.value)} />
                  <input className="input w-28" type="number" value={v.gd_dk} onChange={(e) => updateVt(i, 'gd_dk', e.target.value)} />
                  <button className="btn btn-ghost btn-sm" onClick={() => setVt((a) => a.filter((_, idx) => idx !== i))} aria-label="Xóa vật tư">✕</button>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setVt((a) => [...a, { name: '', so_luong: '1', gd_dk: '0' }])}>+ Thêm vật tư</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="action-bar">
        <Button onClick={submit} disabled={busy}>Tạo phiếu</Button>
        <Link href="/sc" className="btn btn-ghost">Hủy</Link>
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
