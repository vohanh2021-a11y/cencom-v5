'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface NavProps {
  role: string;
  name: string;
}

interface NavItem {
  label: string;
  href: string;
}

const MENU: Record<string, NavItem[]> = {
  giamdoc: [
    { label: 'Dashboard', href: '/' },
    { label: 'SC', href: '/sc' },
    { label: 'Báo giá', href: '/baogia' },
    { label: 'Hồ sơ', href: '/hoso' },
    { label: 'Kho', href: '/kho' },
  ],
  kho: [
    { label: 'Kho', href: '/kho' },
    { label: 'Xe', href: '/xe' },
  ],
  xuong: [
    { label: 'SC', href: '/sc' },
    { label: 'Xe', href: '/xe' },
  ],
  ketoan: [
    { label: 'Báo giá', href: '/baogia' },
    { label: 'Hồ sơ', href: '/hoso' },
    { label: 'SC', href: '/sc' },
  ],
  admin: [
    { label: 'Dashboard', href: '/' },
    { label: 'SC', href: '/sc' },
    { label: 'Báo giá', href: '/baogia' },
    { label: 'Hồ sơ', href: '/hoso' },
    { label: 'Kho', href: '/kho' },
    { label: 'Xe', href: '/xe' },
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
    'block rounded px-3 py-2 text-sm font-medium transition-colors ' +
    (isActive(href)
      ? 'bg-blue-50 text-blue-700'
      : 'text-slate-600 hover:bg-slate-100');

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 border-b border-slate-200 bg-white px-4 py-2 flex items-center justify-between">
        <span className="font-semibold">CencomOS v5.0</span>
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

      <nav
        className={
          'fixed inset-y-0 left-0 z-40 w-60 -translate-x-full border-r border-slate-200 bg-white p-4 transition-transform lg:translate-x-0 lg:static lg:z-auto ' +
          (open ? 'translate-x-0' : '')
        }
        aria-label="Điều hướng"
      >
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase text-slate-400">
            {ROLE_LABEL[role] ?? role}
          </div>
          <div className="mt-1 font-semibold text-slate-800">{name}</div>
        </div>

        <div className="space-y-1">
          {items.map((item) => (
            <Link
              key={item.label + item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={linkCls(item.href)}
            >
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
