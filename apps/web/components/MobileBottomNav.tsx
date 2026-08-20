'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWorkspace } from './WorkspaceContext';
import { useSession } from './SessionContext';
import { KHO_NAV, KETOAN_NAV, XUONG_NAV } from '@/lib/nav-items';

const NAV_BY_WS: Record<string, { href: string; label: string; perm?: string }[]> = {
  xuong: XUONG_NAV,
  kho: KHO_NAV,
  ketoan: KETOAN_NAV,
};

const FAB_LABEL: Record<string, { href: string; label: string }> = {
  xuong: { href: '/sc/create', label: 'Tạo phiếu sửa' },
};

/** Bottom navigation + FAB chỉ hiển thị trên mobile (CSS max-width). Dành cho thao tác nhanh theo workspace. */
export default function MobileBottomNav() {
  const { ws } = useWorkspace();
  const session = useSession();
  const { perms } = session;
  const isAdmin = session.role === 'admin';
  const pathname = usePathname();
  const items = NAV_BY_WS[ws] || [];
  const visible = items.filter((it) => !it.perm || isAdmin || (perms && (perms[it.perm]?.length ?? 0) > 0));
  const fab = FAB_LABEL[ws];

  // (v5.0) Menu luôn hiển thị trên mobile có gating role (như bên desktop)
  const ROLE_PINNED: { href: string; label: string; roles: string[] }[] = [
    { href: '/giamdoc', label: 'Giám đốc', roles: ['giamdoc', 'admin'] },
    { href: '/ho-so', label: 'Hồ sơ', roles: ['ketoan', 'giamdoc', 'xuong', 'kho', 'admin'] },
  ];
  const pinned = ROLE_PINNED.filter((it) => it.roles.includes(session.role));
  const allItems = [...visible, ...pinned];

  if (allItems.length === 0) return null;

  return (
    <>
<nav className="bottom-nav flex sm:hidden fixed bottom-0 left-0 right-0 h-14 items-center justify-around bg-card border-t border-border z-40 safe-area-inset-bottom">
  {allItems.map((it) => {
    const active = pathname === it.href || pathname.startsWith(it.href + '/');
    return (
      <Link key={it.href} href={it.href} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
        <span className="bn-label">{it.label}</span>
      </Link>
    );
  })}
</nav>
{fab && (
  <Link href={fab.href} className="fab flex sm:hidden fixed bottom-4 right-4 z-40 h-12 w-12 items-center justify-center rounded-full shadow-lg bg-primary text-primary-foreground" aria-label={fab.label}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  </Link>
)}
    </>
  );
}
