'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import GlobalSearch from '@/components/GlobalSearch';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import EditToggle from '@/components/EditToggle';

interface NavProps {
  role: string;
  name: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const MENU: Record<string, NavItem[]> = {
  // 'Mua sắm' (/kho/dm) — W2.6. Trang xem/duyệt DM đề nghị mua, fn dmList
  // mang meta ['kho','xem'] (MATRIX: kho/giamdoc/xuong cùng có kho:xem; admin
  // bypass all). Hiện cho kho|giamdoc|admin|xuong; KHÔNG hiện cho ketoan
  // (nghiệp vụ mua sắm thuộc kho — ketoan vẫn có kho:xem nhưng link chủ
  // đích giới hạn theo plan, tránh rối menu).
  //
  // 'Bảng xe' (/sc/kanban) — W3.8. Cổng thật của fn dashboardAll: sc.xem +
  // CHẶN CỨNG ketoan ngay trong core (lib/core/xuong.ts — port v3.6). Nên
  // link hiện đúng cho admin|giamdoc|xuong|kho (MATRIX sc.xem + admin bypass;
  // 'kho' có sc.xem → VÀO ĐƯỢC dashboard, lệch v3.6 có chủ đích đã ghi ở
  // header xuong.ts). KETOAN KHÔNG CÓ LINK — không phải vì UI tự suy diễn mà
  // vì core trả 403: để link sẽ bấm-vào-màn-'Không-có-quyền' vô nghĩa.
  giamdoc: [
    { label: 'Dashboard', href: '/', icon: '📊' },
    { label: 'SC', href: '/sc', icon: '📋' },
    { label: 'Bảng xe', href: '/sc/kanban', icon: '🚛' },
    { label: 'Báo giá', href: '/baogia', icon: '💰' },
    { label: 'Hồ sơ', href: '/hoso', icon: '📁' },
    { label: 'Kho', href: '/kho', icon: '🔧' },
    { label: 'Mua sắm', href: '/kho/dm', icon: '🛒' },
  ],
  kho: [
    { label: 'Kho', href: '/kho', icon: '🔧' },
    { label: 'Mua sắm', href: '/kho/dm', icon: '🛒' },
    { label: 'Xe', href: '/xe', icon: '🚛' },
    { label: 'Bảng xe', href: '/sc/kanban', icon: '📊' },
  ],
  xuong: [
    { label: 'SC', href: '/sc', icon: '📋' },
    { label: 'Bảng xe', href: '/sc/kanban', icon: '🚛' },
    { label: 'Mua sắm', href: '/kho/dm', icon: '🛒' },
    { label: 'Xe', href: '/xe', icon: '🚛' },
  ],
  ketoan: [
    { label: 'Báo giá', href: '/baogia', icon: '💰' },
    { label: 'Hồ sơ', href: '/hoso', icon: '📁' },
    { label: 'SC', href: '/sc', icon: '📋' },
  ],
  admin: [
    { label: 'Dashboard', href: '/', icon: '📊' },
    { label: 'SC', href: '/sc', icon: '📋' },
    { label: 'Bảng xe', href: '/sc/kanban', icon: '🚛' },
    { label: 'Báo giá', href: '/baogia', icon: '💰' },
    { label: 'Hồ sơ', href: '/hoso', icon: '📁' },
    { label: 'Kho', href: '/kho', icon: '🔧' },
    { label: 'Mua sắm', href: '/kho/dm', icon: '🛒' },
    { label: 'Xe', href: '/xe', icon: '🚛' },
  ],
};

const ROLE_LABEL: Record<string, string> = {
  giamdoc: 'Giám đốc',
  kho: 'Kho',
  xuong: 'Xưởng',
  ketoan: 'Kế toán',
  admin: 'Quản trị',
};

export default function Nav({ role, name }: NavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = MENU[role] ?? [];

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
    } catch {
      // bỏ qua lỗi mạng; vẫn chuyển hướng
    }
    window.location.href = '/login';
  };

  const linkCls = (href: string) =>
    'flex items-center rounded px-3 py-2 text-sm font-medium transition-colors ' +
    (isActive(href)
      ? 'bg-blue-50 text-blue-700'
      : 'text-slate-600 hover:bg-slate-100');

  return (
    <>
      {/*
        W4-reg — thanh mobile topbar (lg:hidden): Nav là chủ header trên mobile,
        nên GlobalSearch mount ở ĐÂY cho breakpoint nhỏ (layout.tsx giữ bản
        desktop `hidden lg:flex` — không bao giờ hiện đồng thời 2 ô search).

        W4.4 — cùng chỗ này mount WorkspaceSelector + EditToggle (bản mobile
        của bộ điều khiển v4 Topbar): theme/ws-switch + chế độ xem/sửa của
        giám đốc phải đổi được trên điện thoại, không chỉ desktop.
      */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold">CencomOS v5.0</span>
          <span className="flex items-center gap-2">
            <WorkspaceSelector />
            <EditToggle />
          </span>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Đóng điều hướng' : 'Mở điều hướng'}
            className="rounded p-2 text-slate-600 hover:bg-slate-100"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={
                  open
                    ? 'M6 18L18 6M6 6l12 12'
                    : 'M4 6h16M4 12h16M4 18h16'
                }
              />
            </svg>
          </button>
        </div>
        <div className="mt-2" data-testid="mobile-global-search">
          <GlobalSearch />
        </div>
      </div>

      <nav
        className={
          'fixed inset-y-0 left-0 z-40 w-60 -translate-x-full border-r border-slate-200 bg-white p-4 transition-transform lg:translate-x-0 lg:static lg:z-auto ' +
          (open ? 'translate-x-0' : '')
        }
        aria-label="Điều hướng"
      >
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🚛</span>
            <span className="font-bold text-base" style={{ color: 'var(--c-primary)' }}>CencomOS</span>
          </div>
          <div className="text-xs font-semibold uppercase" style={{ color: 'var(--c-ink-muted)' }}>
            {ROLE_LABEL[role] ?? role}
          </div>
          <div className="mt-1 font-semibold" style={{ color: 'var(--c-ink)' }}>{name}</div>
        </div>

        <div className="space-y-1">
          {items.map((item) => (
            <Link
              key={item.label + item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={linkCls(item.href)}
            >
              <span className="mr-2 text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 w-full rounded px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Đăng xuất
          </button>
        </div>
      </nav>
    </>
  );
}
