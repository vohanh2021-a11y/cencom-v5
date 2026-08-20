'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from './Shell';
import { useWorkspace, type WsId } from './WorkspaceContext';

const ICONS: Record<string, string> = {
  '/dashboard': '▦',
  '/sc': '🔧',
  '/kho': '📦',
  '/baogia': '🧾',
  '/thanhly': '♻',
  '/perm': '⚙',
  '/users': '👤',
  '/audit': '📜',
  '/ke-toan/dashboard': '📊',
  '/giamdoc': '👔',
  '/ho-so': '🗂',
};
// ARIA labels for icon-only sidebar on tablet
const ICON_LABELS: Record<string, string> = {
  '/dashboard': 'Bảng điều khiển',
  '/sc': 'Phiếu sửa chữa',
  '/kho': 'Kho',
  '/baogia': 'Báo giá NCC',
  '/thanhly': 'Thanh lý',
  '/perm': 'Phân quyền',
  '/users': 'Người dùng',
  '/audit': 'Nhật ký',
  '/ke-toan/dashboard': 'Kế toán',
  '/giamdoc': 'Giám đốc',
  '/ho-so': 'Hồ sơ',
};

/** Ánh xạ route → workspace (để sidebar chỉ hiện nhóm đang chọn). */
function routeToWs(href: string): WsId {
  if (href.startsWith('/ke-toan')) return 'ketoan';
  if (href.startsWith('/kho') || href.startsWith('/thanhly') || href.startsWith('/baogia')) return 'kho';
  if (href.startsWith('/perm') || href.startsWith('/users') || href.startsWith('/audit') || href.startsWith('/preview') || href.startsWith('/xe') || href.startsWith('/khach-hang')) return 'quantri';
  return 'xuong';
}

// (v5.0) Menu luôn hiển thị bất kể workspace đang chọn (đã lọc role ở server layout)
const PINNED_HREFS = new Set<string>(['/giamdoc', '/ho-so']);

const WS_LABEL: Record<WsId, string> = {
  xuong: 'Xưởng',
  kho: 'Kho & Mua',
  ketoan: 'Kế toán',
  quantri: 'Quản trị',
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
  const { ws } = useWorkspace();

  // Chỉ hiện các mục thuộc workspace đang chọn (R1: server đã lọc perms, ở đây ẩn cross-ws)
  // Menu PINNED (/giamdoc, /ho-so) luôn hiển thị vì đã lọc role ở server layout.
  const items = navItems.filter((it) => PINNED_HREFS.has(it.href) || routeToWs(it.href) === ws);

  function isActive(href: string): boolean {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname === href || pathname.startsWith(href + '/') || pathname.startsWith(href);
  }

  return (
    <aside className={'side' + (drawerOpen ? ' open' : '')} aria-label={`Điều hướng ${WS_LABEL[ws]}`}>
      <div className="logo">
        <div className="brand">
          <div className="mark">C</div>
          <div className="name">
            CencomOS-Garage
            <span>WS · {WS_LABEL[ws]}</span>
          </div>
        </div>
      </div>
      <nav>
        <div className="lbl">{WS_LABEL[ws]}</div>
        {items.length === 0 && <div className="lbl" style={{ opacity: 0.6 }}>Không có mục</div>}
        {items.map((it) => (
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
