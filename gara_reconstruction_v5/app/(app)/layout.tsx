import Nav from '@/components/nav';
import { verifySession, SESSION_COOKIE } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * (app)/layout.tsx — Shell chung cho toàn bộ ứng dụng đã xác thực.
 * Bảo vệ toàn bộ route trong nhóm (app)/(app): nếu chưa có session hợp lệ
 * thì redirect /login (tránh vòng lặp vì /login nằm ngoài nhóm này).
 * Role guard sâu theo từng tính năng vẫn do RPC dispatch (perm) thực hiện;
 * layout chỉ gate "đã đăng nhập chưa".
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const actor = verifySession(token);
  if (!actor) redirect('/login');

  return (
    <div className="flex h-screen">
      <Nav role={actor.role} name={actor.name} />
      <main className="flex-1 overflow-y-auto p-6 bg-slate-50">{children}</main>
    </div>
  );
}
