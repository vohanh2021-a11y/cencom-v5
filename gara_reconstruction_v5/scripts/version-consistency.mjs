#!/usr/bin/env node
/**
 * version-consistency.mjs
 * Kiểm tra đồng nhất version giữa package.json và git tag mới nhất.
 *
 * Usage:  node gara_reconstruction_v5/scripts/version-consistency.mjs   (từ repo root)
 * Exit 0: OK
 * Exit 1: MISMATCH hoặc version không hợp lệ
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ROOT = 2 cấp lên từ scripts/  →  repo root
const ROOT = resolve(__dirname, '..', '..');

/* ── 1. Đọc pkgVersion ──────────────────────────────────────────────── */
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'gara_reconstruction_v5', 'package.json'), 'utf-8'));
const pkgVersion = pkg.version;

if (!/^\d+\.\d+\.\d+$/.test(pkgVersion)) {
  console.error('[version-consistency] INVALID pkgVersion=' + pkgVersion);
  process.exit(1);
}

/* ── 2. Lấy git tag mới nhất (không bắt buộc) ──────────────────────── */
let tagVersion = null;
try {
  const raw = execSync('git describe --tags --abbrev=0', { cwd: ROOT, encoding: 'utf-8' }).trim();
  if (raw.startsWith('v')) {
    tagVersion = raw.slice(1);
  }
} catch {
  // Không có tag → bỏ qua, chỉ check pkgVersion hợp lệ
}

/* ── 3. So sánh (nếu có tag) ────────────────────────────────────────── */
if (tagVersion !== null && pkgVersion !== tagVersion) {
  console.error('[version-consistency] MISMATCH pkg=' + pkgVersion + ' tag=' + tagVersion);
  process.exit(1);
}

/* ── 4. OK ───────────────────────────────────────────────────────────── */
console.log('[version-consistency] OK pkg=' + pkgVersion + (tagVersion ? ' tag=' + tagVersion : ''));
process.exit(0);
