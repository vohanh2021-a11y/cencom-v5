'use client';

/* ============================================================================
 * W4.4 —_port v4 apps/web/components/ReadOnlyGuard.tsx
 *
 * API GIỮ NGUYÊN 100% (children + className, khóa thao tác khi !editMode).
 * MỘT điều chỉnh TÀI LIỆU HÓA duy nhất (UI, không phải logic nghiệp vụ):
 * JS原本是 disable MỌI input/button → mâu thuẫn với chính CSS view-only của
 * v4 (globals.css dòng 444: input[type=search], .excel-search, [readonly]
 * được LOẠI TRỪ pointer-events). v5 bổ sung cùng bộ lọc vào JS để hành vi
 * JS↔CSS NHẤT QUÁN: ô tìm kiếm/lọc dùng để XEM vẫn hoạt động khi view-only,
 * mọi điều khiển THAO TÁC khác vẫn khóa đúng PA1.
 * ========================================================================== */

import * as React from 'react';
import { useWorkspace } from './WorkspaceContext';

/** Selector phần tử BẢO TOÀN khi view-only: theo đúng ngoại lệ CSS v4. */
const VIEW_SAFE = 'input[type=search], .excel-search, [readonly]';

/**
 * Bao bọc vùng form/action. Khi view-only (giám đốc chưa bật chỉnh sửa):
 * - vô hiệu hóa mọi input/select/textarea/button bên trong
 * - ẩn các nút có class `edit-action`
 * Theo PA1: backend KHÔNG đổi (can() giữ nguyên), UI không gửi POST khi view-only.
 */
export default function ReadOnlyGuard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { editMode } = useWorkspace();
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (editMode || !ref.current) return;
    const els = Array.from(
      ref.current.querySelectorAll<HTMLElement>('input,select,textarea,button')
    ).filter((el) => !el.classList.contains('edit-action') && !el.closest(VIEW_SAFE));
    els.forEach((el) => {
      if (el.classList.contains('edit-action')) return;
      el.setAttribute('data-ro-disabled', '1');
      if (
        el instanceof HTMLButtonElement ||
        el instanceof HTMLInputElement ||
        el instanceof HTMLSelectElement ||
        el instanceof HTMLTextAreaElement
      ) {
        el.disabled = true;
      }
    });
    return () => {
      els.forEach((el) => {
        el.removeAttribute('data-ro-disabled');
        if (
          el instanceof HTMLButtonElement ||
          el instanceof HTMLInputElement ||
          el instanceof HTMLSelectElement ||
          el instanceof HTMLTextAreaElement
        ) {
          el.disabled = false;
        }
      });
    };
  }, [editMode, children]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
