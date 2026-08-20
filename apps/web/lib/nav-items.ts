import type { SubNavItem } from '@/components/SubNav';

export const KETOAN_NAV: SubNavItem[] = [
  { href: '/ke-toan/dashboard', label: 'Tổng quan' },
  { href: '/ke-toan/nhap-vat', label: 'Nhập / VAT', perm: 'ke_toan' },
  { href: '/ke-toan/cong-no', label: 'Công nợ NCC', perm: 'ke_toan' },
  { href: '/ke-toan/bao-cao', label: 'Báo cáo', perm: 'ke_toan' },
  { href: '/ke-toan/khoa-ky', label: 'Khóa kỳ', perm: 'ke_toan' },
];

export const KHO_NAV: SubNavItem[] = [
  { href: '/kho', label: 'Tồn kho' },
  { href: '/kho/dm', label: 'Danh mục VT', perm: 'kho' },
  { href: '/kho/nhap', label: 'Nhập kho', perm: 'kho' },
  { href: '/kho/xuat', label: 'Xuất kho', perm: 'kho' },
];

export const XUONG_NAV: SubNavItem[] = [
  { href: '/sc', label: 'Phiếu sửa' },
  { href: '/sc/kanban', label: 'Kanban' },
  { href: '/xe', label: 'Xe' },
];
