#!/usr/bin/env node
// scripts/run-e2e.mjs — Start server with proper env, then run Playwright E2E

import { spawn, execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const ENV_PATH = resolve(PROJECT_ROOT, '.env.local');

let serverProcess = null;

// Load .env.local (UTF-16/UTF-8 aware, mirror smoke.mjs which works)
function loadEnv() {
  if (!existsSync(ENV_PATH)) {
    console.error('[run-e2e] .env.local not found');
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
  console.log('[run-e2e] Loaded .env.local');
}

// Start Next.js dev server (mirror test-ci: npx next dev, NOT npm run dev)
function startServer() {
  const serverEnv = {
    ...process.env,
    PORT: '3001',
    NODE_ENV: 'development',
  };
  delete serverEnv.TEST_BASE_URL;
  return new Promise((resolve, reject) => {
    console.log('[run-e2e] Starting Next.js dev server on port 3001...');
    serverProcess = spawn('npx', ['next', 'dev', '-p', '3001'], {
      cwd: PROJECT_ROOT,
      env: serverEnv,
      shell: process.platform === 'win32',
      stdio: 'inherit'
    });
    serverProcess.on('error', reject);
    serverProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) console.log('[run-e2e] Server exited:', code);
    });
    setTimeout(resolve, 3000);
  });
}

function killServer() {
  if (!serverProcess || serverProcess.killed) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${serverProcess.pid} /T /F`, { stdio: ['pipe', 'pipe', 'pipe'] });
    } else {
      serverProcess.kill('SIGTERM');
    }
  } catch {}
}

// Wait for health
async function waitHealth(maxMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch('http://localhost:3001/api/health');
      if (res.ok) {
        const data = await res.json();
        if (data.db === 'up') {
          console.log('[run-e2e] Health OK');
          return true;
        }
      }
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Health check timeout');
}

// Run Playwright
function runPlaywright() {
  return new Promise((resolve, reject) => {
    // DEP0190-safe: spawn node directly with the Playwright CLI (no npx, no shell:true).
    // On Windows `npx` is npx.cmd and requires a shell; node + resolved cli.js works without one.
    const pwCli = resolve(PROJECT_ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
    const pw = spawn(process.execPath, [pwCli, 'test', 'tests/e2e/e2e-flow.test.ts', '--project=chromium'], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, TEST_BASE_URL: 'http://localhost:3001' },
      shell: false,
      stdio: 'inherit'
    });
    pw.on('error', reject);
    pw.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Playwright exited with code ${code}`));
    });
  });
}

async function main() {
  loadEnv();
  await startServer();
  await waitHealth();
  console.log('[run-e2e] Running Playwright E2E...');
  try {
    await runPlaywright();
    console.log('[run-e2e] ✅ E2E PASSED');
  } finally {
    killServer();
  }
}

main().catch(err => {
  console.error('[run-e2e] ❌ FAILED:', err.message);
  killServer();
  process.exit(1);
});