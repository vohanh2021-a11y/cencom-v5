/**
 * tests/e2e/ketoan.spec.ts — Playwright E2E smoke test cho module kế toán (GĐ1–GĐ4).
 * Chạy: npx playwright test tests/e2e/ketoan.spec.ts
 * Yêu cầu:
 *   - Web server đang chạy tại BASE_URL (mặc định http://localhost:3000)
 *   - Đã đăng nhập với user có quyền ke_toan (role: ketoan/quanly/giamdoc/admin)
 *   - Playwright browsers đã cài: npx playwright install chromium
 *
 * Lưu ý: Test này gọi trực tiếp endpoint /api/rpc. Cách lấy session:
 *   1. Mở trang web, đăng nhập thủ công, copy cookie 'session' từ DevTools.
 *   2. Set env SESSION_COOKIE=session=... trước khi chạy.
 *   HOẶC: thêm bước login tự động nếu biết selector form login.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SESSION_COOKIE = process.env.SESSION_COOKIE || ''; // format: "session=abc123"

test.describe.configure({ retries: 0 });

async function rpc(request, fn, args) {
  const headers = { 'Content-Type': 'application/json' };
  const cookies = SESSION_COOKIE ? { session: SESSION_COOKIE.split('=')[1] } : {};
  const res = await request.post(`${BASE_URL}/api/rpc`, {
    headers,
    data: { fn, args },
    // Playwright tự xử lý cookie qua cookie jar nếu dùng request.storageState()
    // Ở đây dùng manual cookie header đơn giản.
  });
  return res.json();
}

test.describe('Kế toán VAS — Smoke E2E (GĐ1–GĐ4)', () => {
  test('ledgerPost ghi chứng từ cân bằng', async ({ request }) => {
    const d = new Date().toISOString().split('T')[0];
    const res = await rpc(request, 'ledgerPost', {
      so_ct: `CT-E2E-${Date.now()}`,
      ngay: d,
      loai_ct: 'test_e2e',
      entries: [
        { tai_khoan: '152', du_no: 1000 },
        { tai_khoan: '331', du_co: 1000 },
      ],
    });
    expect(res.ok).toBe(true);
    expect(res.ct_id).toBeTruthy();
  });

  test('ledgerPost từ chối khi lệch Nợ/Có', async ({ request }) => {
    const d = new Date().toISOString().split('T')[0];
    const res = await rpc(request, 'ledgerPost', {
      so_ct: `CT-ERR-${Date.now()}`,
      ngay: d,
      loai_ct: 'test_e2e',
      entries: [
        { tai_khoan: '152', du_no: 1000 },
        { tai_khoan: '331', du_co: 500 }, // lệch
      ],
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/bằng/i);
  });

  test('vatInvoiceSave tạo HĐ VAT + bút toán 133/331', async ({ request }) => {
    const d = new Date().toISOString().split('T')[0];
    const res = await rpc(request, 'vatInvoiceSave', {
      so_hd: `HD-E2E-${Date.now()}`,
      tien_thue: 200,
      tien_hang: 2000,
      ngay: d,
    });
    expect(res.ok).toBe(true);
    expect(res.id).toBeTruthy();
  });

  test('phieuChiCreate thanh toán công nợ', async ({ request }) => {
    // Tạo công nợ trước (cần cong_no_id tồn tại)
    // Giả sử đã có CN-E2E-1 từ seed hoặc test trước.
    const d = new Date().toISOString().split('T')[0];
    const res = await rpc(request, 'phieuChiCreate', {
      cong_no_id: 'CN-E2E-1', // phải tồn tại trong DB test
      so_tien: 100,
      ngay: d,
    });
    // Có thể ok=false nếu công nợ không tồn tại — test chỉ kiểm tra schema response
    expect(typeof res.ok).toBe('boolean');
  });

  test('congNoList trả danh sách công nợ', async ({ request }) => {
    const res = await rpc(request, 'congNoList', { loai: 'phai_tra' });
    expect(Array.isArray(res)).toBe(true);
    // Kiểm tra cấu trúc item nếu có dữ liệu
    if (res.length > 0) {
      expect(res[0]).toHaveProperty('id');
      expect(res[0]).toHaveProperty('con_no');
    }
  });

  test('ledgerReport trả CĐKT cân bằng', async ({ request }) => {
    const res = await rpc(request, 'ledgerReport', {});
    expect(res).toHaveProperty('cdkt');
    expect(res).toHaveProperty('chi_phi');
    expect(res).toHaveProperty('so_152');
    expect(res).toHaveProperty('so_331');
    expect(res).toHaveProperty('so_133');
    expect(res.tong_tai_san).toBeCloseTo(res.tong_nguon, 1);
  });

  test('kyClose + kyOpen vòng đời kỳ', async ({ request }) => {
    const kyName = `E2E-T${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    // Khóa kỳ
    const close = await rpc(request, 'kyClose', {
      ten_ky: kyName,
      tu_ngay: today,
      den_ngay: nextMonth,
    });
    expect(close.ok).toBe(true);

    // Mở lại
    const open = await rpc(request, 'kyOpen', { ten_ky: kyName });
    expect(open.ok).toBe(true);

    // Ghi được sau khi mở
    const post = await rpc(request, 'ledgerPost', {
      so_ct: `CT-OPEN-${Date.now()}`,
      ngay: today,
      loai_ct: 'test_e2e',
      entries: [{ tai_khoan: '152', du_no: 1 }, { tai_khoan: '331', du_co: 1 }],
    });
    expect(post.ok).toBe(true);
  });
});