/**
 * UAT/rename-videos.mjs — Đổi tên video Playwright → UAT/videos/<TC-ID>.webm.
 * Quét đệ quy tìm file video.webm, ghép với mã case (từ index.json) theo tên thư mục.
 * Dùng: node UAT/rename-videos.mjs [TC-ID]
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..', '..');
const data = JSON.parse(readFileSync(resolve(__dirname, 'cases', 'index.json'), 'utf8'));
const ids = data.cases.map((c) => c.id);
const only = process.argv[2];
const targetDir = resolve(__dirname, 'videos');
mkdirSync(targetDir, { recursive: true });

function walk(dir, out) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (e === 'video.webm') out.push(p);
  }
}

const vids = [];
for (const d of ['test-results', 'UAT/test-results', 'test-results-cli']) {
  const p = resolve(root, d);
  try { if (statSync(p).isDirectory()) walk(p, vids); } catch {}
}
// fallback: quét toàn bộ root (giới hạn 3 cấp)
try { walk(resolve(root), vids); } catch {}

const seen = new Set();
let count = 0;
for (const v of vids) {
  const hit = ids.find((id) => v.includes(id));
  if (!hit) continue;
  if (only && hit !== only) continue;
  if (seen.has(hit)) continue;
  seen.add(hit);
  const dest = resolve(targetDir, `${hit}.webm`);
  copyFileSync(v, dest);
  console.log(`✔ video → ${hit}.webm`);
  count++;
}
console.log(`✅ Đã đổi tên ${count} video.`);
