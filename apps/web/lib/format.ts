export function fmtMoney(n: number): string {
  const v = Number(n) || 0;
  if (!isFinite(v)) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(v);
}
