import './globals.css';
import type { ReactNode } from 'react';
import PwaRegister from '../components/PwaRegister';

export const metadata = {
  title: 'CencomOS Gara v5.0',
  description: 'Hệ thống quản lý & giám sát xe đầu kéo — greenfield, PostgreSQL thuần.',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
