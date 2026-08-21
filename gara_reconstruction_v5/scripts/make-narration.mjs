#!/usr/bin/env node
// scripts/make-narration.mjs — Convert recorded .webm to an annotated .mp4 UAT tour.
// Burns in Vietnamese step subtitles (no external TTS/internet needed).

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const VIDEO_DIR = resolve(PROJECT_ROOT, 'videos');
const FFMPEG = 'E:\\DevTools\\opencode\\config\\tools\\ffmpeg\\ffmpeg.exe';

// 8 steps, ~3.5s each (matches record-ux navigation cadence)
const STEPS = [
  'Bước 1 — Đăng nhập hệ thống quản lý gara cencomOS v5',
  'Bước 2 — Dashboard tổng quan: hoạt động gần đây & phiếu sửa chữa',
  'Bước 3 — Danh sách xe (Bảng xe)',
  'Bước 4 — Danh sách phiếu sửa chữa (SC)',
  'Bước 5 — Kho vật tư',
  'Bước 6 — Báo giá nhà cung cấp',
  'Bước 7 — Hồ sơ kế toán',
  'Bước 8 — Đăng xuất',
];

function buildSrt() {
  const dur = 3.5;
  let srt = '';
  STEPS.forEach((text, i) => {
    const start = i * dur;
    const end = start + dur;
    const fmt = (t) => {
      const h = String(Math.floor(t / 3600)).padStart(2, '0');
      const m = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
      const s = String(Math.floor(t % 60)).padStart(2, '0');
      const ms = String(Math.floor((t % 1) * 1000)).padStart(3, '0');
      return `${h}:${m}:${s},${ms}`;
    };
    srt += `${i + 1}\n${fmt(start)} --> ${fmt(end)}\n${text}\n\n`;
  });
  return srt;
}

function main() {
  if (!existsSync(VIDEO_DIR)) { console.error('[narration] No videos dir'); process.exit(1); }
  const files = readdirSync(VIDEO_DIR).filter(f => f.endsWith('.webm')).sort();
  if (files.length === 0) { console.error('[narration] No .webm found — run record-ux.mjs first'); process.exit(1); }
  const webm = resolve(VIDEO_DIR, files[files.length - 1]);
  console.log('[narration] Source:', webm);

  const srtPath = resolve(VIDEO_DIR, 'steps.srt');
  writeFileSync(srtPath, buildSrt(), 'utf8');
  console.log('[narration] Wrote subtitles:', srtPath);

  const out = resolve(VIDEO_DIR, 'uat-tour.mp4');
  // Burn subtitles + re-encode to H.264 mp4 (no audio track from Playwright).
  // Use RELATIVE srt path (cwd=VIDEO_DIR) — absolute path with "E:" colon breaks the filter parser.
  const args = [
    '-y', '-i', webm,
    '-vf', `subtitles=steps.srt:force_style='FontSize=22,Bold=1,PrimaryColour=&Hffffff&,BackColour=&H80000000&'`,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-an', out
  ];
  console.log('[narration] Running ffmpeg...');
  const res = spawnSync(FFMPEG, args, { stdio: 'inherit', cwd: VIDEO_DIR });
  if (res.status !== 0) {
    console.error('[narration] ❌ ffmpeg failed (status ' + res.status + '). Is ffmpeg at ' + FFMPEG + '?');
    process.exit(1);
  }
  console.log('[narration] ✅ UAT video produced:', out);
}

main();
