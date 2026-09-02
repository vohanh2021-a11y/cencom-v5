/**
 * app/(app)/sc/[id]/page.tsx — W4-reg · deep-link chi tiết phiếu `/sc/<mã>`.
 *
 * Bối cảnh: GlobalSearch (W4.2) điều hướng kết quả SC theo hợp đồng
 * `/sc/${ma}` (components/GlobalSearch.tsx:143, header dòng 16–19 ghi rõ
 * "chờ wave reg route"). Component chi tiết (ScDetailModal) SỐNG TRONG
 * app/(app)/sc/page.tsx (client, state modalId) — tách riêng là rewrite
 * 1.000+ dòng UI, ngoài phạm vi reg. Giải pháp tối thiểu: server component
 * đọc params.id (Next 14 — params plain object), sanitize, rồi RENDER CHÍNH
 * ScPage client với prop `initialId` → danh sách tải như thường + modal bật
 * ngay theo mã. Close modal → router.replace('/sc') (đóng 'deep-link' trở
 * lại list — xem sc/page.tsx closeModal).
 *
 * Bảo mật: route nhóm (app) đã gate đăng nhập (layout verifySession); quyền
 * đọc phiếu do dispatch scGet ['sc','xem'] enforce — id rác chỉ nhận envelope
 * lỗi từ core (scGet validate existence), không phải chỗ tin params client.
 * Whitelist ký tự id [A-Za-z0-9_-]{1,12} theo chuẩn VARCHAR(12) 'PREFIX-000001'
 * — mã ngoài khuôn → KHÔNG mở modal (trang hiện list, không nổ).
 */
import ScPage from '../page';

export default function ScDetailByCodePage({ params }: { params: { id?: string } }) {
  const raw = String(params?.id ?? '');
  const safe = /^[A-Za-z0-9_-]{1,12}$/.test(raw) ? raw : null;
  return <ScPage initialId={safe} />;
}
