'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import NotificationCenter, { type NotifData } from './NotificationCenter';
import SkipLink from './SkipLink';
import { ThemeProvider } from './ThemeProvider';
import { CommandPalette } from './CommandPalette';
import { SessionContext, type SessionUser } from './SessionContext';

export interface NavItem {
  href: string;
  label: string;
}

export interface ShellProps {
  navItems: NavItem[];
  userName: string;
  role: string;
  user?: SessionUser;
  perms?: Record<string, string[]>;
  greet: string;
  viDate: { thu: string; ngay: string; gio: string };
  children: React.ReactNode;
}

export default function Shell({ navItems, userName, role, user, perms, greet, viDate, children }: ShellProps) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [data, setData] = React.useState<{ stats?: Record<string, number> } | null>(null);
  const [badge, setBadge] = React.useState(0);
  const pathname = usePathname();

  // Đóng drawer khi chuyển trang
  React.useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lấy dữ liệu thông báo (welcomeData) — badge tổng hợp các việc cần chú ý
  React.useEffect(() => {
    let active = true;
    fetch('/api/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fn: 'welcomeData', args: {} }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (active && d && d.ok) {
          const res = (d.result || {}) as { stats?: Record<string, number> };
          setData(res);
          const s = res.stats || {};
          const n =
            (s.scChoDuyet || 0) +
            (s.dmChoDuyet || 0) +
            (s.dxChoDuyet || 0) +
            (s.chatUnread || 0) +
            (s.lowTon || 0);
          setBadge(n);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-[var(--c-bg)]">
      <SkipLink />
      <Sidebar navItems={navItems} drawerOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="main">
        <Topbar
          userName={userName}
          role={role}
          onMenu={() => setDrawerOpen(true)}
          onNotif={() => setNotifOpen((v) => !v)}
          notifOpen={notifOpen}
          badge={badge}
        />
        <main id="main-content" className="flex-1 overflow-auto">
          <SessionContext.Provider value={{ user, role, perms }}>
            <ThemeProvider>{children}</ThemeProvider>
          </SessionContext.Provider>
        </main>
      </div>
      <NotificationCenter
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        data={{ ...(data as NotifData), greet, viDate }}
      />
      <div
        className={'scrim' + (drawerOpen ? ' show' : '')}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />
      <CommandPalette />
    </div>
  );
}
