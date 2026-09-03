/**
 * load-runner.mjs — Cross-platform launcher cho k6 load test.
 *
 * Tìm binary k6 theo thứ tự: tools/k6/k6.exe (đã bundle) -> tools/k6/k6 -> k6 (PATH).
 * Cách chạy:
 *   node scripts/load-runner.mjs tests/load/cencom_load.js -s 10s:3
 *   node scripts/load-runner.mjs                 # mặc định chạy tests/load/cencom_load.js
 * Mọi argv sau script được truyền thẳng cho k6 (vd: -s/--stage, --vus, --duration, -e KEY=VALUE).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const candidates = [
  path.join(root, 'tools', 'k6', 'k6.exe'),
  path.join(root, 'tools', 'k6', 'k6'),
  'k6',
];
const k6bin = candidates.find((c) => c === 'k6' || existsSync(c));
if (!k6bin) {
  console.error('[load-runner] Không tìm thấy k6. Đặt binary tại tools/k6/k6.exe hoặc cài k6 vào PATH.');
  process.exit(2);
}

const defaultScript = path.join(root, 'tests', 'load', 'cencom_load.js');
const script = process.argv[2] && !process.argv[2].startsWith('-') ? process.argv[2] : defaultScript;
const extra = process.argv.slice(process.argv[2] === script ? 3 : 2);

const args = ['run', script, ...extra];
console.log(`[load-runner] ${k6bin} ${args.join(' ')}`);
const res = spawnSync(k6bin, args, { stdio: 'inherit', env: process.env, shell: false });
process.exit(res.status ?? 1);
