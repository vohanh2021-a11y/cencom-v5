/**
 * app/in/layout.tsx — W4.3: khung trang IN A4 (portrait).
 * CSS in đặt trong ./print.css (import trực tiếp để Next pipeline xử lý —
 * không dùng dangerouslySetInnerHTML). Mỗi .a4 = 1 trang in; toolbar ẩn khi in.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './print.css';

export const metadata: Metadata = {
  title: 'In chứng từ — cencomOS Gara',
  description: 'In HTML A4 8 mẫu phiếu gara (port v3.6 in.js)',
  robots: { index: false, follow: false },
};

export default function InLayout({ children }: { children: ReactNode }) {
  // Root layout (app/layout.tsx) tự bọc quanh layout này.
  return <div className="print-root">{children}</div>;
}
