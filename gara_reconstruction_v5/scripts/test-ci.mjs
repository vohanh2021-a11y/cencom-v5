#!/usr/bin/env node
/**
 * test-ci.mjs — Conformance test runner with auto-start server
 *
 * Workflow:
 *   1. Read .env.local (DATABASE_URL, SESSION_SECRET) → set process.env
 *   2. Spawn Next.js dev server on port 3001
 *   3. Poll /api/health until 200 (max 60s)
 *   4. Run jest with TEST_BASE_URL=http://localhost:3001
 *   5. Kill server, exit with jest's exit code
 *
 * Usage: node scripts/test-ci.mjs
 *        npm run test:ci
 */

import { spawn, execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

// ─── 1. Load .env.local ──────────────────────────────────────────────
function loadEnvFile() {
  const envPath = resolve(PROJECT_ROOT, '.env.local');
  if (!existsSync(envPath)) {
    throw new Error(`.env.local not found at ${envPath}`);
  }
  // Read as buffer to detect UTF-16 LE BOM (Windows notepad encoding)
  const buffer = readFileSync(envPath);
  let content;
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    content = buffer.toString('utf16le').slice(1); // Remove BOM
  } else if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    content = buffer.toString('utf16be').slice(1); // Remove BOM
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
    if (key && !process.env[key]) {
      process.env[key] = value;
      console.log(`  [env] ${key}=${key === 'SESSION_SECRET' ? '***' : value.slice(0, 30)}...`);
    }
  }
}

// ─── 2. Port detection ───────────────────────────────────────────────
function findAvailablePort(preferred) {
  // Check if preferred port is free on Windows
  try {
    const out = execSync(`netstat -ano | findstr ":${preferred} "`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (out.includes('LISTENING')) {
      console.log(`  [port] ${preferred} occupied, trying ${preferred + 1}...`);
      return preferred + 1;
    }
  } catch {
    // findstr returns exit 1 when no match — port is free
  }
  return preferred;
}

const PORT = findAvailablePort(3001);
const BASE_URL = `http://localhost:${PORT}`;

// ─── 3. Health check poll ────────────────────────────────────────────
function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(`${BASE_URL}/api/health`, { timeout: 3000 }, (res) => {
      resolve(res.statusCode === 200);
      res.resume(); // drain
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function waitForServer(maxWaitMs = 60000) {
  const start = Date.now();
  console.log(`\n  [server] Waiting for ${BASE_URL}/api/health ...`);
  while (Date.now() - start < maxWaitMs) {
    const ok = await checkHealth();
    if (ok) {
      console.log(`  [server] Ready! (${Date.now() - start}ms)`);
      return true;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server not ready after ${maxWaitMs}ms`);
}

// ─── 4. Kill server (Windows-aware) ─────────────────────────────────
function killServer(serverProc) {
  if (!serverProc || serverProc.killed) return;
  console.log(`\n  [cleanup] Killing server (PID ${serverProc.pid})...`);
  try {
    // Windows: kill entire process tree
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${serverProc.pid} /T /F`, {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } else {
      serverProc.kill('SIGTERM');
    }
  } catch {
    // Already dead or kill failed — try force
    try { serverProc.kill('SIGKILL'); } catch {}
  }
}

// ─── 5. Main ─────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  test-ci.mjs — Conformance Test Runner (server+test)');
  console.log('═══════════════════════════════════════════════════════\n');

  // Step 1: Load env
  console.log('[step 1] Loading .env.local...');
  loadEnvFile();

  if (!process.env.DATABASE_URL) {
    console.error('FATAL: DATABASE_URL not found in .env.local');
    process.exit(1);
  }

  // Step 2: Start server
  console.log(`\n[step 2] Starting Next.js dev server on port ${PORT}...`);
  const serverEnv = {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: 'development',
  };
  // Remove TEST_BASE_URL from server env to avoid interference
  delete serverEnv.TEST_BASE_URL;

  const serverProc = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
    cwd: PROJECT_ROOT,
    env: serverEnv,
    stdio: 'inherit',
    shell: process.platform === 'win32', // Windows needs shell for npx
  });

  serverProc.on('error', (err) => {
    console.error('Server spawn error:', err.message);
    process.exit(1);
  });

  let jestExitCode = 1;

  try {
    // Step 3: Wait for ready
    await waitForServer(60000);

    // Step 4: Run jest
    console.log(`\n[step 3] Running jest with TEST_BASE_URL=${BASE_URL}...`);
    console.log('───────────────────────────────────────────────────────\n');

    const jestEnv = {
      ...process.env,
      TEST_BASE_URL: BASE_URL,
      NODE_ENV: 'test',
    };

    await new Promise((resolve, reject) => {
      const jestProc = spawn('npx', ['jest', '--runInBand', '--verbose'], {
        cwd: PROJECT_ROOT,
        env: jestEnv,
        stdio: 'inherit',
        shell: process.platform === 'win32',
      });

      jestProc.on('close', (code) => {
        jestExitCode = code ?? 1;
        resolve();
      });
      jestProc.on('error', (err) => {
        reject(err);
      });
    });
  } finally {
    // Step 5: ALWAYS kill server
    killServer(serverProc);
  }

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`  Done. Jest exit code: ${jestExitCode}`);
  console.log(`  Port used: ${PORT}`);
  console.log(`═══════════════════════════════════════════════════════`);

  process.exit(jestExitCode);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
