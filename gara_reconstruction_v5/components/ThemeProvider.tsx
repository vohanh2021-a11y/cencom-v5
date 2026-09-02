'use client';

/* ============================================================================
 * W4.4 —_port v4 apps/web/components/ThemeProvider.tsx
 *
 * Hai adaptation theo route v5 (KHÔNG đổi hành vi dark-mode):
 *  1. v4: '/home'→theme-home, '/dashboard'→theme-dash, còn lại theme-default.
 *     v5: dashboard nằm ở '/' (app/(app)/page.tsx) → '/': 'theme-dash'.
 *     Giữ nhánh '/home' nguyên văn cho ngày port trang chủ v5 (hiện vô hại).
 *  2. v4 bọc bằng <div className={theme} style={{minHeight:'100%'}}> — giữ.
 *
 * Dark mode: đọc localStorage 'theme'/prefers-color-scheme, áp .dark lên
 * <html> trong effect (không phải lúc render → không hydration-mismatch,
 * giống v4). CSS token .dark port sang app/globals.css.
 * ========================================================================== */

import * as React from 'react';
import { usePathname } from 'next/navigation';

// Dark mode context
const DarkModeContext = React.createContext<{
  dark: boolean;
  toggle: () => void;
}>({ dark: false, toggle: () => {} });

// Hook to use dark mode
export function useDarkMode() {
  return React.useContext(DarkModeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const theme =
    path === '/home' ? 'theme-home' : path === '/' ? 'theme-dash' : 'theme-default';

  // Persist dark mode preference in localStorage
  const [dark, setDark] = React.useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
      // Default: respect system preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  // Apply .dark class to <html> element
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.classList.toggle('dark', dark);
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    }
  }, [dark]);

  const toggle = () => setDark((d) => !d);

  return (
    <DarkModeContext.Provider value={{ dark, toggle }}>
      <div className={theme} style={{ minHeight: '100%' }}>
        {children}
      </div>
    </DarkModeContext.Provider>
  );
}
