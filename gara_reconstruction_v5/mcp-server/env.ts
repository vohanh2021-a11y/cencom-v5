/**
 * mcp-server/env.ts — DB-FREE environment loader
 *
 * Reads .env.mcp first, falls back to .env.local for missing keys.
 * Sets MCP_ROLE='giamdoc' and MCP_WRITE_TOOLS='' defaults.
 *
 * SIDE EFFECT: calling module via `import './env'` is enough to set all env vars.
 * Must be imported BEFORE any module that reads process.env (e.g. lib/db).
 *
 * Logic reused from mcp-server/auth.ts loadEnvFile (encoding detection)
 * — does NOT modify auth.ts.
 */

import fs from 'fs';
import path from 'path';

/**
 * Load a single .env file with encoding detection (UTF-16LE BOM, UTF-16BE, UTF-8).
 * Copied from mcp-server/auth.ts to keep env.ts DB-FREE.
 */
function loadEnvFile(filePath: string, onlyIfMissing = false): void {
  const buffer = fs.readFileSync(filePath);
  let content: string;

  // Detect encoding from BOM
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    // UTF-16LE with BOM
    content = buffer.toString('utf16le').slice(1);
  } else if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    // UTF-16BE with BOM
    content = buffer.slice(2).swap16().toString('utf16le');
  } else {
    // UTF-8 (no BOM or other)
    content = buffer.toString('utf8');
  }

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key && (!onlyIfMissing || !process.env[key])) {
      process.env[key] = value;
    }
  }
}

/**
 * Load MCP environment: .env.mcp → .env.local fallback → defaults.
 */
function loadEnv(): void {
  const mcpEnvPath = path.join(__dirname, '.env.mcp');
  const rootEnvPath = path.join(__dirname, '..', '.env.local');

  // Load .env.mcp first (if exists)
  if (fs.existsSync(mcpEnvPath)) {
    loadEnvFile(mcpEnvPath);
  }

  // Fallback to root .env.local for missing keys
  if (fs.existsSync(rootEnvPath)) {
    loadEnvFile(rootEnvPath, true);
  }

  // Default MCP_ROLE if not set
  if (!process.env.MCP_ROLE) {
    process.env.MCP_ROLE = 'giamdoc';
  }

  // Default MCP_WRITE_TOOLS if not set
  if (process.env.MCP_WRITE_TOOLS === undefined) {
    process.env.MCP_WRITE_TOOLS = '';
  }
}

// Side-effect: importing this module is enough to set all env vars
loadEnv();
