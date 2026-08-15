'use client';
import * as React from 'react';
import { Modal } from './ui/Modal';

const QUICK: Array<[string, string]> = [
  ['scnew', '➕ Tạo phiếu sửa'],
  ['nhapkho', '📥 Nhập kho'],
  ['xuatkho', '📤 Xuất kho'],
  ['dm', '🛒 Đề nghị mua'],
  ['tk', '🩺 Thăm khám'],
  ['dash', '📊 Bảng điều khiển'],
];

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');

  React.useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        setQ('');
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  const go = (v: string) => {
    setOpen(false);
    setQ('');
    window.location.href = `/${v}`;
  };

  const filtered = QUICK.filter(([, label]) => label.toLowerCase().includes(q.toLowerCase()));

  return (
    <Modal open={open} onClose={() => { setOpen(false); setQ(''); }} title="Tìm kiếm nhanh (Ctrl+K)">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 Tìm hành động… (Esc đóng)"
        className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
        style={{ borderColor: 'var(--c-line)' }}
      />
      <div className="mt-2 space-y-1">
        {filtered.map(([v, label]) => (
          <div
            key={v}
            className="px-3 py-2 rounded-lg cursor-pointer hover:bg-[var(--c-primary-subtle)]"
            onClick={() => go(v)}
          >
            {label}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-3 py-2 text-sm text-[var(--c-ink-muted)]">Không tìm thấy.</div>
        )}
      </div>
    </Modal>
  );
}
