import { db } from '../../lib/db';
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
  for (const u of users) {
    const actor = await login(db, u.name, 'cencom@123');
    if (!actor) throw new Error(`Login failed for ${u.name}`);
    const token = signSession(actor);
    tokens[u.role] = token;
  }
  console.log('✅ Setup: 5 users logged in');
});

export { db };