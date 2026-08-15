'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import LogoutButton from '@/components/ui/LogoutButton';
import { useDarkMode } from '@/components/ThemeProvider';

const TITLES: Record<string, string> = {
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

export default function Topbar({
  userName,
  role,
  onMenu,
  onNotif,
  notifOpen,
  badge,
}: {
  userName: string;
  role: string;
  onMenu: () => void;
  onNotif: () => void;
  notifOpen: boolean;
  badge: number;
}) {
  const pathname = usePathname();
  const title = TITLES[pathname] || 'CencomOS';
  const { dark, toggle } = useDarkMode();

  return (
    <header className="topbar">
      <button className="menu-btn" onClick={onMenu} aria-label="Mở menu">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
      </button>
      <h1>{title}</h1>
      <span className="grow" />
      <span className="who-chip" title={role || userName}>
        {userName}
      </span>
      <button
        className="btn sm"
        onClick={toggle}
        aria-label={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
        title={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      >
        {dark ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v1m0 16v1M5.64 5.64l.7.7m11.66 11.66l.7.7M3 12h1m17 0h1M5.64 18.36l.7-.7m11.66-11.66l.7-.7"></path><circle cx="12" cy="12" r="5"></circle></svg>
        )}
      </button>
      <button
        className="btn sm"
        onClick={onNotif}
        aria-expanded={notifOpen}
        aria-label="Thông báo"
        style={{ position: 'relative' }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        {badge > 0 && <span className="notif-badge">{badge}</span>}
      </button>
      <LogoutButton />
    </header>
  );
}
