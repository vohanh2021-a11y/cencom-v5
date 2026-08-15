'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from './Shell';

const ICONS: Record<string, string> = {
  '/dashboard': '▦',
  '/sc': '🔧',
  '/de-xuat': '📝',
  '/kho': '📦',
  '/chat': '💬',
  '/asset': '💰',
  '/baogia': '🧾',
  '/thanhly': '♻',
  '/perm': '⚙',
  '/preview': '🔎',
};
// ARIA labels for icon-only sidebar on tablet
const ICON_LABELS: Record<string, string> = {
  '/dashboard': 'Bảng điều khiển',
  '/sc': 'Phiếu sửa chữa',
  '/de-xuat': 'Đề xuất sửa chữa',
  '/kho': 'Kho',
  '/chat': 'Chat',
  '/asset': 'Tài sản',
  '/baogia': 'Báo giá NCC',
  '/thanhly': 'Thanh lý',
  '/perm': 'Phân quyền',
  '/preview': 'Preview',
};

export default function Sidebar({
  navItems,
  drawerOpen,
  onClose,
}: {
  navItems: NavItem[];
  drawerOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/') || pathname.startsWith(href);
  }

  return (
    <aside className={'side' + (drawerOpen ? ' open' : '')} aria-label="Điều hướng chính">
      <div className="logo">
        <div className="brand">
          <div className="mark">C</div>
          <div className="name">
            CencomOS-Garage
            <span>Gđ4 · Gara &amp; Tài sản</span>
          </div>
        </div>
      </div>
      <nav>
        {navItems.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={isActive(it.href) ? 'active' : ''}
            onClick={onClose}
            aria-label={ICON_LABELS[it.href] || it.label}
          >
            <span className="ic" aria-hidden="true">{ICONS[it.href] || '•'}</span>
            <span>{it.label}</span>
          </Link>
        ))}
      </nav>
      <div className="foot">
        <b>cencomOS gara 4.0</b>
        <br />
        Hệ thống quản lý gara đầu kéo
      </div>
    </aside>
  );
}
