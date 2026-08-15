/**
 * auth-context.ts — AsyncLocalStorage<User> thay thế module-level _actor.
 *
 * V3.6 dùng setUser(u)/current() module-level — KHÔNG an toàn trong
 * Next.js serverless (multiple requests share module). Dùng AsyncLocalStorage
 * để mỗi request có context riêng, an toàn cho concurrent.
 *
 * Usage trong route handler:
 *   import { runWithAuth } from '@/lib/auth-context';
 *   return runWithAuth(user, async () => {
 *     // trong scope này, getUser() trả về user hiện tại
 *     const u = getUser();
 *   });
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface AuthUser {
  id: string;
  name: string;
  role: string;
  phone?: string;
  phong_ban?: string;
}

const authStore = new AsyncLocalStorage<AuthUser>();

/**
 * Chạy callback trong scope có auth context.
 * Trả về kết quả của callback.
 */
export async function runWithAuth<T>(user: AuthUser, fn: () => Promise<T>): Promise<T> {
  return authStore.run(user, fn);
}

/**
 * Lấy user hiện tại từ auth context.
 * Throws nếu gọi ngoài scope (chưa set context).
 */
export function getUser(): AuthUser {
  const user = authStore.getStore();
  if (!user) {
    throw new Error('No auth context — getUser() called outside runWithAuth scope');
  }
  return user;
}

/**
 * Lấy user hiện tại (nullable — an toàn cho việc kiểm tra).
 */
export function getUserOrNull(): AuthUser | null {
  return authStore.getStore() ?? null;
}

/**
 * Kiểm tra user có phải admin không.
 */
export function isAdmin(): boolean {
  const u = getUserOrNull();
  return u?.role === 'admin';
}
