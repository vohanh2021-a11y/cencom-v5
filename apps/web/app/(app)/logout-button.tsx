'use client';

/**
 * LogoutButton — Client Component (có event handler).
 * Dùng trong (app)/layout.tsx (Server Component) để tránh lỗi
 * "Event handlers cannot be passed to Client Component props".
 */
export default function LogoutButton() {
  return (
    <button
      onClick={async () => {
        await fetch('/api/auth', { method: 'DELETE' });
        window.location.href = '/login';
      }}
      className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:text-white"
    >
      Đăng xuất
    </button>
  );
}
