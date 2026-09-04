import Nav from '@/components/nav';
import GlobalSearch from '@/components/GlobalSearch';
import NotificationCenter from '@/components/NotificationCenter';
import { ThemeProvider } from '@/components/ThemeProvider';
import { WorkspaceProvider } from '@/components/WorkspaceContext';
import WorkspaceTheme from '@/components/WorkspaceTheme';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import EditToggle from '@/components/EditToggle';
import ThemeToggle from '@/components/ThemeToggle';
import ReadOnlyGuard from '@/components/ReadOnlyGuard';
import AiChatDock from '@/components/AiChatDock';
import SyncStatus from '@/components/SyncStatus';
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
 *
 * W4-reg — mount GlobalSearch (W4.2) vào TOPBAR nhóm (app): thanh sticky
 * phía trên mọi trang đã đăng nhập, DESKTOP ONLY (`hidden lg:flex`) vì
 * mobile đã có header riêng của Nav (lg:hidden) — GlobalSearch ở đó do
 * components/nav.tsx mount; bảo đảm MỌI breakpoint có đúng MỘT ô tìm kiếm.
 *
 * W4.4 — ĐA WORKSPACE + THEME + PA1 (port kiến trúc v4 Shell.tsx):
 *  • ThemeProvider: chọn theme theo route ('/'=theme-dash Bold — dashboard
 *    v5 nằm ở '/' thay vì '/dashboard' như v4; còn lại theme-default Calm)
 *    + dark mode (.dark trên <html>, token trong globals.css).
 *  • WorkspaceProvider(role): ws theo pathname (?ws=/localStorage 'cen_ws'),
 *    gating theo MATRIX perms, chặn IDOR đổi ws ngoài quyền (R1).
 *  • WorkspaceTheme: áp data-ws + .view-only lên <body> (CSS isolate).
 *  • ReadOnlyGuard bọc <main>: điểm mount DUY NHẤT của guard — phủ toàn bộ
 *    trang nghiệp vụ (sc, sc/kanban, sc/[id], hoso, kho, kho/dm, xe,
 *    baogia, dashboard) thay vì wire từng trang (tương đương + rộng hơn yêu
 *    cầu 5 trang của task; zero xung đột file với các worker đang sửa page.
 *    PA1: backend không đổi, chỉ khóa thao tác UI khi giám đốc view-only).
 *  • Topbar desktop: WorkspaceSelector + EditToggle + ThemeToggle cạnh
 *    GlobalSearch; NotificationCenter (bell + badge, port v4) gắn cạnh
 *    GlobalSearch. Mobile: cùng bộ điều khiển mount trong Nav.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const actor = verifySession(token);
  if (!actor) redirect('/login');

  return (
    <ThemeProvider>
      <WorkspaceProvider role={actor.role}>
        <WorkspaceTheme />
        <div className="flex h-screen">
          <Nav role={actor.role} name={actor.name} />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="hidden shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-6 py-2 shadow-sm lg:flex">
              <WorkspaceSelector />
              <EditToggle />
              <span className="flex-1" />
              <GlobalSearch className="w-full max-w-md" />
              <NotificationCenter />
              <ThemeToggle />
            </header>
            <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <ReadOnlyGuard>{children}</ReadOnlyGuard>
            </main>
          </div>
        </div>
        <AiChatDock />
        <SyncStatus />
      </WorkspaceProvider>
    </ThemeProvider>
  );
}
