// Nhãn trạng thái phiếu sửa chữa (client-safe, đồng bộ core/sc.ts TT_LABEL).
export const TT_LABEL: Record<string, string> = {
  de_xuat: 'Đề xuất',
  da_duyet: 'Đã duyệt',
  da_tong_duyet: 'Đã tổng duyệt',
  dang_sua: 'Đang sửa',
  cho_nghiem: 'Chờ nghiệm thu',
  da_hoan: 'Hoàn thành',
  da_quyet: 'Đã quyết toán',
  tu_choi: 'Từ chối',
};

export function ttLabel(tt: string | undefined): string {
  if (!tt) return '';
  return TT_LABEL[tt] || tt;
}
