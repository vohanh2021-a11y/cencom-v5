'use client';

/* ============================================================================
 * W4.4 — Nút bật/tắt chế độ chỉnh sửa trên topbar (port từ v4 Topbar.tsx
 * dòng 43–50 + 59–67 + 96–111 — v4 đặt inline trong Topbar; v5 tách thành
 * component riêng vì v5 topbar là <header> server-component ở
 * app/(app)/layout.tsx, không có Topbar.tsx).
 *
 * Hành vi PA1 GIỮ NGUYÊN v4:
 *  - Chỉ hiện cho giám đốc (canToggleEdit).
 *  - view-only  → nút "✏️ Bật chỉnh sửa" mở modal xác nhận (bảo vệ thao tác
 *    ghi ngoài ý muốn); xác nhận → editMode=true + console.info trace.
 *  - edit-mode  → badge "✏️ Đang sửa" (bấm để tắt về view-only — bổ sung
 *    lối quay lại, v4 chỉ có chiều bật).
 *  - Backend KHÔNG đổi — mọi phán quyết quyền vẫn ở RPC can() (PA1).
 *
 * Class .edit-action trên NÚT BẬT: để CSS body.view-only ẩn đi khi trang
 * nào đó bọc guard quanh header (port ngữ nghĩa v4); nút đang nằm NGOÀI
 * guard nên class chỉ là belt-and-braces.
 * ========================================================================== */

import * as React from 'react';
import { useWorkspace } from './WorkspaceContext';

export default function EditToggle() {
  const { canToggleEdit, editMode, setEditMode } = useWorkspace();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  if (!canToggleEdit) return null;

  function enableEdit() {
    setEditMode(true);
    setConfirmOpen(false);
    // PA1: backend can() giữ nguyên; chỉ ghi nhận ở client (truy vết qua console để dev biết)
    if (typeof window !== 'undefined') console.info('[view-only] giám đốc đã bật chế độ chỉnh sửa');
  }

  return (
    <>
      {editMode ? (
        <button
          type="button"
          className="btn btn-sm inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 hover:bg-amber-200"
          onClick={() => setEditMode(false)}
          title="Đang ở chế độ chỉnh sửa — bấm để tắt"
        >
          ✏️ <span className="hidden md:inline">Đang sửa</span>
        </button>
      ) : (
        <button
          type="button"
          className="btn btn-sm inline-flex items-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700 hover:bg-orange-100"
          onClick={() => setConfirmOpen(true)}
          aria-label="Bật chế độ chỉnh sửa"
        >
          👁 <span className="hidden md:inline">Xem</span> · ✏️ Bật chỉnh sửa
        </button>
      )}
      {confirmOpen && (
        <div className="modal" role="dialog" aria-modal="true" aria-label="Xác nhận bật chỉnh sửa">
          <div className="modal-box">
            <div className="mb-2 text-base font-semibold text-slate-800">
              Xác nhận bật chế độ chỉnh sửa
            </div>
            <p className="mb-4 text-sm text-slate-600">
              Bạn sắp chuyển sang chế độ <b>duyệt (chỉnh sửa)</b>. Thao tác sẽ ảnh hưởng dữ liệu
              sản xuất. Tiếp tục?
            </p>
            <div className="flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setConfirmOpen(false)}>
                Hủy
              </button>
              <button className="btn btn-primary edit-action" onClick={enableEdit}>
                Bật chỉnh sửa
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
