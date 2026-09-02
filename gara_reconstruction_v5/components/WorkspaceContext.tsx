'use client';

/* ============================================================================
 * W4.4 — Đa không gian làm việc (port v4 apps/web/components/WorkspaceContext.tsx)
 *
 * NGUỒN: apps/web (v4). KHÁC BIỆT có chủ đích so với v4 (không phải v3.6):
 *  1. v4 có 4 ws: xuong | kho | ketoan | quantri. v5 CHƯA có trang kế toán
 *     (không có route /ke-toan) và CHƯA có trang quản trị (không có
 *     /perm,/users,/audit,/preview,/khach-hang) → PORT 2 ws thật sự khả dụng:
 *     'xuong' | 'kho'. Đã đối chiếu VIEWS mapping v3.6 (client/index.html:505):
 *     sc/tk/hoso → dây chuyềngara; dm/vattu/nhap-xuat-kho/baogia/thanhly → kho.
 *     'ketoan'/'quantri' sẽ được thêm lại khi trang tương ứng port xong
 *     (giữ nguyên id v4 để khỏi đổi localStorage 'cen_ws' về sau).
 *  2. v4 đọc session qua SessionContext (useSession). v5 KHÔNG có
 *     SessionContext (layout server tự verify cookie → truyền role/perm
 *     xuống props) → provider nhận `role` bắt buộc + `perms` tùy chọn.
 *  3. Quyền vào ws: như v4, admin/giamdoc vào tất cả; vai khác xét module
 *     non-trống. v4 tra `perms` fetch từ DB; v5 layout không fetch perms
 *     mỗi render → fallback tra MATRIX tĩnh (lib/perm.ts — constants
 *     client-safe, không import server code). Nếu caller truyền `perms`
 *     thì ưu tiên perms (giữ đúng signature v4).
 *
 * PA1 (view-only giám đốc): backend KHÔNG đổi — can()/RPC giữ nguyên;
 * chỉ UI khóa thao tác. editMode = (role !== 'giamdoc') port nguyên v4.
 * ========================================================================== */

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { MATRIX } from '@/lib/perm';

export type WsId = 'xuong' | 'kho';

export interface WsMeta {
  id: WsId;
  label: string;
  icon: string;
  /** route prefix để xác định workspace hiện tại từ pathname */
  prefix: string;
  /** các module (khóa trong MATRIX/perms) quyết định user có quyền vào ws này không */
  modules: string[];
  /** admin-only workspace (v4 giữ cho 'quantri'; v5 chưa dùng tới) */
  adminOnly?: boolean;
}

export const WORKSPACES: WsMeta[] = [
  // sc['duy'|...], xe, hoso = dây chuyền sửa chữa (v4: xuong = sc/de_xuat/asset/xe
  // → v5 chưa có de_xuat+asset riêng nên modules = sc/xe/hoso theo MATRIX v5).
  { id: 'xuong', label: 'Xưởng', icon: '🔧', prefix: '/sc', modules: ['sc', 'de_xuat', 'asset', 'xe', 'hoso'] },
  // kho + dm + mua + baogia (v4: baogia/thanhly → kho; v5 thêm module 'dm' của MATRIX kho-role).
  { id: 'kho', label: 'Kho & Mua', icon: '📦', prefix: '/kho', modules: ['kho', 'mua', 'baogia', 'dm'] },
];

/** Map pathname → workspace. Port v4 wsFromPath, cắt các prefix v5 chưa có
 *  (ke-toan/perm/users/audit/preview/khach-hang). /xe → XƯỞNG (v4 đưa /xe về
 *  'quantri' vì ở v4 /xe là khách hàng-tài sản; ở v5 /xe là hồ sơ xe gắn
 *  nghiệp vụ xưởng — module 'xe' thuộc nhóm xưởng, đúng theo WORKSPACES v4
 *  dòng 22: xuong.modules chứa 'xe'). Everything else (/, /sc*, /hoso) → xuong. */
function wsFromPath(pathname: string): WsId {
  if (pathname.startsWith('/kho') || pathname.startsWith('/baogia') || pathname.startsWith('/thanhly')) return 'kho';
  return 'xuong';
}

/** Kiểm tra role có module nào non-trong danh sách ws.modules.
 *  perms (nếu được truyền) thắng — giữ đúng ngữ nghĩa v4; ngược lại fallback
 *  MATRIX tĩnh (client-safe). */
function hasModule(
  role: string,
  perms: Record<string, string[]> | undefined,
  m: string
): boolean {
  if (perms) return Array.isArray(perms[m]) && perms[m].length > 0;
  const rm = MATRIX[role];
  return !!rm && Array.isArray(rm[m]) && (rm[m] as string[]).length > 0;
}

function canAccessWs(
  ws: WsMeta,
  role: string | undefined,
  perms: Record<string, string[]> | undefined
): boolean {
  const r = role || '';
  if (r === 'admin') return true;
  if (ws.adminOnly) return false; // admin-only (v5: chưa có ws nào, giữ cơ chế v4)
  if (r === 'giamdoc') return true; // giám đốc xem tất cả (trừ admin-only)
  return ws.modules.some((m) => hasModule(r, perms, m));
}

export interface WorkspaceValue {
  ws: WsId;
  setWs: (w: WsId) => void;
  allowed: WsMeta[];
  /** giám đốc mặc định false; các role khác mặc định true (PA1 — port v4) */
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  toggleEditMode: () => void;
  /** có nên hiển thị nút bật chỉnh sửa không (chỉ giám đốc) */
  canToggleEdit: boolean;
}

const Ctx = React.createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({
  children,
  role,
  perms,
}: {
  children: React.ReactNode;
  /** role từ session server (verifySession) — v5 không có SessionContext nên bắt buộc truyền */
  role: string;
  perms?: Record<string, string[]>;
}) {
  const r = role;
  const p = perms;

  const allowed = React.useMemo(
    () => WORKSPACES.filter((w) => canAccessWs(w, r, p)),
    [r, p]
  );

  const [ws, setWsState] = React.useState<WsId>('xuong');
  const [editMode, setEditModeState] = React.useState<boolean>(r !== 'giamdoc');
  const pathname = usePathname();

  // Đồng bộ ws theo đường dẫn hiện tại (chuyển trang → chuyển workspace tương ứng)
  React.useEffect(() => {
    const fromPath = wsFromPath(pathname);
    if (allowed.find((w) => w.id === fromPath)) setWsState(fromPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, allowed.length]);

  // Khởi tạo ws từ URL (?ws=) hoặc localStorage; nếu không hợp lệ → theo pathname
  React.useEffect(() => {
    const url = new URLSearchParams(window.location.search).get('ws');
    const stored = window.localStorage.getItem('cen_ws');
    const initial =
      (url && WORKSPACES.find((w) => w.id === url)?.id) ||
      (stored && WORKSPACES.find((w) => w.id === stored)?.id) ||
      wsFromPath(window.location.pathname);
    setWsState((prev) => (allowed.find((w) => w.id === initial) ? (initial as WsId) : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed.length]);

  const setWs = React.useCallback(
    (w: WsId) => {
      if (!allowed.find((x) => x.id === w)) return; // R1: chặn chuyển ws không được phép (IDOR)
      setWsState(w);
      window.localStorage.setItem('cen_ws', w);
      const url = new URL(window.location.href);
      url.searchParams.set('ws', w);
      window.history.replaceState({}, '', url.toString());
    },
    [allowed]
  );

  const setEditMode = React.useCallback((v: boolean) => setEditModeState(v), []);
  const toggleEditMode = React.useCallback(() => setEditModeState((v) => !v), []);

  const value: WorkspaceValue = {
    ws,
    setWs,
    allowed,
    editMode,
    setEditMode,
    toggleEditMode,
    canToggleEdit: r === 'giamdoc',
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const v = React.useContext(Ctx);
  if (!v) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return v;
}
