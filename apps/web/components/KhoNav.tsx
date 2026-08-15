import Link from 'next/link';

export function KhoNav() {
  const items = [
    { href: '/kho', label: 'Tồn kho' },
    { href: '/kho/dm', label: 'Đề nghị mua' },
    { href: '/kho/nhap', label: 'Phiếu nhập' },
    { href: '/kho/xuat', label: 'Phiếu xuất' },
  ];
  return (
    <div className="flex gap-1 mb-2 flex-wrap">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className="btn btn-ghost btn-sm">
          {i.label}
        </Link>
      ))}
    </div>
  );
}
