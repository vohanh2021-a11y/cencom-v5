#!/usr/bin/env node
// scripts/smoke.mjs — Quick smoke test for cencomOS Gara v5
// Chạy: node scripts/smoke.mjs (tự start server)
//
// NOTE: server spawn mirrors scripts/test-ci.mjs (proven working):
//   spawn('npx', ['next', 'dev', '-p', PORT], { env, stdio:'inherit', shell: win32 })
// Do NOT use `npm run dev` + shell:true — Windows mangles env to grandchild.

import { spawn, execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const ENV_PATH = resolve(PROJECT_ROOT, '.env.local');
const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;
const HEALTH_URL = `${BASE_URL}/api/health`;

let serverProcess = null;

// --- Load .env.local (UTF-16/UTF-8 aware, like test-ci) ---
function loadEnvFile() {
  if (!existsSync(ENV_PATH)) {
    console.error('[smoke] .env.local not found at', ENV_PATH);
    process.exit(1);
  }
  const buffer = readFileSync(ENV_PATH);
  let content;
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    content = buffer.toString('utf16le').slice(1);
  } else if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    content = buffer.toString('utf16be').slice(1);
  } else {
    content = buffer.toString('utf8');
  }
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key && !process.env[key]) process.env[key] = value;
  }
  console.log('[smoke] Loaded .env.local');
}

// --- Wait for health endpoint ---
async function waitHealth(maxMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(HEALTH_URL);
      if (res.ok) {
        const data = await res.json();
        if (data.db === 'up') {
          console.log('[smoke] Health OK:', data);
          return true;
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Health check timeout');
}

// --- Start Next.js dev server (mirror test-ci) ---
function startServer() {
  const serverEnv = {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: 'development',
  };
  delete serverEnv.TEST_BASE_URL; // avoid interference
  console.log(`[smoke] Starting Next.js dev server on port ${PORT}...`);
  serverProcess = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
    cwd: PROJECT_ROOT,
    env: serverEnv,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  serverProcess.on('error', (err) => {
    console.error('[smoke] Server spawn error:', err.message);
    process.exit(1);
  });
}

// --- Kill server (Windows-aware) ---
function killServer() {
  if (!serverProcess || serverProcess.killed) return;
  console.log('[smoke] Cleaning up server...');
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${serverProcess.pid} /T /F`, { stdio: ['pipe', 'pipe', 'pipe'] });
    } else {
      serverProcess.kill('SIGTERM');
    }
  } catch {}
}

// --- RPC call helper ---
async function rpc(token, fn, args = {}) {
  const res = await fetch(`${BASE_URL}/api/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `sid=${token}` },
    body: JSON.stringify({ fn, args })
  });
  const data = await res.json();
  return { status: res.status, ...data };
}

// --- Login helper ---
async function login(user, pass = 'cencom@123') {
  const res = await fetch(`${BASE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', user, pass })
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Login failed for ${user}: ${JSON.stringify(data)}`);
  const setCookie = res.headers.get('set-cookie') || '';
  const m = setCookie.match(/sid=([^;]+)/);
  if (!m) throw new Error('No sid cookie');
  return m[1];
}

// --- Main smoke test ---
async function main() {
  loadEnvFile();
  if (!process.env.DATABASE_URL) {
    console.error('FATAL: DATABASE_URL not found in .env.local');
    process.exit(1);
  }

  startServer();
  await waitHealth();

  const tokens = {};
  const roles = ['admin', 'giamdoc', 'xuong', 'ketoan', 'kho'];
  for (const role of roles) {
    try {
      tokens[role] = await login(role);
      console.log(`[smoke] Login ${role} OK`);
    } catch (e) {
      console.error(`[smoke] Login ${role} FAIL:`, e.message);
      process.exit(1);
    }
  }

  // 1. Health
  const health = await fetch(HEALTH_URL).then(r => r.json());
  if (health.db !== 'up') throw new Error('Health db not up');
  console.log('[smoke] ✓ Health check');

  // 2. List endpoints for all roles
  for (const role of roles) {
    for (const fn of ['xeList', 'scList', 'vattuList']) {
      const r = await rpc(tokens[role], fn);
      if (!r.ok || !Array.isArray(r.result)) throw new Error(`${role} ${fn} failed: ${JSON.stringify(r)}`);
    }
    console.log(`[smoke] ✓ ${role} list endpoints`);
  }

  // 3. Admin create xe
  let xeId;
  {
    const r = await rpc(tokens.admin, 'xeCreate', { bien_so: 'SMK-001', chu_xe: 'Smoke Test', nam_sx: 2020, nguyen_gia: 100000000 });
    if (!r.ok || !r.result?.id?.match(/^XE-\d{6}$/)) throw new Error('xeCreate failed: ' + JSON.stringify(r));
    xeId = r.result.id;
    console.log('[smoke] ✓ xeCreate:', xeId);
  }

  // 4. Xuong create SC
  let scId;
  {
    const r = await rpc(tokens.xuong, 'scCreate', { xe_id: xeId, ngay: new Date().toISOString().split('T')[0] });
    if (!r.ok || !r.result?.id?.match(/^SC-\d{6}$/)) throw new Error('scCreate failed: ' + JSON.stringify(r));
    scId = r.result.id;
    console.log('[smoke] ✓ scCreate:', scId);
  }

  // 5. Xuong: scAddCongViec, scBatDauSua, scHoanThanh
  {
    const r1 = await rpc(tokens.xuong, 'scAddCongViec', { sc_id: scId, mo_ta: 'Smoke CV', loai_xu_ly: 'sua_chua', so_luong: 1, don_gia: 100000 });
    if (!r1.ok) throw new Error('scAddCongViec failed: ' + JSON.stringify(r1));
    console.log('[smoke] ✓ scAddCongViec');
    const r2 = await rpc(tokens.xuong, 'scBatDauSua', { sc_id: scId });
    if (!r2.ok) throw new Error('scBatDauSua failed: ' + JSON.stringify(r2));
    console.log('[smoke] ✓ scBatDauSua');
    const r3 = await rpc(tokens.xuong, 'scHoanThanh', { sc_id: scId });
    if (!r3.ok) throw new Error('scHoanThanh failed: ' + JSON.stringify(r3));
    console.log('[smoke] ✓ scHoanThanh');
  }

  // 6. Ketoan: scQuyetToan
  {
    const r = await rpc(tokens.ketoan, 'scQuyetToan', { sc_id: scId });
    if (!r.ok) throw new Error('scQuyetToan failed: ' + JSON.stringify(r));
    console.log('[smoke] ✓ scQuyetToan');
  }

  // 7. Kho: vattuCreate, nhapKho, xuatKho, dmCreate
  let vtId;
  {
    const r = await rpc(tokens.kho, 'vattuCreate', { ten: 'Smoke VT', don_vi: 'cái', gia: 50000, ton_min: 5 });
    if (!r.ok || !r.result?.id?.match(/^VT-\d{6}$/)) throw new Error('vattuCreate failed: ' + JSON.stringify(r));
    vtId = r.result.id;
    console.log('[smoke] ✓ vattuCreate:', vtId);
  }
  {
    const r = await rpc(tokens.kho, 'nhapKho', { vattu_id: vtId, so_luong: 10, don_gia: 50000, ngay: new Date().toISOString().split('T')[0], ly_do: 'Smoke' });
    if (!r.ok) throw new Error('nhapKho failed: ' + JSON.stringify(r));
    console.log('[smoke] ✓ nhapKho');
  }
  {
    const r = await rpc(tokens.kho, 'xuatKho', { vattu_id: vtId, so_luong: 5, ly_do: 'Smoke' });
    if (!r.ok) throw new Error('xuatKho failed: ' + JSON.stringify(r));
    console.log('[smoke] ✓ xuatKho');
  }
  {
    const r = await rpc(tokens.kho, 'dmCreate', { items: [{ vattu_id: vtId, so_luong: 3, don_gia: 50000 }], ngay: new Date().toISOString().split('T')[0] });
    if (!r.ok) throw new Error('dmCreate failed: ' + JSON.stringify(r));
    console.log('[smoke] ✓ dmCreate');
  }

  // 8. Ketoan: baogiaSave, hoSoSave
  {
    const r = await rpc(tokens.ketoan, 'baogiaSave', { sc_id: scId, ncc: 'Smoke NCC', ngay: new Date().toISOString().split('T')[0], items: [{ ten: 'Item 1', so_luong: 1, don_gia: 100000 }] });
    if (!r.ok) throw new Error('baogiaSave failed: ' + JSON.stringify(r));
    console.log('[smoke] ✓ baogiaSave');
  }
  {
    const r = await rpc(tokens.ketoan, 'hoSoSave', { sc_id: scId, so_chung_tu: 'SMK-001', ngay: new Date().toISOString().split('T')[0], ghi_chu: 'Smoke' });
    if (!r.ok) throw new Error('hoSoSave failed: ' + JSON.stringify(r));
    console.log('[smoke] ✓ hoSoSave');
  }

  // 9. Logout
  for (const role of roles) {
    const r = await rpc(tokens[role], 'logout');
    if (!r.ok) throw new Error(`logout ${role} failed`);
  }
  console.log('[smoke] ✓ All logout');

  console.log('\n[smoke] 🎉 ALL SMOKE TESTS PASSED');
}

main()
  .then(() => { killServer(); setTimeout(() => process.exit(0), 500); })
  .catch(err => {
    console.error('[smoke] ❌ FAILED:', err.message);
    killServer();
    process.exit(1);
  });