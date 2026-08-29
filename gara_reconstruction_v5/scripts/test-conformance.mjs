#!/usr/bin/env node
/**
 * test-conformance.mjs — Per-file conformance runner with isolated server (GPS GĐ2 gate)
 *
 * Why per-file + per-server?
 *  - globalSetup resets the DB (DROP/CREATE) before EACH jest run, so running
 *    every *.test.ts in its OWN jest process gives clean, deterministic state.
 *  - rpc/security suites are HTTP tests that need a running server. The
 *    rate-limit middleware (on /api/auth) keeps in-memory state, so a SHARED
 *    server across files triggers spurious 429s. Spawning a FRESH server per
 *    file resets that state too.
 *
 * Result: every suite runs in full isolation → all green.
 *
 * Usage: node scripts/test-conformance.mjs   (or `npm run test:conformance`)
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const CONF_DIR = resolve(PROJECT_ROOT, 'tests/conformance');

// ── env loader (mirrors test-ci.mjs) ──────────────────────────────────
function loadEnvFile() {
  const envPath = resolve(PROJECT_ROOT, '.env.local');
  if (!existsSync(envPath)) throw new Error('.env.local not found');
  const buf = readFileSync(envPath);
  let content;
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) content = buf.toString('utf16le').slice(1);
  else if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) content = buf.toString('utf16be').slice(1);
  else content = buf.toString('utf8');
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (k && !process.env[k]) process.env[k] = v;
  }
}
loadEnvFile();

function findAvailablePort(preferred) {
  try {
    const out = execSync(`netstat -ano | findstr ":${preferred} "`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    if (out.includes('LISTENING')) return preferred + 1;
  } catch { /* free */ }
  return preferred;
}

function waitForServer(baseUrl, maxMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(`${baseUrl}/api/health`, { timeout: 3000 }, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve(true);
        if (Date.now() - start > maxMs) return reject(new Error('server timeout'));
        setTimeout(tick, 1000);
      });
      req.on('error', () => {
        if (Date.now() - start > maxMs) return reject(new Error('server timeout'));
        setTimeout(tick, 1000);
      });
      req.on('timeout', () => { req.destroy(); });
    };
    tick();
  });
}

function killServer(proc) {
  if (!proc || proc.killed) return;
  try {
    if (process.platform === 'win32') execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'pipe' });
    else proc.kill('SIGKILL');
  } catch { try { proc.kill('SIGKILL'); } catch {} }
}

const files = readdirSync(CONF_DIR).filter((f) => f.endsWith('.test.ts')).sort();

console.log('═══════════════════════════════════════════════════════');
console.log(`  Isolated Conformance Runner — ${files.length} suites`);
console.log('═══════════════════════════════════════════════════════');

let totalPass = 0, totalFail = 0;
const failed = [];

async function runFile(rel, port) {
  const baseUrl = `http://localhost:${port}`;
  const serverProc = spawn('npx', ['next', 'dev', '-p', String(port)], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PORT: String(port), NODE_ENV: 'development' },
    stdio: 'ignore',
    shell: true,
  });
  try {
    await waitForServer(baseUrl);
    const res = spawnSync(
      'npx',
      ['jest', rel, '--runInBand', '--forceExit'],
      {
        cwd: PROJECT_ROOT,
        env: { ...process.env, TEST_BASE_URL: baseUrl, NODE_ENV: 'test' },
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        shell: true,
      }
    );
    const out = (res.stdout || '') + (res.stderr || '');
    const passedM = out.match(/Tests:\s*(\d+)/);
    const failedM = out.match(/(\d+)\s+failed/);
    const passed = passedM ? parseInt(passedM[1], 10) : 0;
    const failedInFile = failedM ? parseInt(failedM[1], 10) : 0;
    totalPass += passed;
    totalFail += failedInFile;
    if (failedInFile > 0 || (res.status !== 0 && failedInFile === 0)) {
      failed.push(`${rel} (${passed} passed, ${failedInFile} failed)`);
      console.log(`✗ ${rel} — ${passed} passed, ${failedInFile} failed`);
    } else {
      console.log(`✓ ${rel} — ${passed} passed`);
    }
  } finally {
    killServer(serverProc);
    await new Promise((r) => setTimeout(r, 500));
  }
}

(async () => {
  let port = 3100;
  for (const f of files) {
    port = findAvailablePort(port);
    await runFile(`tests/conformance/${f}`, port);
    port += 1;
  }
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Suites: ${files.length}  |  Tests passed: ${totalPass}  |  failed: ${totalFail}`);
  if (failed.length) {
    console.log(`  FAILED: ${failed.join(', ')}`);
    console.log('═══════════════════════════════════════════════════════');
    process.exit(1);
  }
  console.log('  ✅ ALL CONFORMANCE SUITES GREEN');
  console.log('═══════════════════════════════════════════════════════');
  process.exit(0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
