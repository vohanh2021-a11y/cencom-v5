#!/usr/bin/env node
// scripts/record-ux.mjs — Playwright record UAT video tour
// Navigates the real UI and records a .webm; make-narration.mjs adds voiceover+mp4.

import { spawn, execSync } from 'node:child_process';
import { readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const ENV_PATH = resolve(PROJECT_ROOT, '.env.local');
const VIDEO_DIR = resolve(PROJECT_ROOT, 'videos');

// Load .env.local (UTF-16/UTF-8 aware)
function loadEnv() {
  if (!existsSync(ENV_PATH)) {
    console.error('[record-ux] .env.local not found');
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
  console.log('[record-ux] Loaded .env.local');
}

if (!existsSync(VIDEO_DIR)) mkdirSync(VIDEO_DIR, { recursive: true });

// Find Playwright (CJS require handles package main resolution)
const require = createRequire(import.meta.url);
let playwright = null;
try {
  playwright = require('playwright');
} catch {
  const candidate = 'C:/Users/Admin/.config/opencode/skills/huashu-design/node_modules/playwright';
  if (existsSync(candidate)) playwright = require(candidate);
}
if (!playwright) {
  console.error('[record-ux] Playwright not found');
  process.exit(1);
}
console.log('[record-ux] Using Playwright from skill cache');
const { chromium } = playwright;

let serverProcess = null;

// Mirror test-ci: npx next dev (NOT npm run dev + shell:true — Windows mangles env)
function startServer() {
  const serverEnv = {
    ...process.env,
    PORT: '3001',
    NODE_ENV: 'development',
  };
  delete serverEnv.TEST_BASE_URL;
  console.log('[record-ux] Starting Next.js dev server on port 3001...');
  serverProcess = spawn('npx', ['next', 'dev', '-p', '3001'], {
    cwd: PROJECT_ROOT,
    env: serverEnv,
    shell: process.platform === 'win32',
    stdio: 'inherit'
  });
  serverProcess.on('error', (err) => {
    console.error('[record-ux] Server spawn error:', err.message);
    process.exit(1);
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

async function waitHealth() {
  for (let i = 0; i < 90; i++) {
    try {
      const res = await fetch('http://localhost:3001/api/health');
      if (res.ok) { const d = await res.json(); if (d.db === 'up') return; }
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error('Health timeout');
}

async function main() {
  loadEnv();
  if (!process.env.DATABASE_URL) { console.error('FATAL: DATABASE_URL missing'); process.exit(1); }
  startServer();
  await waitHealth();
  console.log('[record-ux] Server ready, starting recording...');

  const browser = await chromium.launch({ headless: true, slowMo: 150, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const context = await browser.newContext({
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();
  const BASE = 'http://localhost:3001';

  try {
    // 1. Login
    console.log('[record-ux] Step 1: Login');
    await page.goto(`${BASE}/login`);
    await page.getByPlaceholder('Tài khoản').fill('admin');
    await page.getByPlaceholder('Mật khẩu').fill('cencom@123');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await page.waitForURL(`${BASE}/`);
    await page.waitForTimeout(1500);

    // 2. Dashboard
    console.log('[record-ux] Step 2: Dashboard');
    await page.waitForTimeout(1500);

    // 3. Xe
    console.log('[record-ux] Step 3: Xe list');
    await page.goto(`${BASE}/xe`);
    await page.waitForTimeout(1500);

    // 4. SC
    console.log('[record-ux] Step 4: SC list');
    await page.goto(`${BASE}/sc`);
    await page.waitForTimeout(1500);

    // 5. Kho
    console.log('[record-ux] Step 5: Kho / Vật tư');
    await page.goto(`${BASE}/kho`);
    await page.waitForTimeout(1500);

    // 6. Bao gia
    console.log('[record-ux] Step 6: Báo giá');
    await page.goto(`${BASE}/baogia`);
    await page.waitForTimeout(1500);

    // 7. Ho so
    console.log('[record-ux] Step 7: Hồ sơ');
    await page.goto(`${BASE}/hoso`);
    await page.waitForTimeout(1500);

    // 8. Logout
    console.log('[record-ux] Step 8: Logout');
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await page.waitForURL(`${BASE}/login`);
    await page.waitForTimeout(1000);
  } finally {
    await context.close();
    await browser.close();
    killServer();
  }

  const files = existsSync(VIDEO_DIR) ? readdirSync(VIDEO_DIR) : [];
  const webm = files.filter(f => f.endsWith('.webm')).sort().pop();
  if (webm) {
    console.log('[record-ux] ✅ Video recorded:', resolve(VIDEO_DIR, webm));
  } else {
    console.error('[record-ux] ❌ No video file found');
  }
}

main().catch(err => {
  console.error('[record-ux] ❌ FAILED:', err.message);
  killServer();
  process.exit(1);
});
