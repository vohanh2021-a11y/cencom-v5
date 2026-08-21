import fs from 'fs';
import path from 'path';

// .env.local is at project root, not in tests/conformance
const projectRoot = path.resolve(__dirname, '../..');
const envPath = path.join(projectRoot, '.env.local');

export function loadEnv(): void {
  if (!fs.existsSync(envPath)) {
    console.warn('[loadEnv] .env.local not found at', envPath);
    return;
  }
  // Read as buffer first to detect encoding (UTF-16 with BOM)
  const buffer = fs.readFileSync(envPath);
  let content: string;
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    content = buffer.toString('utf16le').slice(1); // Remove BOM
  } else if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
    content = buffer.slice(2).swap16().toString('utf16le'); // UTF-16 BE → swap to LE, skip BOM
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
    }
  }
}

// Auto-load when imported (for setupFiles)
loadEnv();