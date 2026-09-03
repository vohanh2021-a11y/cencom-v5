/**
 * UAT/_start-dev.mjs — Khởi động dev server từ đúng thư mục apps/web.
 * Dùng bởi playwright.config.webServer (tránh lỗi cd tương đối do cwd = thư mục config).
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webDir = resolve(__dirname, '..', 'apps', 'web');

const child = spawn('npm', ['run', 'dev'], { cwd: webDir, stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (e) => {
  console.error('[start-dev] lỗi:', e.message);
  process.exit(1);
});
