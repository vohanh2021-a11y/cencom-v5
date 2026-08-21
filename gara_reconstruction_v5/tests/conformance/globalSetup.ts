import fs from 'fs';
import path from 'path';
import pg from 'pg';

const projectRoot = path.resolve(__dirname, '../..');
const envPath = path.join(projectRoot, '.env.local');

function loadEnvFile(): void {
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local not found at ' + envPath);
  }
  // Read as buffer first to detect encoding
  const buffer = fs.readFileSync(envPath);
  let content: string;
  // Check for UTF-16 LE BOM (0xFF 0xFE) or UTF-16 BE BOM (0xFE 0xFF)
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

loadEnvFile();

async function resetSchema(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL not set in environment');
  }
  const pool = new pg.Pool({ connectionString });
  try {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    console.log('[globalSetup] Schema reset (DROP/CREATE public)');
  } finally {
    await pool.end();
  }
}

async function globalSetupFn(): Promise<void> {
  console.log('[globalSetup] Starting...');
  await resetSchema();
  // Dynamic imports AFTER env is loaded, so migrate/seed modules see DATABASE_URL
  const { migrate } = await import('../../db/migrate');
  const { seed } = await import('../../db/seed');
  await migrate();
  await seed();
  console.log('[globalSetup] DB migrated + seeded');
}

export default globalSetupFn;