#!/usr/bin/env node
// Export PG -> CSV (Excel mở được ngay) - dành cho người kiểm soát thủ công
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env.local');
if (fs.existsSync(envPath)) {
  const buf = fs.readFileSync(envPath);
  let c = buf.toString('utf8');
  if (buf[0]===0xFF && buf[1]===0xFE) c = buf.toString('utf16le').slice(1);
  for (const line of c.split('\n')) {
    const t=line.trim(); if(!t||t.startsWith('#')) continue;
    const i=t.indexOf('='); if(i===-1) continue;
    const k=t.slice(0,i).trim(), v=t.slice(i+1).trim();
    if(k && !process.env[k]) process.env[k]=v;
  }
}
const outDir = path.join(root, `exports/cencom_${new Date().toISOString().slice(0,10)}`);
fs.mkdirSync(outDir, { recursive: true });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// helper: query -> CSV (UTF-8 BOM để Excel VN đọc đúng dấu)
async function tableToCSV(table, where='') {
  const sql = `SELECT * FROM ${table} ${where} ORDER BY 1 LIMIT 200`;
  try {
    const r = await pool.query(sql);
    if (r.rows.length===0) {
      // still write header from pg column info
      const colRes = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`, [table]);
      const header = colRes.rows.map(c=>c.column_name).join(',');
      fs.writeFileSync(path.join(outDir, `${table}.csv`), '\uFEFF' + header + '\n', 'utf8');
      console.log(`CSV ${table}: 0 rows (header only)`);
      return 0;
    }
    const header = Object.keys(r.rows[0]).join(',');
    const lines = r.rows.map(row => Object.values(row).map(v=>{
      if(v===null||v===undefined) return '';
      let s=String(v).replace(/"/g,'""');
      if(s.includes(',')||s.includes('"')||s.includes('\n')) s=`"${s}"`;
      return s;
    }).join(','));
    const csv = '\uFEFF' + header + '\n' + lines.join('\n');
    fs.writeFileSync(path.join(outDir, `${table}.csv`), csv, 'utf8');
    console.log(`CSV ${table}: ${r.rows.length} rows -> ${path.join(outDir, `${table}.csv`)}`);
    return r.rows.length;
  } catch(e) {
    console.log(`SKIP ${table}: ${e.message}`);
    return 0;
  }
}

const tables = ['sc','ke_hoach_sc','phieu_kiem_tu','bien_ban_nghiem','bao_gia_ncc','nhap_xuat','xe'];
let total=0;
for(const t of tables) total += await tableToCSV(t, t==='sc' ? `WHERE deleted_at=''` : '');
await pool.end();
console.log(`\nDONE. Folder: ${outDir}`);
console.log(`Total rows exported: ${total}`);
console.log(`Mở bằng Excel: double-click file .csv (đã có BOM UTF-8, đọc đúng tiếng Việt).`);
