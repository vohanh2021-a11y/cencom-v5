'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

const ROLES = ['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'];

interface UserRow {
  id: string;
  name: string;
  role: string;
  phone: string;
  phong_ban: string;
  active: number;
  must_change: number;
}

export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', role: 'ketoan', phone: '', phong_ban: '', password: '' });
  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fn: 'userList', args: [{}] }),
      });
      const data = await res.json();
      if (data.ok) setUsers(data.result as UserRow[]);
      else toast(data.error || 'Lỗi tải danh sách', 'err');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createUser() {
    if (!form.name.trim() || !form.role) { toast('Thiếu tên hoặc vai trò', 'err'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fn: 'userAdd', args: [{ ...form, id: form.id.trim() || undefined, password: form.password.trim() || undefined }] }),
      });
      const data = await res.json();
      if (data.ok) {
        toast('Đã tạo người dùng ' + (form.id.trim() || form.name), 'ok');
        setShowCreate(false);
        setForm({ id: '', name: '', role: 'ketoan', phone: '', phong_ban: '', password: '' });
        await load();
      } else toast(data.error || 'Lỗi tạo', 'err');
    } finally { setSaving(false); }
  }

  async function toggleActive(u: UserRow) {
    setSaving(true);
    try {
      const res = await fetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fn: 'userSetActive', args: [{ id: u.id, active: u.active ? 0 : 1 }] }),
      });
      const data = await res.json();
      if (data.ok) { toast(u.active ? 'Đã khóa ' + u.id : 'Đã mở ' + u.id, 'ok'); await load(); }
      else toast(data.error || 'Lỗi', 'err');
    } finally { setSaving(false); }
  }

  async function doReset() {
    if (resetPw.length < 6) { toast('Mật khẩu ít nhất 6 ký tự', 'err'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fn: 'userSetPassword', args: [{ id: resetId, password: resetPw }] }),
      });
      const data = await res.json();
      if (data.ok) { toast('Đã đặt lại mật khẩu', 'ok'); setResetId(null); setResetPw(''); await load(); }
      else toast(data.error || 'Lỗi', 'err');
    } finally { setSaving(false); }
  }

  if (loading) return <div className="p-6 text-center text-[var(--c-ink-muted)]">Đang tải…</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Người dùng</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)} disabled={saving}>+ Tạo người dùng</button>
      </div>

      <div className="bg-white dark:bg-[var(--c-surface)] rounded shadow overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--c-line)] sticky top-0">
            <tr>
              <th className="px-4 py-2 text-left">Mã</th>
              <th className="px-4 py-2 text-left">Tên</th>
              <th className="px-4 py-2 text-left">Vai trò</th>
              <th className="px-4 py-2 text-left">Phòng ban</th>
              <th className="px-4 py-2 text-left">SĐT</th>
              <th className="px-4 py-2 text-center">Trạng thái</th>
              <th className="px-4 py-2 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-2 font-medium">{u.id}</td>
                <td className="px-4 py-2">{u.name}</td>
                <td className="px-4 py-2">{u.role}</td>
                <td className="px-4 py-2">{u.phong_ban}</td>
                <td className="px-4 py-2">{u.phone}</td>
                <td className="px-4 py-2 text-center">
                  <span className={`badge ${u.active ? 'badge-ok' : 'badge-danger'}`}>
                    {u.active ? 'Hoạt động' : 'Đã khóa'}
                  </span>
                  {u.must_change ? <span className="badge badge-warn ml-1">Đổi MK</span> : null}
                </td>
                <td className="px-4 py-2 text-center whitespace-nowrap">
                  <button className="btn btn-sm" onClick={() => { setResetId(u.id); setResetPw(''); }} disabled={saving}>Đổi MK</button>
                  <button className="btn btn-sm ml-1" onClick={() => toggleActive(u)} disabled={saving}>
                    {u.active ? 'Khóa' : 'Mở'}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--c-ink-muted)]">Chưa có người dùng.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Tạo người dùng">
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Mã (tùy chọn, mặc định = tên)</label>
            <input className="input" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} placeholder="vd: khoa1" />
          </div>
          <div>
            <label className="block text-sm mb-1">Tên <span className="text-red-500">*</span></label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nguyễn Văn A" />
          </div>
          <div>
            <label className="block text-sm mb-1">Vai trò <span className="text-red-500">*</span></label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Phòng ban</label>
              <input className="input" value={form.phong_ban} onChange={(e) => setForm({ ...form, phong_ban: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm mb-1">SĐT</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm mb-1">Mật khẩu (để trống = mặc định cencom@123, bắt đổi sau)</label>
            <input className="input" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Tối thiểu 6 ký tự" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn" onClick={() => setShowCreate(false)} disabled={saving}>Hủy</button>
            <button className="btn btn-primary" onClick={createUser} disabled={saving}>{saving ? 'Đang lưu…' : 'Tạo'}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!resetId} onClose={() => setResetId(null)} title={'Đặt lại mật khẩu: ' + (resetId || '')}>
        <div className="space-y-3">
          <input className="input" type="text" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="Mật khẩu mới (≥6 ký tự)" />
          <div className="flex justify-end gap-2">
            <button className="btn" onClick={() => setResetId(null)} disabled={saving}>Hủy</button>
            <button className="btn btn-primary" onClick={doReset} disabled={saving}>{saving ? 'Đang lưu…' : 'Lưu'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
