'use client';

/**
 * app/in/print-button.tsx — toolbar In/Lưu PDF cho trang /in (button duy nhất
 * cần client; phần còn lại của trang là server component thuần).
 */
export default function PrintButton() {
  return (
    <div className="toolbar no-print">
      <button type="button" className="btn btn-primary" onClick={() => window.print()}>
        In / Lưu PDF
      </button>
      <button type="button" className="btn" onClick={() => window.close()}>
        Đóng
      </button>
    </div>
  );
}
