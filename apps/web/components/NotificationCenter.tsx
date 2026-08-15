'use client';

import * as React from 'react';

export interface NotifData {
  stats?: Record<string, number>;
  greet?: string;
  viDate?: { thu: string; ngay: string; gio: string };
}

export default function NotificationCenter({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: NotifData | null;
}) {
  if (!open) return null;

  const d = data || {};
  const stats = d.stats || {};
  const items: Array<[string, number]> = [
    ['Phiếu sửa chữa chờ duyệt', stats.scChoDuyet || 0],
    ['Đang sửa / chờ nghiệm', (stats.scDang || 0) + (stats.scChoNghiem || 0)],
    ['Đề xuất chờ duyệt', stats.dxChoDuyet || 0],
    ['Đề nghị mua chờ duyệt', stats.dmChoDuyet || 0],
    ['Vật tư tồn thấp', stats.lowTon || 0],
    ['Chat chưa đọc', stats.chatUnread || 0],
  ];

  return (
    <div className="notif-panel" role="dialog" aria-label="Thông báo">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px' }}>
        <strong style={{ fontSize: 13, color: 'var(--c-ink)' }}>Thông báo</strong>
        <button
          onClick={onClose}
          aria-label="Đóng"
          style={{ border: 'none', background: 'transparent', fontSize: 16, cursor: 'pointer', color: 'var(--c-ink-muted)' }}
        >
          ×
        </button>
      </div>
      {d.greet && (
        <div style={{ fontSize: 12, color: 'var(--c-ink-muted)', padding: '0 8px 6px' }}>
          {d.greet}
          {d.viDate ? ` · ${d.viDate.thu}, ${d.viDate.ngay}` : ''}
        </div>
      )}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.map(([label, n]) => (
          <li
            key={label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              padding: 8,
              borderTop: '1px solid var(--c-line)',
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--c-ink)' }}>{label}</span>
            <span style={{ fontWeight: 800, color: n > 0 ? '#E0332E' : 'var(--c-ink-muted)' }}>{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
