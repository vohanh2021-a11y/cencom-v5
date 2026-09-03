/**
 * cencom_load.js — k6 load test cho boundary /api/rpc (theo simulation-testing skill).
 *
 * Mô phỏng nhiều user ảo gọi đồng thời các RPC đọc (SC, vật tư, đề xuất, dashboard)
 * và 1 write (tạo phiếu SC), đo p95/p99 + tỉ lệ lỗi.
 *
 * Cơ chế auth (đã xác minh trong mã nguồn):
 *  - Login POST /api/auth {username,password} -> Set-Cookie cen_session.
 *  - k6 gửi Cookie cen_session + header x-session-token (middleware copy cookie->header).
 *  - CSRF: không gửi Origin/Referer -> csrfGuard cho phép (cùng origin hoặc không header).
 *
 * Chạy:
 *   node scripts/load-runner.mjs tests/load/cencom_load.js -s 10s:3
 *   # Stress + write nặng (tìm điểm gãy pool PG max:10):
 *   node scripts/load-runner.mjs tests/load/cencom_load.js -s 30s:100 -e HEAVY=1
 * Env:   BASE_URL, LOAD_USER (mặc admin-1), LOAD_PASS (mặc Cencom@2026), HEAVY=1 (bật write nặng)
 * Ghi chú: write tạo dòng phieu_sua; dọn bằng: node scripts/clean-load.mjs
 *   (clean-load xoá mo_ta LIKE 'k6-load-%' và 'k6-heavy-%')
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const USER = __ENV.LOAD_USER || 'admin-1';
const PASS = __ENV.LOAD_PASS || 'Cencom@2026';
const HEAVY = __ENV.HEAVY === '1';

const errorRate = new Rate('errors');

export const options = {
  // Ramp-up -> sustain -> ramp-down. Ghi đè bằng -s khi chạy thực tế (vd stress -s 30s:100).
  stages: [
    { duration: '15s', target: 5 },
    { duration: '45s', target: 25 },
    { duration: '15s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
    http_req_failed: ['rate<0.05'],
    errors: ['rate<0.05'],
  },
  // Không gửi Origin/Referer -> csrfGuard cho phép (cùng origin hoặc không header).
  // Session: middleware copy cookie cen_session -> header x-session-token.
};

function rpc(token, fn, args) {
  const headers = {
    'Content-Type': 'application/json',
    Cookie: `cen_session=${token}`,
    'x-session-token': token,
  };
  return http.post(`${BASE}/api/rpc`, JSON.stringify({ fn, args }), { headers });
}

export function setup() {
  const res = http.post(
    `${BASE}/api/auth`,
    JSON.stringify({ username: USER, password: PASS }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, { 'login ok': (r) => r.json('ok') === true });
  const cookie = res.cookies['cen_session'];
  const token = cookie && cookie.length ? cookie[0].value : null;
  if (!token) throw new Error('Login không trả về cookie cen_session (sai tài khoản/mật khẩu?)');
  return { token };
}

export default function (data) {
  const token = data.token;
  if (!token) {
    errorRate.add(true);
    return;
  }

  group('read: SC list', () => {
    const r = rpc(token, 'scList', [{}]);
    errorRate.add(!check(r, { 'scList ok': (x) => x.json('ok') === true }));
  });

  group('read: vật tư list', () => {
    const r = rpc(token, 'vatTuList', [{}]);
    errorRate.add(!check(r, { 'vatTuList ok': (x) => x.json('ok') === true }));
  });

  group('read: đề xuất list', () => {
    const r = rpc(token, 'deXuatList', [{}]);
    errorRate.add(!check(r, { 'deXuatList ok': (x) => x.json('ok') === true }));
  });

  group('read: dashboard xưởng', () => {
    const r = rpc(token, 'xuongDashboard', [{}]);
    errorRate.add(!check(r, { 'dashboard ok': (x) => x.json('ok') === true }));
  });

  group('write: tạo phiếu SC', () => {
    // scCreate yêu cầu xe đã tồn tại (seed '37C-00621') và trả business result.
    // Dùng mo_ta làm marker 'k6-load-*' để dọn sau (xem scripts/clean-load.mjs).
    const bks = '37C-00621';
    const moTa = `k6-load-${__VU}-${__ITER}`;
    const r = rpc(token, 'scCreate', [{ bks, mo_ta: moTa }]);
    const j = r.json();
    // Quan trọng: assert CẢ envelope ok VÀ business result.ok (tránh false-green
    // như từng gặp: envelope ok nhưng result.ok=false "Chưa có xe...").
    const ok = j.ok === true && j.result && j.result.ok === true;
    errorRate.add(!check(r, { 'scCreate business ok': () => ok }));
  });

  // HEAVY=1: write nặng (nhiều hạng mục) để tìm điểm gãy pool PG (max:10) khi đẩy cao VU.
  if (HEAVY) {
    group('HEAVY write: SC nhiều hạng mục (stress pool)', () => {
      const bks = '37C-00621';
      const moTa = `k6-heavy-${__VU}-${__ITER}`;
      const congviec = Array.from({ length: 10 }, (_, i) => ({
        ten: `CV ${i}`, so_luong: 1, don_gia: 1000, loai_xu_ly: 'thay_the',
      }));
      const vattu = Array.from({ length: 10 }, (_, i) => ({
        name: `VT ${i}`, so_luong: 1, gd_dk: 1000,
      }));
      const r = rpc(token, 'scCreate', [{ bks, mo_ta: moTa, congviec, vattu }]);
      const j = r.json();
      const ok = j.ok === true && j.result && j.result.ok === true;
      errorRate.add(!check(r, { 'heavy scCreate business ok': () => ok }));
    });
  }

  sleep(1);
}

export function teardown() {
  // Token chia sẻ giữa VU; không logout từng VU. Có thể gọi DELETE /api/auth nếu cần.
}
