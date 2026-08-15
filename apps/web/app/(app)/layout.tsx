/**
 * (app)/layout.tsx — Layout cho khu vực có auth (Shell: sidebar + topbar + notification).
 *
 * Dùng server component để fetch session + permissions, truyền xuống client Shell.
 * Bỏ hoàn toàn Tablet thợ + Cổng lái xe (theo quyết định GĐ-B).
 */
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Pool } from 'pg';
import * as core from '@cencom/core';
import { ToastProvider } from '@/components/ui/Toast';
import Shell from '@/components/Shell';

interface NavItem {
  href: string;
  label: string;
}

async function getSessionInfo(
  token: string
): Promise<{
  navItems: NavItem[];
  userName: string;
  role: string;
  user: { id: string; name: string; role: string; username: string };
  perms: Record<string, string[]>;
}> {
  const pool = new Pool({ connectionString: process.env['DATABASE_URL'] });
  try {
    const userResult = await pool.query(
      `SELECT u.id, u.name, u.role FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = $1 AND s.expires_at > NOW()`,
      [token]
    );
    if (userResult.rows.length === 0)
      return { navItems: [], userName: '', role: '', user: { id: '', name: '', role: '', username: '' }, perms: {} };

    const { id, name, role } = userResult.rows[0];
    const db = core.createDb(core.makePgExecutor(pool));
    const perms = await core.perm.permsOfRole(db, role);

    const nav: NavItem[] = [{ href: '/dashboard', label: 'Bảng điều khiển' }];
    if (perms['sc']) nav.push({ href: '/sc', label: 'Phiếu sửa chữa' });
    if (perms['de_xuat']) nav.push({ href: '/de-xuat', label: 'Đề xuất sửa chữa' });
    if (perms['kho']) nav.push({ href: '/kho', label: 'Kho' });
    if (perms['kho']) nav.push({ href: '/thanhly', label: 'Thanh lý' });
    if (perms['mua']) nav.push({ href: '/baogia', label: 'Báo giá NCC' });
    if (perms['chat']) nav.push({ href: '/chat', label: 'Chat' });
    if (perms['asset']) nav.push({ href: '/asset', label: 'Tài sản' });
    if (role === 'admin') nav.push({ href: '/perm', label: 'Phân quyền' });
    if (role === 'admin') nav.push({ href: '/preview', label: 'Preview' });

    return {
      navItems: nav,
      userName: name || '',
      role: role || '',
      user: { id: id || '', name: name || '', role: role || '', username: name || '' },
      perms,
    };
  } finally {
    await pool.end();
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const token = cookies().get('cen_session')?.value;
  if (!token) redirect('/login');

  const { navItems, userName, role, user, perms } = await getSessionInfo(token);

  return (
    <ToastProvider>
      <Shell
        navItems={navItems}
        userName={userName}
        role={role}
        user={user}
        perms={perms}
        greet={core.welcome.greeting()}
        viDate={core.welcome.viDate()}
      >
        {children}
      </Shell>
    </ToastProvider>
  );
}
