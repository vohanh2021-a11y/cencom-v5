'use client';

/**
 * LogoutButton — Client Component (có event handler).
 * Dùng trong Topbar (Shell) để đăng xuất.
 */
export default function LogoutButton() {
  return (
    <button
      onClick={async () => {
        await fetch('/api/auth', { method: 'DELETE' });
        window.location.href = '/login';
      }}
      className="btn sm ghost"
    >
      Đăng xuất
    </button>
  );
}
