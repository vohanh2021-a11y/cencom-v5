'use client';

/* W4.4 — Nút toggle dark/light trên topbar (port SVG + label từ v4
 * Topbar.tsx dòng 73–84; logic dark nằm trong ThemeProvider/DarkModeContext). */

import * as React from 'react';
import { useDarkMode } from './ThemeProvider';

export default function ThemeToggle() {
  const { dark, toggle } = useDarkMode();
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={toggle}
      aria-label={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      title={dark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
    >
      {dark ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v1m0 16v1M5.64 5.64l.7.7m11.66 11.66l.7.7M3 12h1m17 0h1M5.64 18.36l.7-.7m11.66-11.66l.7-.7"></path><circle cx="12" cy="12" r="5"></circle></svg>
      )}
    </button>
  );
}
