import { db, run } from '../../lib/db';
import { login, signSession } from '../../lib/auth';
import { loadEnv } from './loadEnv';

loadEnv();

const tokens: Record<string, string> = {
  admin: '',
  giamdoc: '',
  xuong: '',
  ketoan: '',
  kho: '',
};

export function getAdminToken(): string { return tokens.admin; }
export function getGiamdocToken(): string { return tokens.giamdoc; }
export function getXuongToken(): string { return tokens.xuong; }
export function getKetoanToken(): string { return tokens.ketoan; }
export function getKhoToken(): string { return tokens.kho; }

export function getTokens(): Readonly<Record<string, string>> {
  return tokens;
}

beforeAll(async () => {
  const users = [
    { name: 'admin', role: 'admin' },
    { name: 'giamdoc', role: 'giamdoc' },
    { name: 'xuong', role: 'xuong' },
    { name: 'ketoan', role: 'ketoan' },
    { name: 'kho', role: 'kho' },
  ];
  // W4.1: seed đặt must_change=1 cho cả 5 tài khoản demo (GĐ3.6.2 — lần đăng
  // nhập ĐẦU phải đổi mật khẩu). /api/rpc giờ ENFORCE cờ này (403 needChangePw)
  // → harness bật cờ 0 cho 5 user dùng chung, mô phỏng trạng thái "đã hoàn tất
  // đổi mật khẩu lần đầu". Seed sản xuất GIỮ NGUYÊN 1. Test enforce must_change
  // dùng TÀI KHOẢN RIÊNG do userAdd tạo (mặc định vẫn must_change=1) —
  // xem tests/conformance/admin_rbac.test.ts.
  for (const u of users) {
    const actor = await login(db, u.name, 'cencom@123');
    if (!actor) throw new Error(`Login failed for ${u.name}`);
    await run('UPDATE users SET must_change = 0 WHERE id = $1', [actor.id]);
    const token = signSession(actor);
    tokens[u.role] = token;
  }
  console.log('✅ Setup: 5 users logged in (must_change cleared for harness)');
});

export { db };